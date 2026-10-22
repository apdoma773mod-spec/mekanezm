-- 58: تعديل البيعة من نقدي لآجل والعكس (شاشة تعديل الفاتورة بتبعت p.pay_mode = cash | credit)
-- بيتشغّل بعد RUN-ALL.sql (47..49). بيعدّل mk_save_invoice_core بس، والبيانات القديمة ما بتتغيرش
-- إلا لما تعديل بيبعت pay_mode. الكمية والسعر والمخزون ما بيتغيروش.
-- بعد التشغيل: في index.html غيّر MK_PAY_MODE_ON إلى true.

create or replace function public.mk_save_invoice_core(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.mk_role();
  v_kind text := p->>'kind';
  v_sale boolean := (p->>'kind') = 'sale';
  v_ctype text := case when (p->>'kind') = 'sale' then 'عميل' else 'مورد' end;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_old public.mk_invoices;
  v_inv public.mk_invoices;
  v_person text := btrim(coalesce(p->>'person', ''));
  v_ship numeric := greatest(0, coalesce((p->>'ship')::numeric, 0));
  v_total numeric := 0; v_all numeric; v_keep numeric; v_credit numeric; v_rem numeric;
  v_cid uuid; v_no text; v_date date;
  it jsonb; v_pid uuid; v_q numeric; v_pr numeric; v_name text; v_item uuid; v_cost numeric; v_pos int := 0;
  v_oldcost jsonb := '{}';
  r record;
begin
  if v_role is null then raise exception 'not_member'; end if;
  if v_kind not in ('sale','purchase') then raise exception 'bad_kind'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') < 1 then raise exception 'no_items'; end if;
  if v_id is not null and v_role <> 'admin' then raise exception 'admin_only'; end if;
  perform public.mk_lock();
  for it in select * from jsonb_array_elements(p->'items') loop
    v_q := (it->>'qty')::numeric; v_pr := coalesce((it->>'price')::numeric, 0);
    if v_q is null or v_q <= 0 then raise exception 'bad_qty:%', coalesce(it->>'name', ''); end if;
    v_total := v_total + round(v_q * v_pr, 2);
  end loop;
  v_total := round(v_total + v_ship, 2);
  if v_id is not null then
    select * into v_old from public.mk_invoices where id = v_id for update;
    if not found then raise exception 'not_found'; end if;
    if v_old.kind <> v_kind then raise exception 'bad_kind'; end if;
    if not v_sale then
      for r in select distinct ii.product_id, ii.product_name from public.mk_invoice_items ii where ii.invoice_id = v_id and ii.product_id is not null loop
        if not exists (select 1 from jsonb_array_elements(p->'items') x where nullif(x->>'product_id', '')::uuid = r.product_id)
           and exists (select 1 from public.mk_invoice_items si join public.mk_invoices s on s.id = si.invoice_id
                        where s.kind = 'sale' and si.product_id = r.product_id and s.date >= v_old.date) then
          raise exception 'sold_item_removed:%', r.product_name;
        end if;
      end loop;
    end if;
    for r in select ii.id, ii.product_id, ii.qty, ic.cost from public.mk_invoice_items ii left join public.mk_item_costs ic on ic.item_id = ii.id where ii.invoice_id = v_id loop
      if r.product_id is not null then
        update public.mk_products set qty = qty + case when v_sale then r.qty else -r.qty end, updated_at = now() where id = r.product_id;
        if r.cost is not null then v_oldcost := v_oldcost || jsonb_build_object(r.product_id::text, r.cost); end if;
      end if;
    end loop;
    if v_old.contact_id is not null then
      update public.mk_contacts set balance = round(balance - v_old.rem, 2) where id = v_old.contact_id;
    end if;
    delete from public.mk_invoice_items where invoice_id = v_id;
    if p->>'pay_mode' is not null and p->>'pay_mode' not in ('cash','credit') then raise exception 'bad_pay_mode'; end if;
    if p->>'pay_mode' = 'credit' then
      if greatest(0, coalesce((p->>'extra')::numeric, 0)) > 0 then raise exception 'extra_with_credit'; end if;
      v_all := 0;
    elsif p->>'pay_mode' = 'cash' then
      v_all := v_total;
    else
      v_all := round(v_old.paid + greatest(0, coalesce((p->>'extra')::numeric, 0)), 2);
    end if;
    v_no := v_old.no; v_date := v_old.date;
  else
    v_all := coalesce((p->>'paid')::numeric, v_total);
    if v_all < 0 then raise exception 'bad_paid'; end if;
    if v_all > v_total + 0.001 then raise exception 'paid_gt_total'; end if;
    v_no := public.mk_next_no(v_kind);
    v_date := coalesce(nullif(p->>'date', '')::date, public.mk_today());
  end if;
  v_keep := least(v_all, v_total);
  v_credit := round(v_all - v_keep, 2);
  v_rem := round(v_total - v_keep, 2);
  if (v_rem > 0.001 or v_credit > 0.001) and v_person = '' then raise exception 'need_person'; end if;
  v_cid := case when coalesce((p->>'no_contact')::boolean, false) then null
                else public.mk_contact_for(v_person, v_ctype, p->>'phone', p->>'addr') end;
  if v_id is null then
    insert into public.mk_invoices(kind, no, date, date_txt, person, contact_id, phone, addr, note, ship, total, paid, rem, source, web_order_id, quote_id, created_by_name)
    values (v_kind, v_no, v_date, public.mk_ar_date(v_date), v_person, v_cid, coalesce(p->>'phone', ''), coalesce(p->>'addr', ''), coalesce(p->>'note', ''),
            v_ship, v_total, v_keep, v_rem, coalesce(p->>'source', ''), nullif(p->>'web_order_id', '')::uuid, nullif(p->>'quote_id', '')::uuid, public.mk_me_name())
    returning * into v_inv;
  else
    update public.mk_invoices set person = v_person, contact_id = v_cid, phone = coalesce(p->>'phone', ''), addr = coalesce(p->>'addr', ''),
           note = coalesce(p->>'note', ''), ship = v_ship, total = v_total, paid = v_keep, rem = v_rem,
           edited_at = now(), edited_by_name = public.mk_me_name()
     where id = v_id returning * into v_inv;
  end if;
  for it in select * from jsonb_array_elements(p->'items') loop
    v_q := (it->>'qty')::numeric; v_pr := coalesce((it->>'price')::numeric, 0); v_name := btrim(coalesce(it->>'name', ''));
    v_pid := nullif(it->>'product_id', '')::uuid;
    if v_pid is not null and not exists (select 1 from public.mk_products where id = v_pid) then v_pid := null; end if;
    if v_pid is null and v_name <> '' then select id into v_pid from public.mk_products where name = v_name order by created_at limit 1; end if;
    if v_pid is null then
      if v_name = '' then raise exception 'bad_item'; end if;
      insert into public.mk_products(code, name, price) values ('P' || lpad(((select count(*) from public.mk_products) + 1)::text, 4, '0'), v_name, case when v_sale then v_pr else 0 end)
      returning id into v_pid;
      insert into public.mk_product_costs(product_id, cost) values (v_pid, case when v_sale then 0 else v_pr end);
    end if;
    select name into v_name from public.mk_products where id = v_pid;
    update public.mk_products set qty = qty + case when v_sale then -v_q else v_q end, updated_at = now() where id = v_pid;
    v_pos := v_pos + 1;
    insert into public.mk_invoice_items(invoice_id, product_id, product_name, qty, price, total, pos)
    values (v_inv.id, v_pid, v_name, v_q, v_pr, round(v_q * v_pr, 2), v_pos) returning id into v_item;
    v_cost := coalesce((v_oldcost->>v_pid::text)::numeric, (select cost from public.mk_product_costs where product_id = v_pid), 0);
    insert into public.mk_item_costs(item_id, cost) values (v_item, case when v_sale then v_cost else v_pr end);
  end loop;
  if v_cid is not null then
    update public.mk_contacts set balance = round(balance + v_rem - v_credit, 2) where id = v_cid;
    if v_credit > 0 then
      insert into public.mk_payments(contact_id, name, dir, amount, note, date_txt, created_by_name)
      values (v_cid, v_person, case when v_sale then 'in' else 'out' end, v_credit,
              case when v_sale then 'رصيد للعميل' else 'رصيد عند المورد' end || ' من تعديل فاتورة ' || v_no, public.mk_ar_date(public.mk_today()), public.mk_me_name());
    end if;
  end if;
  if nullif(p->>'quote_id', '') is not null then
    update public.mk_quotes set status = 'converted', inv_no = v_no where id = (p->>'quote_id')::uuid;
  end if;
  perform public.mk_log_add(case when v_id is null then 'invoice.create' else 'invoice.edit' end, v_no,
                            jsonb_build_object('kind', v_kind, 'total', v_total, 'person', v_person));
  return jsonb_build_object('id', v_inv.id, 'no', v_no, 'total', v_total, 'rem', v_rem, 'credit', v_credit);
end $$;

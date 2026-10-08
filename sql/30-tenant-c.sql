-- =====================================================================
-- Mika Omnix — الجزء 3: دوال السيستم (نفس ميكانيزم بالظبط) — بتشتغل بدور mk_fn (عليه العزل)
-- التعديلات الوحيدة: on conflict (org, key) / (org, day) وقفل لكل محل بدل قفل واحد للكل.
-- =====================================================================
create or replace function public.mk_lock() returns void
language sql security definer set search_path = public as
$$ select pg_advisory_xact_lock(7002, hashtext(coalesce(public.mk_org()::text, ''))) $$;

create or replace function public.mk_log_add(p_action text, p_ref text, p_details jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.mk_log(user_name, action, ref, details) values (public.mk_me_name(), p_action, coalesce(p_ref, ''), p_details)
$$;

create or replace function public.mk_next_no(p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare k text := case p_kind when 'sale' then 'inv' when 'purchase' then 'pur' else 'quote' end;
        pre text := case p_kind when 'sale' then 'MK-' when 'purchase' then 'SH-' else 'QT-' end;
        n int;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  insert into public.mk_settings(key, value) values ('counters', '{}') on conflict (org, key) do nothing;
  update public.mk_settings set value = jsonb_set(value, array[k], to_jsonb(coalesce((value->>k)::int, 0) + 1)), updated_at = now()
   where key = 'counters' returning (value->>k)::int into n;
  return pre || lpad(n::text, 4, '0');
end $$;

create or replace function public.mk_contact_for(p_name text, p_type text, p_phone text, p_addr text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if coalesce(btrim(p_name), '') = '' then return null; end if;
  select id into v from public.mk_contacts where type = p_type and btrim(name) = btrim(p_name) order by created_at limit 1;
  if v is null then
    insert into public.mk_contacts(name, type, phone, addr) values (btrim(p_name), p_type, coalesce(p_phone, ''), coalesce(p_addr, '')) returning id into v;
  else
    update public.mk_contacts set phone = case when phone = '' then coalesce(p_phone, '') else phone end,
                                  addr  = case when addr = '' and note = '' then coalesce(p_addr, '') else addr end
     where id = v;
  end if;
  return v;
end $$;

create or replace function public.mk_save_invoice(p jsonb) returns jsonb
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
    v_all := round(v_old.paid + greatest(0, coalesce((p->>'extra')::numeric, 0)), 2);
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

create or replace function public.mk_void_invoice(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.mk_invoices; r record; v_sold text; v_items jsonb;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  perform public.mk_lock();
  select * into v from public.mk_invoices where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v.kind = 'purchase' then
    select string_agg(distinct ii.product_name, '، ') into v_sold
      from public.mk_invoice_items ii
     where ii.invoice_id = p_id and ii.product_id is not null
       and exists (select 1 from public.mk_invoice_items si join public.mk_invoices s on s.id = si.invoice_id
                    where s.kind = 'sale' and si.product_id = ii.product_id and s.date >= v.date);
    if v_sold is not null then raise exception 'sold_after:%', v_sold; end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(ii) || jsonb_build_object('cost', ic.cost) order by ii.pos), '[]') into v_items
    from public.mk_invoice_items ii left join public.mk_item_costs ic on ic.item_id = ii.id where ii.invoice_id = p_id;
  for r in select product_id, qty from public.mk_invoice_items where invoice_id = p_id and product_id is not null loop
    update public.mk_products set qty = qty + case when v.kind = 'sale' then r.qty else -r.qty end, updated_at = now() where id = r.product_id;
  end loop;
  if v.contact_id is not null then
    update public.mk_contacts set balance = round(balance - v.rem - v.paid, 2) where id = v.contact_id;
    if v.paid > 0 then
      insert into public.mk_payments(contact_id, name, dir, amount, note, date_txt, created_by_name)
      values (v.contact_id, v.person, case when v.kind = 'sale' then 'in' else 'out' end, v.paid,
              case when v.kind = 'sale' then 'رصيد للعميل' else 'رصيد عند المورد' end || ' من إلغاء فاتورة ' || v.no, public.mk_ar_date(public.mk_today()), public.mk_me_name());
    end if;
  end if;
  insert into public.mk_voided(kind, label, data, by_name) values (v.kind, v.no, to_jsonb(v) || jsonb_build_object('items', v_items), public.mk_me_name());
  delete from public.mk_invoices where id = p_id;
  perform public.mk_log_add('invoice.void', v.no, jsonb_build_object('kind', v.kind, 'total', v.total));
  return jsonb_build_object('no', v.no);
end $$;

create or replace function public.mk_add_payment(p_contact uuid, p_amount numeric, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.mk_contacts; v uuid;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  select * into c from public.mk_contacts where id = p_contact for update;
  if not found then raise exception 'not_found'; end if;
  update public.mk_contacts set balance = round(balance - p_amount, 2) where id = p_contact;
  insert into public.mk_payments(contact_id, name, dir, amount, note, date_txt, created_by_name)
  values (p_contact, c.name, case when c.type = 'عميل' then 'in' else 'out' end, p_amount, coalesce(p_note, ''), public.mk_ar_date(public.mk_today()), public.mk_me_name())
  returning id into v;
  perform public.mk_log_add('payment', c.name, jsonb_build_object('amount', p_amount));
  return v;
end $$;

create or replace function public.mk_save_return(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_pid uuid := (p->>'product_id')::uuid; v_q numeric := (p->>'qty')::numeric; v_pr numeric := coalesce((p->>'price')::numeric, 0);
        v_type text := p->>'type'; pr public.mk_products; v uuid;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  if v_type not in ('sale','purchase') or v_q is null or v_q <= 0 then raise exception 'bad_return'; end if;
  select * into pr from public.mk_products where id = v_pid for update;
  if not found then raise exception 'not_found'; end if;
  update public.mk_products set qty = qty + case when v_type = 'sale' then v_q else -v_q end, updated_at = now() where id = v_pid;
  insert into public.mk_returns(type, product_id, product_name, person, qty, price, total, cost, note, date_txt, created_by_name)
  values (v_type, v_pid, pr.name, coalesce(p->>'person', ''), v_q, v_pr, round(v_q * v_pr, 2),
          (select cost from public.mk_product_costs where product_id = v_pid), coalesce(p->>'note', ''), public.mk_ar_date(public.mk_today()), public.mk_me_name())
  returning id into v;
  perform public.mk_log_add('return', pr.name, jsonb_build_object('type', v_type, 'qty', v_q));
  return v;
end $$;

create or replace function public.mk_backup_now() returns date
language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  select jsonb_build_object(
    'products',  (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('cost', c.cost)), '[]') from public.mk_products x left join public.mk_product_costs c on c.product_id = x.id),
    'contacts',  (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mk_contacts x),
    'invoices',  (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mk_invoices x),
    'items',     (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('cost', c.cost)), '[]') from public.mk_invoice_items x left join public.mk_item_costs c on c.item_id = x.id),
    'payments',  (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mk_payments x),
    'returns',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mk_returns x),
    'expenses',  (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mk_expenses x),
    'quotes',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mk_quotes x),
    'settings',  (select coalesce(jsonb_object_agg(key, value), '{}') from public.mk_settings where key <> 'theme'),
    'members',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.mk_members x)
  ) into d;
  insert into public.mk_backups(day, data) values (public.mk_today(), d)
    on conflict (org, day) do update set data = excluded.data, made_at = now();
  delete from public.mk_backups where day < public.mk_today() - 30;
  return public.mk_today();
end $$;

create or replace function public.mk_rename_contact(p_id uuid, p_name text, p_type text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.mk_contacts; n text := btrim(coalesce(p_name, ''));
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  if char_length(n) < 2 then raise exception 'bad_name'; end if;
  if p_type not in ('عميل','مورد') then raise exception 'bad_type'; end if;
  select * into c from public.mk_contacts where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if exists (select 1 from public.mk_contacts where type = p_type and btrim(name) = n and id <> p_id) then raise exception 'name_taken'; end if;
  update public.mk_invoices set person = n where contact_id = p_id;
  update public.mk_invoices set person = n, contact_id = p_id
   where contact_id is null and btrim(person) = btrim(c.name) and kind = case when c.type = 'عميل' then 'sale' else 'purchase' end;
  update public.mk_payments set name = n where contact_id = p_id;
  update public.mk_returns set person = n where btrim(person) = btrim(c.name) and type = case when c.type = 'عميل' then 'sale' else 'purchase' end;
  update public.mk_contacts set name = n, type = p_type where id = p_id;
  perform public.mk_log_add('contact.rename', c.name || ' → ' || n, null);
end $$;

-- ---------- المرحلة 2: الجرد والتسعير والتقفيل ----------
create or replace function public.mk_adjust_stock(p_id uuid, p_qty numeric, p_note text) returns numeric
language plpgsql security definer set search_path = public as $$
declare pr public.mk_products; c numeric;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  if p_qty is null then raise exception 'bad_qty'; end if;
  select * into pr from public.mk_products where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if pr.qty = p_qty then return p_qty; end if;
  select cost into c from public.mk_product_costs where product_id = p_id;
  update public.mk_products set qty = p_qty, updated_at = now() where id = p_id;
  insert into public.mk_stock_moves(product_id, product_name, kind, qty_before, qty_after, diff, cost, note, by_name)
  values (p_id, pr.name, 'adjust', pr.qty, p_qty, p_qty - pr.qty, c, coalesce(p_note, ''), public.mk_me_name());
  perform public.mk_log_add('stock.adjust', pr.name, jsonb_build_object('from', pr.qty, 'to', p_qty));
  return p_qty;
end $$;

create or replace function public.mk_stock_count(p_items jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; pr public.mk_products; v_c numeric; v_cost numeric; v_rows jsonb := '[]'; v_short numeric := 0; v_excess numeric := 0; n int := 0; v_no text; v_id uuid;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'no_items'; end if;
  perform public.mk_lock();
  v_no := 'JR-' || lpad(((select count(*) from public.mk_counts) + 1)::text, 4, '0');
  for it in select * from jsonb_array_elements(p_items) loop
    v_c := (it->>'counted')::numeric;
    if v_c is null or v_c < 0 then continue; end if;
    select * into pr from public.mk_products where id = (it->>'product_id')::uuid for update;
    if not found then continue; end if;
    select coalesce(cost, 0) into v_cost from public.mk_product_costs where product_id = pr.id;
    v_cost := coalesce(v_cost, 0);
    n := n + 1;
    v_rows := v_rows || jsonb_build_object('product_id', pr.id, 'name', pr.name, 'code', pr.code, 'before', pr.qty, 'counted', v_c, 'diff', v_c - pr.qty, 'cost', v_cost);
    if v_c < pr.qty then v_short := v_short + (pr.qty - v_c) * v_cost; elsif v_c > pr.qty then v_excess := v_excess + (v_c - pr.qty) * v_cost; end if;
    if v_c <> pr.qty then
      update public.mk_products set qty = v_c, updated_at = now() where id = pr.id;
      insert into public.mk_stock_moves(product_id, product_name, kind, qty_before, qty_after, diff, cost, note, ref, by_name)
      values (pr.id, pr.name, 'count', pr.qty, v_c, v_c - pr.qty, v_cost, coalesce(p_note, ''), v_no, public.mk_me_name());
    end if;
  end loop;
  if n = 0 then raise exception 'no_items'; end if;
  insert into public.mk_counts(no, note, items, n_items, short_value, excess_value, by_name)
  values (v_no, coalesce(p_note, ''), v_rows, n, round(v_short, 2), round(v_excess, 2), public.mk_me_name()) returning id into v_id;
  perform public.mk_log_add('stock.count', v_no, jsonb_build_object('items', n, 'short', v_short, 'excess', v_excess));
  return jsonb_build_object('id', v_id, 'no', v_no, 'items', n, 'short_value', round(v_short, 2), 'excess_value', round(v_excess, 2), 'rows', v_rows);
end $$;

create or replace function public.mk_bulk_price(p_ids uuid[], p_field text, p_pct numeric, p_round numeric) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; f numeric := 1 + coalesce(p_pct, 0) / 100.0; r numeric := coalesce(p_round, 0);
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  if p_field not in ('price','cost','both') or p_pct is null or f <= 0 then raise exception 'bad_input'; end if;
  if p_field in ('price','both') then
    update public.mk_products set price = case when r > 0 then round(price * f / r) * r else round(price * f, 2) end, updated_at = now() where id = any(p_ids);
    get diagnostics n = row_count;
  end if;
  if p_field in ('cost','both') then
    update public.mk_product_costs set cost = case when r > 0 then round(cost * f / r) * r else round(cost * f, 2) end where product_id = any(p_ids);
    if p_field = 'cost' then get diagnostics n = row_count; end if;
  end if;
  perform public.mk_log_add('price.bulk', p_field || ' ' || p_pct || '%', jsonb_build_object('count', n, 'round', r));
  return n;
end $$;

create or replace function public.mk_day_summary(p_day date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := coalesce(p_day, public.mk_today()); r jsonb; admin boolean := public.mk_is_admin();
  s_cnt int; s_tot numeric; s_paid numeric; s_rem numeric; s_ship numeric; p_tot numeric; p_paid numeric;
  c_in numeric; c_out numeric; ex numeric; rs numeric; rp numeric; profit numeric; n_insta numeric; n_tr numeric; n_open int;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  select count(*), coalesce(sum(total), 0), coalesce(sum(paid), 0), coalesce(sum(rem), 0), coalesce(sum(ship), 0)
    into s_cnt, s_tot, s_paid, s_rem, s_ship from public.mk_invoices where kind = 'sale' and date = d;
  select coalesce(sum(total), 0), coalesce(sum(paid), 0) into p_tot, p_paid from public.mk_invoices where kind = 'purchase' and date = d;
  select coalesce(sum(amount) filter (where dir = 'in'), 0), coalesce(sum(amount) filter (where dir = 'out'), 0) into c_in, c_out
    from public.mk_payments where date = d and note not like 'رصيد %';
  select coalesce(sum(amount), 0) into ex from public.mk_expenses where date = d;
  select coalesce(sum(total) filter (where type = 'sale'), 0), coalesce(sum(total) filter (where type = 'purchase'), 0) into rs, rp
    from public.mk_returns where date = d;
  select coalesce(sum(round(qty * price, 2)) filter (where pay = 'insta'), 0), coalesce(sum(round(qty * price, 2)) filter (where pay = 'transfer'), 0)
    into n_insta, n_tr from public.mk_daybook b where b.day = d and b.posted_at is not null
     and exists (select 1 from public.mk_invoices i where i.id = b.invoice_id);
  select count(*) into n_open from public.mk_daybook where day = d and posted_at is null;
  r := jsonb_build_object(
    'day', d, 'sales_count', s_cnt, 'sales_total', s_tot, 'sales_paid', s_paid, 'sales_credit', s_rem, 'ship', s_ship,
    'collections', c_in, 'purchases_total', p_tot, 'purchases_paid', p_paid, 'supplier_payments', c_out,
    'expenses', ex, 'returns_sale', rs, 'returns_purchase', rp, 'insta', n_insta, 'transfer', n_tr, 'daybook_open', n_open,
    'cash_expected', round(s_paid + c_in - p_paid - c_out - ex - rs + rp - n_insta - n_tr, 2),
    'top_items', coalesce((select jsonb_agg(x) from (
        select ii.product_name as name, sum(ii.qty) as qty, sum(ii.total) as total
          from public.mk_invoice_items ii join public.mk_invoices i on i.id = ii.invoice_id
         where i.kind = 'sale' and i.date = d group by 1 order by 3 desc limit 10) x), '[]'),
    'by_user', coalesce((select jsonb_agg(x) from (
        select created_by_name as name, count(*) as count, sum(total) as total
          from public.mk_invoices where kind = 'sale' and date = d group by 1 order by 3 desc) x), '[]'));
  if admin then
    select coalesce(sum(ii.total - ii.qty * coalesce(ic.cost, 0)), 0) into profit
      from public.mk_invoice_items ii join public.mk_invoices i on i.id = ii.invoice_id left join public.mk_item_costs ic on ic.item_id = ii.id
     where i.kind = 'sale' and i.date = d;
    r := r || jsonb_build_object('profit', round(profit, 2));
  end if;
  return r;
end $$;

create or replace function public.mk_save_closing(p_day date, p_cash_actual numeric, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s jsonb; v public.mk_closings;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  s := public.mk_day_summary(p_day);
  s := s - 'profit';
  insert into public.mk_closings(day, data, cash_expected, cash_actual, cash_diff, note, by_name)
  values ((s->>'day')::date, s, (s->>'cash_expected')::numeric, p_cash_actual,
          case when p_cash_actual is null then null else round(p_cash_actual - (s->>'cash_expected')::numeric, 2) end, coalesce(p_note, ''), public.mk_me_name())
  returning * into v;
  perform public.mk_log_add('day.close', (s->>'day'), jsonb_build_object('expected', v.cash_expected, 'actual', p_cash_actual));
  return to_jsonb(v);
end $$;

-- ---------- يومية المحل ----------
create or replace function public.mk_db_ded(p_committed timestamptz, p_qty numeric, p_owed numeric, p_delivered timestamptz)
returns numeric language sql immutable as $$
  select case when p_committed is null then 0 else p_qty - case when p_delivered is null then p_owed else 0 end end $$;
-- (postgres: بيتنادى من جوه الدوال بس، بـ id صنف من نفس المحل)
create or replace function public.mk_db_stock(p_pid uuid, p_delta numeric) returns void
language sql security definer set search_path = public as $$
  update public.mk_products set qty = qty + p_delta, updated_at = now() where id = p_pid and p_delta <> 0 $$;
-- (postgres: كل دقيقة لكل المحلات)
create or replace function public.mk_daybook_commit_due() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform pg_advisory_xact_lock(7003);
  for r in select * from public.mk_daybook where committed_at is null and posted_at is null and created_at <= now() - interval '5 minutes' for update loop
    if r.product_id is not null then perform public.mk_db_stock(r.product_id, -public.mk_db_ded(now(), r.qty, r.owed, r.delivered_at)); end if;
    update public.mk_daybook set committed_at = now() where id = r.id; n := n + 1;
  end loop;
  return n;
end $$;
create or replace function public.mk_daybook_commit() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  perform public.mk_lock();
  for r in select * from public.mk_daybook where committed_at is null and posted_at is null and created_at <= now() - interval '5 minutes' for update loop
    if r.product_id is not null then perform public.mk_db_stock(r.product_id, -public.mk_db_ded(now(), r.qty, r.owed, r.delivered_at)); end if;
    update public.mk_daybook set committed_at = now() where id = r.id; n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.mk_daybook_add(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.mk_daybook; pid uuid := nullif(p->>'product_id', '')::uuid; nm text := btrim(coalesce(p->>'name', ''));
  q numeric := (p->>'qty')::numeric; pr numeric := coalesce((p->>'price')::numeric, 0); ow numeric := coalesce((p->>'owed')::numeric, 0);
  v_who text := btrim(coalesce(p->>'person', '')); v_pay text := coalesce(nullif(p->>'pay', ''), 'cash'); v_kind text := coalesce(nullif(p->>'kind', ''), 'item');
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  if v_kind not in ('item','pay') then raise exception 'bad_kind'; end if;
  if v_kind = 'pay' then
    if v_who = '' then raise exception 'need_person'; end if;
    if pr <= 0 then raise exception 'bad_amount'; end if;
    if v_pay not in ('cash','insta','transfer') then raise exception 'bad_pay'; end if;
    insert into public.mk_daybook(day, kind, product_id, name, qty, price, owed, person, pay, note, created_by)
    values (coalesce(nullif(p->>'day', '')::date, public.mk_today()), 'pay', null, 'دفعة', 1, pr, 0, v_who, v_pay, btrim(coalesce(p->>'note', '')), public.mk_me_name())
    returning * into v;
    return to_jsonb(v);
  end if;
  if pid is not null then select name into nm from public.mk_products where id = pid; if not found then pid := null; nm := btrim(coalesce(p->>'name', '')); end if; end if;
  if nm = '' then raise exception 'bad_item'; end if;
  if q is null or q <= 0 then raise exception 'bad_qty:%', nm; end if;
  if pr < 0 then raise exception 'bad_amount'; end if;
  if ow < 0 or ow > q then raise exception 'bad_owed'; end if;
  if v_pay not in ('cash','insta','transfer','credit') then raise exception 'bad_pay'; end if;
  if v_pay = 'credit' and v_who = '' then raise exception 'need_person'; end if;
  insert into public.mk_daybook(day, product_id, name, qty, price, owed, person, pay, note, created_by)
  values (coalesce(nullif(p->>'day', '')::date, public.mk_today()), pid, nm, q, pr, ow, v_who, v_pay, btrim(coalesce(p->>'note', '')), public.mk_me_name())
  returning * into v;
  return to_jsonb(v);
end $$;

create or replace function public.mk_daybook_update(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.mk_daybook; v public.mk_daybook; q numeric; pr numeric; ow numeric; v_who text; v_pay text;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  perform public.mk_lock();
  select * into o from public.mk_daybook where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.posted_at is not null then raise exception 'posted'; end if;
  q := coalesce((p->>'qty')::numeric, o.qty); pr := coalesce((p->>'price')::numeric, o.price); ow := coalesce((p->>'owed')::numeric, o.owed);
  v_who := btrim(coalesce(p->>'person', o.person)); v_pay := coalesce(nullif(p->>'pay', ''), o.pay);
  if o.kind = 'pay' then
    q := 1; ow := 0;
    if pr <= 0 then raise exception 'bad_amount'; end if;
    if v_pay = 'credit' then raise exception 'bad_pay'; end if;
    if v_who = '' then raise exception 'need_person'; end if;
  end if;
  if q <= 0 then raise exception 'bad_qty:%', o.name; end if;
  if pr < 0 then raise exception 'bad_amount'; end if;
  if ow < 0 or ow > q then raise exception 'bad_owed'; end if;
  if v_pay not in ('cash','insta','transfer','credit') then raise exception 'bad_pay'; end if;
  if v_pay = 'credit' and v_who = '' then raise exception 'need_person'; end if;
  update public.mk_daybook set qty = q, price = pr, owed = ow, person = v_who, pay = v_pay, note = btrim(coalesce(p->>'note', o.note)),
         delivered_at = case when ow = 0 then null else o.delivered_at end
   where id = p_id returning * into v;
  if o.product_id is not null then
    perform public.mk_db_stock(o.product_id, public.mk_db_ded(o.committed_at, o.qty, o.owed, o.delivered_at) - public.mk_db_ded(v.committed_at, v.qty, v.owed, v.delivered_at));
  end if;
  return to_jsonb(v);
end $$;

create or replace function public.mk_daybook_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.mk_daybook;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  perform public.mk_lock();
  select * into o from public.mk_daybook where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.posted_at is not null then raise exception 'posted'; end if;
  if o.product_id is not null then perform public.mk_db_stock(o.product_id, public.mk_db_ded(o.committed_at, o.qty, o.owed, o.delivered_at)); end if;
  delete from public.mk_daybook where id = p_id;
end $$;

create or replace function public.mk_daybook_deliver(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.mk_daybook; v public.mk_daybook;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  perform public.mk_lock();
  select * into o from public.mk_daybook where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.owed <= 0 or o.delivered_at is not null then return to_jsonb(o); end if;
  update public.mk_daybook set delivered_at = now() where id = p_id returning * into v;
  if o.product_id is not null then
    perform public.mk_db_stock(o.product_id, public.mk_db_ded(coalesce(o.committed_at, o.posted_at), o.qty, o.owed, o.delivered_at) - public.mk_db_ded(coalesce(v.committed_at, v.posted_at), v.qty, v.owed, v.delivered_at));
  end if;
  return to_jsonb(v);
end $$;

create or replace function public.mk_daybook_owed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  return coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from public.mk_daybook b
                    where b.kind = 'item' and b.owed > 0 and b.delivered_at is null), '[]');
end $$;

create or replace function public.mk_daybook_post(p_day date, p_person text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_day, public.mk_today()); g record; r record; items jsonb; paid numeric; cash numeric; insta numeric; tr numeric; cr numeric; tot numeric; pays numeric;
  owed_txt text; note text; inv jsonb; out jsonb := '[]';
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  perform public.mk_lock();
  for g in select person from public.mk_daybook where day = d and posted_at is null and (p_person is null or person = p_person) group by person having count(*) filter (where kind = 'item') > 0 order by min(created_at) loop
    for r in select * from public.mk_daybook where day = d and posted_at is null and person = g.person for update loop
      if r.product_id is not null then perform public.mk_db_stock(r.product_id, public.mk_db_ded(r.committed_at, r.qty, r.owed, r.delivered_at)); end if;
    end loop;
    select jsonb_agg(jsonb_build_object('product_id', product_id, 'name', name, 'qty', qty, 'price', price) order by created_at) filter (where kind = 'item'),
           coalesce(sum(round(qty * price, 2)) filter (where kind = 'item'), 0),
           coalesce(sum(round(qty * price, 2)) filter (where pay <> 'credit'), 0),
           coalesce(sum(round(qty * price, 2)) filter (where kind = 'pay'), 0),
           coalesce(sum(round(qty * price, 2)) filter (where pay = 'cash'), 0), coalesce(sum(round(qty * price, 2)) filter (where pay = 'insta'), 0),
           coalesce(sum(round(qty * price, 2)) filter (where pay = 'transfer'), 0),
           string_agg(case when kind = 'item' and owed > 0 and delivered_at is null then name || ' × ' || owed::text end, '، ')
      into items, tot, paid, pays, cash, insta, tr, owed_txt
      from public.mk_daybook where day = d and posted_at is null and person = g.person;
    if paid > tot + 0.001 then raise exception 'pay_gt_total:%', g.person; end if;
    cr := round(tot - paid, 2);
    note := 'من يومية المحل'
         || case when cash > 0 then ' • نقدي ' || cash::text else '' end || case when insta > 0 then ' • إنستاباي ' || insta::text else '' end
         || case when tr > 0 then ' • تحويل ' || tr::text else '' end || case when pays > 0 then ' (منهم دفعة ' || pays::text || ')' else '' end || case when cr > 0 then ' • آجل ' || cr::text else '' end
         || case when owed_txt is not null then ' • باقي للعميل: ' || owed_txt else '' end;
    inv := public.mk_save_invoice(jsonb_build_object('kind', 'sale', 'person', case when g.person = '' then 'يومية' else g.person end, 'no_contact', g.person = '',
             'date', d, 'paid', paid, 'items', items, 'source', 'daybook', 'note', note));
    for r in select * from public.mk_daybook where day = d and posted_at is null and person = g.person loop
      if r.product_id is not null and r.owed > 0 and r.delivered_at is null then perform public.mk_db_stock(r.product_id, r.owed); end if;
    end loop;
    update public.mk_daybook set posted_at = now(), committed_at = coalesce(committed_at, now()), invoice_id = (inv->>'id')::uuid, invoice_no = inv->>'no'
     where day = d and posted_at is null and person = g.person;
    out := out || jsonb_build_object('person', g.person, 'id', inv->>'id', 'no', inv->>'no');
  end loop;
  return out;
end $$;

create or replace function public.mk_daybook_set_pay(p_id uuid, p_pay text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.mk_daybook; v public.mk_daybook;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  if p_pay not in ('cash','insta','transfer','credit') then raise exception 'bad_pay'; end if;
  select * into o from public.mk_daybook where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.posted_at is not null and (o.pay = 'credit' or p_pay = 'credit') then raise exception 'pay_credit_posted'; end if;
  if o.kind = 'pay' and p_pay = 'credit' then raise exception 'bad_pay'; end if;
  if p_pay = 'credit' and o.person = '' then raise exception 'need_person'; end if;
  update public.mk_daybook set pay = p_pay where id = p_id returning * into v;
  return to_jsonb(v);
end $$;

-- ---------- قراية فواتير الشراء بالصور ----------
create or replace function public.mk_scan_claim() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.mk_scans;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  select * into v from public.mk_scans
   where (status = 'pending' and next_at <= now()) or (status = 'working' and updated_at < now() - interval '4 minutes')
   order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update public.mk_scans set status = 'working', attempts = attempts + 1, updated_at = now() where id = v.id returning * into v;
  return to_jsonb(v);
end $$;
create or replace function public.mk_scan_finish(p_id uuid, p_status text, p_result jsonb, p_error text, p_retry_min int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.mk_scans;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  if p_status not in ('pending','done','failed','used') then raise exception 'bad_status'; end if;
  update public.mk_scans set status = p_status, result = coalesce(p_result, result), error = coalesce(p_error, ''),
         next_at = now() + make_interval(mins => greatest(0, coalesce(p_retry_min, 0))), updated_at = now()
   where id = p_id returning * into v;
  return to_jsonb(v);
end $$;

-- ---------- طلبات الواتساب: الجسر بيبعت بسر المحل ----------
create or replace function public.wa_submit(p_secret text, p_msg_id text, p_phone text, p_name text, p_body text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_org uuid;
begin
  select org into v_org from public.wa_config where secret = p_secret;
  if v_org is null or coalesce(p_secret, '') = '' then raise exception 'forbidden'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'empty'; end if;
  insert into public.wa_orders(org, msg_id, phone, customer_name, body)
  values (v_org, p_msg_id, left(p_phone, 30), left(p_name, 120), left(p_body, 4000))
  on conflict (org, msg_id) do nothing
  returning id into v_id;
  return coalesce(v_id::text, 'duplicate');
end $$;
-- سر الجسر بتاع محلي (المدير بس) — بيتعمل أول مرة يطلبه
create or replace function public.wa_my_secret() returns text
language plpgsql security definer set search_path = public as $$
declare s text; o uuid := public.mk_org();
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  insert into public.wa_config(org) values (o) on conflict (org) do nothing;
  select secret into s from public.wa_config where org = o;
  return s;
end $$;

-- ===== الملكية والصلاحيات =====
do $$
declare f text;
begin
  -- الدوال دي بتشتغل بدور mk_fn (عليه العزل بين المحلات)
  foreach f in array array['mk_log_add(text,text,jsonb)','mk_next_no(text)','mk_contact_for(text,text,text,text)','mk_save_invoice(jsonb)',
    'mk_void_invoice(uuid)','mk_add_payment(uuid,numeric,text)','mk_save_return(jsonb)','mk_backup_now()','mk_rename_contact(uuid,text,text)',
    'mk_adjust_stock(uuid,numeric,text)','mk_stock_count(jsonb,text)','mk_bulk_price(uuid[],text,numeric,numeric)','mk_day_summary(date)',
    'mk_save_closing(date,numeric,text)','mk_daybook_commit()','mk_daybook_add(jsonb)','mk_daybook_update(uuid,jsonb)','mk_daybook_delete(uuid)',
    'mk_daybook_deliver(uuid)','mk_daybook_owed()','mk_daybook_post(date,text)','mk_daybook_set_pay(uuid,text)','mk_scan_claim()',
    'mk_scan_finish(uuid,text,jsonb,text,int)'] loop
    execute format('alter function public.%s owner to mk_fn', f);
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, mk_fn', f);
  end loop;
  -- داخلية: من جوه الدوال بس
  foreach f in array array['mk_contact_for(text,text,text,text)','mk_log_add(text,text,jsonb)'] loop
    execute format('revoke all on function public.%s from authenticated', f);
  end loop;
  foreach f in array array['mk_db_stock(uuid,numeric)','mk_daybook_commit_due()','mk_lock()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to mk_fn', f);
  end loop;
  revoke all on function public.wa_my_secret() from public, anon;
  grant execute on function public.wa_my_secret() to authenticated;
  revoke all on function public.wa_submit(text,text,text,text,text) from public;
  grant execute on function public.wa_submit(text,text,text,text,text) to anon, authenticated;
  grant execute on function public.mk_org(), public.mk_role(), public.mk_is_admin(), public.mk_is_member(), public.mk_me_name(),
    public.mk_org_active(), public.mk_today(), public.mk_ar_date(date), public.mk_tables_on(), public.mk_db_ded(timestamptz,numeric,numeric,timestamptz)
    to authenticated, mk_fn;
end $$;

select 'OK - part C (functions)' as result;

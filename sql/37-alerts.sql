-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 🔔 تنبيهات فورية ضد السرقة والغلط على الواتساب
-- السيرفر نفسه بيراقب (triggers)، فمحدش يقدر يوقفها من السيستم. التنبيه بيتحط في wa_out والجسر بيبعته من رقم المحل.
-- الإعدادات: mk_settings key='alerts' → {on, to:[أرقام], disc:15, short:50, skip_admin:true, types:{void,below,disc,adjust,short,edit,pay}}
create or replace function public.mk_n(n numeric) returns text language sql immutable as
$$ select case when n is null then '0' when n = trunc(n) then trunc(n)::text else round(n, 2)::text end $$;

create or replace function public.mk_alert(p_type text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare c jsonb; t text;
begin
  c := coalesce((select value from public.mk_settings where key = 'alerts'), '{}'::jsonb);
  if coalesce((c->>'on')::boolean, true) = false then return; end if;
  if coalesce((c->'types'->>p_type)::boolean, true) = false then return; end if;
  if coalesce((c->>'skip_admin')::boolean, true) and coalesce(public.mk_is_admin(), false) then return; end if;
  for t in select jsonb_array_elements_text(case when jsonb_typeof(c->'to') = 'array' and jsonb_array_length(c->'to') > 0 then c->'to' else '["201119199659"]'::jsonb end) loop
    insert into public.wa_out(to_phone, body, by_name)
    values (t, '🔔 تنبيه من السيستم' || E'\n' || p_text || E'\n🕒 ' || to_char(now() at time zone 'Africa/Cairo', 'HH24:MI — YYYY/MM/DD'), '🔔 تنبيه تلقائي');
  end loop;
exception when others then null;   -- التنبيه عمره ما يوقف شغل السيستم
end $$;

create or replace function public.mk_me() returns text language sql stable security definer set search_path = public as
$$ select coalesce((select name from public.mk_members where user_id = auth.uid()), '') $$;

-- ١) فاتورة اتلغت
create or replace function public.mk_alert_void() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mk_alert('void', '🗑️ ' || coalesce(nullif(new.by_name, ''), public.mk_me(), 'حد') || ' لغى فاتورة ' || case when new.kind = 'purchase' then 'شراء' else 'بيع' end
    || ' رقم ' || coalesce(new.label, '') || ' بقيمة ' || public.mk_n((new.data->>'total')::numeric) || ' ج'
    || coalesce(E'\nالعميل: ' || nullif(new.data->>'person', ''), '') || coalesce(E'\nكان كاتبها: ' || nullif(new.data->>'created_by_name', ''), ''));
  return null;
exception when others then return null;
end $$;
drop trigger if exists mk_alert_void on public.mk_voided;
create trigger mk_alert_void after insert on public.mk_voided for each row execute function public.mk_alert_void();

-- ٢) بيع بأقل من سعر الشراء + ٣) خصم كبير (رسالة واحدة لكل فاتورة)
create or replace function public.mk_alert_items() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; d numeric; who text := public.mk_me();
begin
  d := coalesce((select (value->>'disc')::numeric from public.mk_settings where key = 'alerts'), 15);
  for r in
    select v.no, v.person, v.edited_at, v.created_by_name,
      string_agg(case when pc.cost > 0 and i.price < pc.cost then '• ' || i.product_name || ' × ' || public.mk_n(i.qty) || ' بـ ' || public.mk_n(i.price) || ' (الشراء ' || public.mk_n(pc.cost) || ')' end, E'\n') as below,
      string_agg(case when p.price > 0 and (pc.cost is null or i.price >= pc.cost) and i.price < p.price * (1 - d / 100)
                      then '• ' || i.product_name || ' بـ ' || public.mk_n(i.price) || ' بدل ' || public.mk_n(p.price) || ' (خصم ' || round((1 - i.price / p.price) * 100) || '%)' end, E'\n') as disc
    from nt i
    join public.mk_invoices v on v.id = i.invoice_id and v.kind = 'sale'
    left join public.mk_products p on p.id = i.product_id
    left join public.mk_product_costs pc on pc.product_id = i.product_id
    group by v.id, v.no, v.person, v.edited_at, v.created_by_name
  loop
    if r.below is not null then
      perform public.mk_alert('below', '⚠️ ' || coalesce(nullif(who, ''), nullif(r.created_by_name, ''), 'حد') || ' باع بأقل من سعر الشراء — فاتورة ' || r.no
        || coalesce(' (' || nullif(r.person, '') || ')', '') || case when r.edited_at is not null then ' بعد تعديل' else '' end || E'\n' || r.below);
    end if;
    if r.disc is not null then
      perform public.mk_alert('disc', '🏷️ ' || coalesce(nullif(who, ''), nullif(r.created_by_name, ''), 'حد') || ' عمل خصم كبير — فاتورة ' || r.no
        || coalesce(' (' || nullif(r.person, '') || ')', '') || E'\n' || r.disc);
    end if;
  end loop;
  return null;
exception when others then return null;
end $$;
drop trigger if exists mk_alert_items on public.mk_invoice_items;
create trigger mk_alert_items after insert on public.mk_invoice_items referencing new table as nt for each statement execute function public.mk_alert_items();

-- ٤) تعديل رصيد صنف يدوي
create or replace function public.mk_alert_adjust() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'adjust' and coalesce(new.diff, 0) <> 0 then
    perform public.mk_alert('adjust', '📦 ' || coalesce(nullif(new.by_name, ''), public.mk_me(), 'حد') || ' عدّل رصيد «' || coalesce(new.product_name, '') || '» يدوي من '
      || public.mk_n(new.qty_before) || ' لـ ' || public.mk_n(new.qty_after) || ' (' || case when new.diff > 0 then '+' else '' end || public.mk_n(new.diff) || ')'
      || coalesce(E'\nالسبب: ' || nullif(new.note, ''), ''));
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists mk_alert_adjust on public.mk_stock_moves;
create trigger mk_alert_adjust after insert on public.mk_stock_moves for each row execute function public.mk_alert_adjust();

-- ٥) عجز (أو زيادة) في الدرج عند التقفيل
create or replace function public.mk_alert_short() returns trigger language plpgsql security definer set search_path = public as $$
declare s numeric;
begin
  s := coalesce((select (value->>'short')::numeric from public.mk_settings where key = 'alerts'), 50);
  if new.cash_diff is not null and abs(new.cash_diff) >= s then
    perform public.mk_alert('short', case when new.cash_diff < 0 then '💵 عجز في الدرج: ' else '💵 زيادة في الدرج: ' end || public.mk_n(abs(new.cash_diff)) || ' ج'
      || E'\nالمفروض ' || public.mk_n(new.cash_expected) || ' والموجود ' || public.mk_n(new.cash_actual)
      || coalesce(E'\nقفّل: ' || nullif(new.by_name, ''), '') || coalesce(E'\nملاحظة: ' || nullif(new.note, ''), ''));
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists mk_alert_short on public.mk_closings;
create trigger mk_alert_short after insert on public.mk_closings for each row execute function public.mk_alert_short();

-- ٦) فاتورة اتعدلت بعد ما اتسجلت
create or replace function public.mk_alert_edit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.edited_at is not null and new.edited_at is distinct from old.edited_at then
    perform public.mk_alert('edit', '✏️ ' || coalesce(nullif(new.edited_by_name, ''), public.mk_me(), 'حد') || ' عدّل فاتورة ' || case when new.kind = 'purchase' then 'شراء' else 'بيع' end || ' ' || new.no
      || coalesce(' (' || nullif(new.person, '') || ')', '')
      || case when old.total is distinct from new.total then E'\nالإجمالي من ' || public.mk_n(old.total) || ' لـ ' || public.mk_n(new.total) else E'\nالإجمالي زي ما هو ' || public.mk_n(new.total) end);
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists mk_alert_edit on public.mk_invoices;
create trigger mk_alert_edit after update on public.mk_invoices for each row execute function public.mk_alert_edit();

-- ٧) دفعة اتمسحت
create or replace function public.mk_alert_pay() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mk_alert('pay', '💸 ' || coalesce(public.mk_me(), 'حد') || ' مسح ' || case when old.dir = 'in' then 'تحصيل' else 'دفعة' end || ' بـ ' || public.mk_n(old.amount) || ' ج'
    || coalesce(' — ' || nullif(old.name, ''), '') || coalesce(E'\n' || nullif(old.note, ''), ''));
  return null;
exception when others then return null;
end $$;
drop trigger if exists mk_alert_pay on public.mk_payments;
create trigger mk_alert_pay after delete on public.mk_payments for each row execute function public.mk_alert_pay();

revoke all on function public.mk_alert(text, text) from public, anon, authenticated;
select 'OK alerts' as result;

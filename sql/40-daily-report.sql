-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 📊 تقرير آخر اليوم على الواتساب (في الميعاد اللي صاحب المحل يختاره)
-- الإعدادات في mk_settings key 'report' = {on, time:'23:30', to:[...], last:'YYYY-MM-DD'}
-- لو الميعاد بعد نص الليل (قبل 6 الصبح) التقرير بيبقى عن اليوم اللي فات.
-- بيتبعت بنفس طريقة التنبيهات (by_name '🔔 تنبيه تلقائي') عشان يتمسح من واتساب المحل ويوصل لصاحب المحل بس.

create or replace function public.mk_daily_report(p_day date) returns text
language plpgsql security definer set search_path = public as $$
declare
  s_cnt int; s_tot numeric; s_paid numeric; s_rem numeric; s_cost numeric; s_items numeric;
  w_tot numeric; p_tot numeric; pay_in numeric; pay_out numeric; ex_tot numeric; ret_tot numeric;
  g_val numeric; g_cnt int; v_cnt int; att_in int; att_late text; low_cnt int; out_list text; top text; ex_list text; debt numeric;
  r text; d0 timestamptz := (p_day::timestamp at time zone 'Africa/Cairo'); d1 timestamptz := ((p_day + 1)::timestamp at time zone 'Africa/Cairo');
begin
  select count(*), coalesce(sum(total), 0), coalesce(sum(paid), 0), coalesce(sum(rem), 0) into s_cnt, s_tot, s_paid, s_rem
    from public.mk_invoices where kind = 'sale' and date = p_day;
  select coalesce(sum(it.total), 0), coalesce(sum(it.qty * coalesce(ic.cost, pc.cost, 0)), 0) into s_items, s_cost
    from public.mk_invoice_items it join public.mk_invoices i on i.id = it.invoice_id
    left join public.mk_item_costs ic on ic.item_id = it.id left join public.mk_product_costs pc on pc.product_id = it.product_id
    where i.kind = 'sale' and i.date = p_day;
  select coalesce(sum(total), 0) into w_tot from public.mk_invoices where kind = 'sale' and date = p_day - 7;
  select coalesce(sum(total), 0) into p_tot from public.mk_invoices where kind = 'purchase' and date = p_day;
  select coalesce(sum(amount) filter (where dir = 'in'), 0), coalesce(sum(amount) filter (where dir = 'out'), 0) into pay_in, pay_out
    from public.mk_payments where date = p_day;
  select coalesce(sum(amount), 0) into ex_tot from public.mk_expenses where date = p_day;
  select string_agg(cat || ' ' || public.mk_n(a) || ' ج', '، ') into ex_list
    from (select cat, sum(amount) a from public.mk_expenses where date = p_day group by cat order by 2 desc limit 4) x;
  select coalesce(sum(total), 0) into ret_tot from public.mk_returns where type = 'sale' and date = p_day;
  select count(*) into v_cnt from public.mk_voided where at >= d0 and at < d1;
  begin
    select count(*), coalesce(sum(qty * price), 0) into g_cnt, g_val from public.mk_gifts where created_at >= d0 and created_at < d1;
  exception when others then g_cnt := 0; g_val := 0; end;
  begin
    select count(*) into att_in from public.mk_attendance where day = p_day and in_at is not null;
    select string_agg(s.name || ' ' || a.late_min || 'د', '، ') into att_late
      from public.mk_attendance a join public.mk_staff s on s.id = a.staff_id where a.day = p_day and a.late_min > 10;
  exception when others then att_in := null; end;
  select string_agg(n || ' (' || public.mk_n(q) || ')', '، ') into top
    from (select it.product_name n, sum(it.qty) q from public.mk_invoice_items it join public.mk_invoices i on i.id = it.invoice_id
          where i.kind = 'sale' and i.date = p_day group by 1 order by 2 desc limit 5) x;
  select count(*) into low_cnt from public.mk_products where qty > 0 and qty <= min;
  select string_agg(name, '، ') into out_list
    from (select p.name from public.mk_products p where p.qty <= 0
            and exists (select 1 from public.mk_invoice_items it join public.mk_invoices i on i.id = it.invoice_id
                        where it.product_id = p.id and i.kind = 'sale' and i.date = p_day) limit 8) x;
  select coalesce(sum(balance), 0) into debt from public.mk_contacts where type = 'عميل' and balance > 0;

  r := '📊 تقرير يوم ' || to_char(p_day, 'DD/MM') || ' — ' || (array['الأحد','الاتنين','التلات','الأربع','الخميس','الجمعة','السبت'])[extract(dow from p_day)::int + 1]
    || E'\n━━━━━━━━━━━━'
    || E'\n🛒 المبيعات: ' || public.mk_n(s_tot) || ' ج (' || s_cnt || ' فاتورة)'
    || case when w_tot > 0 then ' ' || case when s_tot >= w_tot then '📈 +' else '📉 ' end || public.mk_n(round((s_tot - w_tot) / w_tot * 100)) || '% عن نفس اليوم الأسبوع اللي فات' else '' end
    || E'\n💵 اتقبض كاش: ' || public.mk_n(s_paid) || ' ج' || case when s_rem > 0 then ' · آجل ' || public.mk_n(s_rem) || ' ج' else '' end
    || E'\n💰 المكسب التقريبي: ' || public.mk_n(s_items - s_cost) || ' ج' || case when s_items > 0 then ' (' || public.mk_n(round((s_items - s_cost) / s_items * 100)) || '%)' else '' end
    || case when pay_in > 0 then E'\n📥 تحصيلات من عملاء: ' || public.mk_n(pay_in) || ' ج' else '' end
    || case when p_tot > 0 then E'\n📦 مشتريات: ' || public.mk_n(p_tot) || ' ج' else '' end
    || case when pay_out > 0 then E'\n📤 سداد لموردين: ' || public.mk_n(pay_out) || ' ج' else '' end
    || case when ex_tot > 0 then E'\n🧾 مصروفات: ' || public.mk_n(ex_tot) || ' ج' || coalesce(' (' || ex_list || ')', '') else '' end
    || case when ret_tot > 0 then E'\n↩️ مرتجعات: ' || public.mk_n(ret_tot) || ' ج' else '' end
    || E'\n💼 صافي الدرج المتوقع: ' || public.mk_n(s_paid + pay_in - pay_out - ex_tot - ret_tot) || ' ج'
    || coalesce(E'\n━━━━━━━━━━━━\n🏆 الأكتر بيعاً: ' || top, '')
    || coalesce(E'\n🚫 خلص النهارده: ' || out_list, '')
    || case when low_cnt > 0 then E'\n⚠️ ' || low_cnt || ' صنف قرب يخلص' else '' end
    || case when g_cnt > 0 then E'\n🎁 هدايا: ' || g_cnt || ' (بقيمة ' || public.mk_n(g_val) || ' ج)' else '' end
    || case when v_cnt > 0 then E'\n🗑️ فواتير اتلغت: ' || v_cnt else '' end
    || case when att_in is not null and (att_in > 0 or att_late is not null) then E'\n👷 الحضور: ' || att_in || ' موظف' || coalesce(' · متأخرين: ' || att_late, '') else '' end
    || case when debt > 0 then E'\n📒 فلوسك برّه عند العملاء: ' || public.mk_n(debt) || ' ج' else '' end
    || E'\n━━━━━━━━━━━━\nتصبح على خير 🌙 — ميكانيزم';
  return r;
end $$;

-- بيتنادى كل 5 دقايق: لو جه الميعاد ولسه مااتبعتش النهارده → ابعت
create or replace function public.mk_report_tick() returns void
language plpgsql security definer set search_path = public as $$
declare c jsonb; now_c timestamp := now() at time zone 'Africa/Cairo'; t time; d date; body text; ph text; k text;
begin
  c := coalesce((select value from public.mk_settings where key = 'report'), '{}'::jsonb);
  if coalesce((c->>'on')::boolean, false) = false then return; end if;
  t := coalesce(nullif(c->>'time', ''), '23:30')::time;
  if t >= '06:00' then
    if now_c::time >= t then d := now_c::date;
    elsif now_c::time < '06:00' then d := now_c::date - 1;   -- عدّى نص الليل والتقرير لسه مااتبعتش
    else return; end if;
  else
    if now_c::time >= t and now_c::time < '12:00' then d := now_c::date - 1; else return; end if;
  end if;
  k := d::text;
  if c->>'last' = k then return; end if;
  body := public.mk_daily_report(d);
  for ph in select jsonb_array_elements_text(case when jsonb_typeof(c->'to') = 'array' and jsonb_array_length(c->'to') > 0 then c->'to'
              else coalesce((select value->'to' from public.mk_settings where key = 'alerts'), '["201119199659"]'::jsonb) end) loop
    insert into public.wa_out(to_phone, body, by_name) values (ph, body, '🔔 تنبيه تلقائي');
  end loop;
  update public.mk_settings set value = c || jsonb_build_object('last', k), updated_at = now() where key = 'report';
end $$;

-- للمدير: معاينة أو إرسال تجربة دلوقتي
create or replace function public.mk_report_preview(p_day date) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.mk_is_admin() then raise exception 'للمدير بس'; end if;
  return public.mk_daily_report(coalesce(p_day, (now() at time zone 'Africa/Cairo')::date));
end $$;

revoke all on function public.mk_daily_report(date), public.mk_report_tick() from public, anon, authenticated;
revoke all on function public.mk_report_preview(date) from public, anon;
grant execute on function public.mk_report_preview(date) to authenticated;

insert into public.mk_settings(key, value) values ('report', '{"on":true,"time":"23:30"}'::jsonb) on conflict (key) do nothing;

create extension if not exists pg_cron;
select cron.schedule('mk-daily-report', '*/5 * * * *', 'select public.mk_report_tick()');
select 'OK report' as result;

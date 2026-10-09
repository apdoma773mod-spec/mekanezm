-- Mekanix (rzvncstjattlklpdtkfn) — نقل الإضافات الجديدة من سيستم ميكانيزم للمشتركين، بعزل كامل بين المحلات (org + z_org + دوال بدور mk_fn)
-- الهدايا + الدرجة التانية + التكلفة التقديرية + العمالة والحضور QR والمرتبات + تقرير اليوم (جوه الأبلكيشن)
create or replace function public.mk_n(n numeric) returns text language sql immutable as
$$ select case when n is null then '0' when n = trunc(n) then trunc(n)::text else round(n, 2)::text end $$;
create or replace function public.mk_me() returns text language sql stable security definer set search_path = public as
$$ select coalesce((select name from public.mk_members where user_id = auth.uid()), '') $$;
-- تنبيهات الواتساب مش متاحة للمشتركين لسه: الدالة موجودة بس مابتعملش حاجة
create or replace function public.mk_alert(p_type text, p_text text) returns void language plpgsql as $$ begin return; end $$;
-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 🎁 هدايا الصنايعية + ⚠️ البضاعة المخربشة (درجة تانية) + التكلفة التقديرية للبضاعة القديمة
-- كل حركة بتخصم من المخزن على السيرفر (مرة واحدة ومضمونة) وبتتسجل في حركة الصنف.

-- ========== 🎁 الهدايا ==========
create table if not exists public.mk_gifts(
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_id uuid references public.mk_products(id) on delete set null,
  product_name text not null default '',
  qty numeric not null default 0,
  cost numeric not null default 0,          -- تكلفة الوحدة وقت الهدية
  price numeric not null default 0,         -- سعر البيع وقت الهدية
  to_name text not null default '',
  to_phone text not null default '',
  to_kind text not null default 'صنايعي',   -- صنايعي / مساعد صنايعي / مهندس / عميل / أخرى
  note text not null default '',
  by_name text not null default '');
create index if not exists mk_gifts_at on public.mk_gifts(created_at desc);
create index if not exists mk_gifts_to on public.mk_gifts(to_phone);
alter table public.mk_gifts enable row level security;
revoke all on public.mk_gifts from anon;
grant select, delete on public.mk_gifts to authenticated;
drop policy if exists mk_gifts_sel on public.mk_gifts;
create policy mk_gifts_sel on public.mk_gifts for select to authenticated using (public.mk_is_member());
drop policy if exists mk_gifts_del on public.mk_gifts;
create policy mk_gifts_del on public.mk_gifts for delete to authenticated using (public.mk_is_admin());

create or replace function public.mk_gift(p_product uuid, p_qty numeric, p_to text, p_phone text, p_kind text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; c numeric; gid uuid; who text := public.mk_me();
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'اكتب الكمية'; end if;
  if coalesce(btrim(p_to), '') = '' then raise exception 'اكتب اسم اللي خد الهدية'; end if;
  select * into p from public.mk_products where id = p_product for update;
  if not found then raise exception 'الصنف مش موجود'; end if;
  if p.qty < p_qty then raise exception 'الرصيد % بس', p.qty; end if;
  c := coalesce((select cost from public.mk_product_costs where product_id = p.id), 0);
  update public.mk_products set qty = qty - p_qty, updated_at = now() where id = p.id;
  insert into public.mk_stock_moves(product_id, product_name, kind, qty_before, qty_after, diff, cost, note, ref, by_name)
  values (p.id, p.name, 'adjust', p.qty, p.qty - p_qty, -p_qty, c, '🎁 هدية لـ ' || p_to || coalesce(' (' || nullif(p_kind, '') || ')', ''), 'gift', who);
  insert into public.mk_gifts(product_id, product_name, qty, cost, price, to_name, to_phone, to_kind, note, by_name)
  values (p.id, p.name, p_qty, c, p.price, btrim(p_to), btrim(coalesce(p_phone, '')), coalesce(nullif(p_kind, ''), 'صنايعي'), coalesce(p_note, ''), who)
  returning id into gid;
  perform public.mk_alert('gift', '🎁 ' || coalesce(nullif(who, ''), 'حد') || ' ادّى هدية: ' || p.name || ' × ' || public.mk_n(p_qty)
    || E'\nلـ ' || p_to || coalesce(' (' || nullif(p_kind, '') || ')', '') || coalesce(' — ' || nullif(p_phone, ''), '')
    || E'\nقيمتها بسعر البيع ' || public.mk_n(p.price * p_qty) || ' ج' || coalesce(E'\n' || nullif(p_note, ''), ''));
  return gid;
end $$;

-- ========== ⚠️ درجة تانية (مخربش / متجرح) ==========
-- بينقل كمية من الصنف لصنف «درجة تانية» مرتبط بيه (بيتعمل أول مرة بكود جديد وسعر أقل)
create or replace function public.mk_grade_move(p_product uuid, p_qty numeric, p_price numeric, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; t record; tid uuid; c numeric; mx int; who text := public.mk_me(); g text; nm text;
begin
  if not public.mk_is_admin() then raise exception 'للمدير بس'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'اكتب الكمية'; end if;
  select * into p from public.mk_products where id = p_product for update;
  if not found then raise exception 'الصنف مش موجود'; end if;
  if p.qty < p_qty then raise exception 'الرصيد % بس', p.qty; end if;
  c := coalesce((select cost from public.mk_product_costs where product_id = p.id), 0);
  g := coalesce(nullif((select grp from public.mk_product_info where product_id = p.id), ''), p.name);
  nm := p.name || ' (درجة تانية)';
  select * into t from public.mk_products where name = nm limit 1;
  if not found then
    select coalesce(max((substring(code from '^P(\d+)$'))::int), 0) into mx from public.mk_products where code ~ '^P\d+$';
    insert into public.mk_products(code, name, cat, unit, qty, price, min, barcode)
    values ('P' || lpad((mx + 1)::text, 4, '0'), nm, p.cat, p.unit, 0, coalesce(nullif(p_price, 0), round(p.price * 0.75)), 0, '')
    returning * into t;
    if c > 0 then insert into public.mk_product_costs(product_id, cost) values (t.id, c) on conflict (product_id) do update set cost = excluded.cost; end if;
    insert into public.mk_product_info(product_id, grp, finish, specs) values (t.id, g, 'درجة تانية — مخربش / متجرح', 'فيه خدوش أو جروح بسيطة في الشكل، وشغال تمام')
    on conflict (product_id) do update set grp = excluded.grp, finish = excluded.finish;
    insert into public.mk_product_info(product_id, grp) values (p.id, g) on conflict (product_id) do update set grp = case when public.mk_product_info.grp = '' then excluded.grp else public.mk_product_info.grp end;
  elsif coalesce(p_price, 0) > 0 then
    update public.mk_products set price = p_price where id = t.id;
  end if;
  update public.mk_products set qty = qty - p_qty, updated_at = now() where id = p.id;
  update public.mk_products set qty = qty + p_qty, updated_at = now() where id = t.id;
  insert into public.mk_stock_moves(product_id, product_name, kind, qty_before, qty_after, diff, cost, note, ref, by_name) values
    (p.id, p.name, 'adjust', p.qty, p.qty - p_qty, -p_qty, c, '⚠️ اتنقل لدرجة تانية (مخربش)' || coalesce(' — ' || nullif(p_note, ''), ''), 'grade', who),
    (t.id, t.name, 'adjust', t.qty, t.qty + p_qty, p_qty, c, '⚠️ جه من الصنف الأصلي (مخربش)' || coalesce(' — ' || nullif(p_note, ''), ''), 'grade', who);
  return t.id;
end $$;

-- ========== 💰 التكلفة التقديرية (بضاعة قديمة مش فاكر سعر شرائها) ==========
alter table public.mk_product_info add column if not exists cost_est boolean not null default false;

revoke all on function public.mk_gift(uuid, numeric, text, text, text, text), public.mk_grade_move(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.mk_gift(uuid, numeric, text, text, text, text), public.mk_grade_move(uuid, numeric, numeric, text) to authenticated;


-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 👷 العمالة: ملف الموظف + الحضور بالـ QR + المرتبات والسلف
-- الحضور: شاشة المحل بتعرض QR بيتغير كل 30 ثانية، الموظف يصوّره من موبايله (وهو داخل بحسابه) فيتسجل حضوره/انصرافه
-- (الصورة القديمة للكود مابتنفعش — عشان محدش يسجل لزميله من البيت). والمدير يقدر يسجل يدوي.

create table if not exists public.mk_staff(
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null default '',
  job text not null default '',
  nid text not null default '',                       -- الرقم القومي (اختياري)
  address text not null default '',
  pay_type text not null default 'month' check (pay_type in ('month','week','day')),
  salary numeric not null default 0,                  -- المرتب الشهري / الأسبوعي / اليومية
  shift_start time not null default '10:00',
  shift_end time not null default '22:00',
  off_day int not null default 5,                     -- يوم الأجازة (0 الأحد .. 5 الجمعة .. 6 السبت)، -1 مفيش
  start_date date not null default current_date,
  user_id uuid references auth.users(id) on delete set null,   -- لو ليه حساب على السيستم (عشان يسجل بالـ QR)
  active boolean not null default true,
  note text not null default '');

create table if not exists public.mk_attendance(
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.mk_staff(id) on delete cascade,
  day date not null,
  in_at timestamptz,
  out_at timestamptz,
  late_min int not null default 0,
  method text not null default 'qr',
  note text not null default '',
  by_name text not null default '',
  unique (staff_id, day));
create index if not exists mk_att_day on public.mk_attendance(day desc);

create table if not exists public.mk_staff_moves(
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  staff_id uuid not null references public.mk_staff(id) on delete cascade,
  kind text not null check (kind in ('advance','bonus','deduct','pay')),   -- سلفة / مكافأة / خصم / قبض مرتب
  amount numeric not null default 0,
  month text not null default to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM'),
  note text not null default '',
  by_name text not null default '');
create index if not exists mk_smoves_staff on public.mk_staff_moves(staff_id, month);

create table if not exists public.mk_punch_codes(
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  code text primary key,
  exp timestamptz not null);

alter table public.mk_staff enable row level security;
alter table public.mk_attendance enable row level security;
alter table public.mk_staff_moves enable row level security;
alter table public.mk_punch_codes enable row level security;
revoke all on public.mk_staff, public.mk_attendance, public.mk_staff_moves, public.mk_punch_codes from anon;
revoke all on public.mk_punch_codes from authenticated;
grant select, insert, update, delete on public.mk_staff, public.mk_attendance, public.mk_staff_moves to authenticated;

-- المدير بيشوف ويعدل كل حاجة؛ الموظف بيشوف ملفه وحضوره وحركاته هو بس
drop policy if exists mk_staff_all on public.mk_staff;
create policy mk_staff_all on public.mk_staff for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
drop policy if exists mk_staff_me on public.mk_staff;
create policy mk_staff_me on public.mk_staff for select to authenticated using (user_id = auth.uid());
drop policy if exists mk_att_all on public.mk_attendance;
create policy mk_att_all on public.mk_attendance for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
drop policy if exists mk_att_me on public.mk_attendance;
create policy mk_att_me on public.mk_attendance for select to authenticated using (staff_id in (select id from public.mk_staff where user_id = auth.uid()));
drop policy if exists mk_smoves_all on public.mk_staff_moves;
create policy mk_smoves_all on public.mk_staff_moves for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
drop policy if exists mk_smoves_me on public.mk_staff_moves;
create policy mk_smoves_me on public.mk_staff_moves for select to authenticated using (staff_id in (select id from public.mk_staff where user_id = auth.uid()));

-- كود QR جديد لشاشة المحل (صالح 45 ثانية)
create or replace function public.mk_punch_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  delete from public.mk_punch_codes where exp < now() - interval '5 minutes';
  c := substr(md5(random()::text || clock_timestamp()::text || coalesce(auth.uid()::text, '')), 1, 18);
  insert into public.mk_punch_codes(code, exp) values (c, now() + interval '45 seconds');
  return c;
end $$;

-- الموظف صوّر الكود: أول مرة في اليوم = حضور، بعدها = انصراف
create or replace function public.mk_punch(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s record; a record; d date := (now() at time zone 'Africa/Cairo')::date; late int := 0; t timestamptz := now();
begin
  if not exists (select 1 from public.mk_punch_codes where code = p_code and exp > now()) then
    raise exception 'الكود خلص — صوّر الكود اللي على شاشة المحل دلوقتي';
  end if;
  select * into s from public.mk_staff where user_id = auth.uid() and active limit 1;
  if not found then raise exception 'حسابك مش مربوط بملف موظف — كلم صاحب المحل'; end if;
  select * into a from public.mk_attendance where staff_id = s.id and day = d;
  if not found then
    late := greatest(0, floor(extract(epoch from ((t at time zone 'Africa/Cairo')::time - s.shift_start)) / 60)::int);
    if late > 600 then late := 0; end if;
    insert into public.mk_attendance(staff_id, day, in_at, late_min, method, by_name) values (s.id, d, t, late, 'qr', s.name);
    perform public.mk_alert('staff', '👷 ' || s.name || ' وصل المحل ' || to_char(t at time zone 'Africa/Cairo', 'HH12:MI') ||
      case when late > 10 then E'\n⏰ متأخر ' || late || ' دقيقة' else ' ✅' end);
    return jsonb_build_object('kind', 'in', 'name', s.name, 'late', late, 'at', t);
  end if;
  if a.in_at > t - interval '2 minutes' then raise exception 'اتسجل حضورك من شوية'; end if;
  update public.mk_attendance set out_at = t where id = a.id;
  perform public.mk_alert('staff', '👷 ' || s.name || ' مشي من المحل ' || to_char(t at time zone 'Africa/Cairo', 'HH12:MI')
    || ' (اشتغل ' || floor(extract(epoch from (t - a.in_at)) / 3600)::int || ' ساعة و' || (floor(extract(epoch from (t - a.in_at)) / 60)::int % 60) || ' دقيقة)');
  return jsonb_build_object('kind', 'out', 'name', s.name, 'at', t);
end $$;

-- قبض المرتب: بيتسجل في حركات الموظف وفي المصروفات (بند مرتبات) عشان المكسب يتحسب صح
create or replace function public.mk_staff_pay(p_staff uuid, p_amount numeric, p_month text, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s record; mid uuid; who text := public.mk_me();
begin
  if not public.mk_is_admin() then raise exception 'للمدير بس'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'اكتب المبلغ'; end if;
  select * into s from public.mk_staff where id = p_staff;
  if not found then raise exception 'الموظف مش موجود'; end if;
  insert into public.mk_staff_moves(staff_id, kind, amount, month, note, by_name) values (s.id, 'pay', p_amount, p_month, coalesce(p_note, ''), who) returning id into mid;
  insert into public.mk_expenses(note, cat, amount, date, date_txt, created_by_name)
  values ('مرتب ' || s.name || ' — ' || p_month || coalesce(' — ' || nullif(p_note, ''), ''), 'مرتبات', p_amount, (now() at time zone 'Africa/Cairo')::date,
          to_char(now() at time zone 'Africa/Cairo', 'YYYY/MM/DD'), who);
  return mid;
end $$;

-- السلفة كمان بتطلع من الدرج فبتتسجل مصروف (بند سلف)
create or replace function public.mk_staff_advance(p_staff uuid, p_amount numeric, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s record; mid uuid; who text := public.mk_me();
begin
  if not public.mk_is_admin() then raise exception 'للمدير بس'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'اكتب المبلغ'; end if;
  select * into s from public.mk_staff where id = p_staff;
  if not found then raise exception 'الموظف مش موجود'; end if;
  insert into public.mk_staff_moves(staff_id, kind, amount, note, by_name) values (s.id, 'advance', p_amount, coalesce(p_note, ''), who) returning id into mid;
  insert into public.mk_expenses(note, cat, amount, date, date_txt, created_by_name)
  values ('سلفة ' || s.name || coalesce(' — ' || nullif(p_note, ''), ''), 'سلف موظفين', p_amount, (now() at time zone 'Africa/Cairo')::date,
          to_char(now() at time zone 'Africa/Cairo', 'YYYY/MM/DD'), who);
  return mid;
end $$;

revoke all on function public.mk_punch_code(), public.mk_punch(text), public.mk_staff_pay(uuid, numeric, text, text), public.mk_staff_advance(uuid, numeric, text) from public, anon;
grant execute on function public.mk_punch_code(), public.mk_punch(text), public.mk_staff_pay(uuid, numeric, text, text), public.mk_staff_advance(uuid, numeric, text) to authenticated;


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
    || E'\n━━━━━━━━━━━━\nتصبح على خير 🌙 — ' || coalesce((select name from public.mk_orgs where id = public.mk_org()), '');
  return r;
end $$;


-- للمدير: معاينة أو إرسال تجربة دلوقتي
create or replace function public.mk_report_preview(p_day date) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.mk_is_admin() then raise exception 'للمدير بس'; end if;
  return public.mk_daily_report(coalesce(p_day, (now() at time zone 'Africa/Cairo')::date));
end $$;


-- ===== العزل بين المحلات على الجداول الجديدة =====
do $$
declare t text;
begin
  foreach t in array array['mk_gifts','mk_staff','mk_attendance','mk_staff_moves','mk_punch_codes'] loop
    execute format('grant all on public.%I to mk_fn', t);
    execute format('drop policy if exists z_org on public.%I', t);
    execute format('drop policy if exists mk_fn_all on public.%I', t);
    execute format('create policy z_org on public.%I as restrictive for all to public using (org = (select public.mk_org())) with check (org = (select public.mk_org()) and (select public.mk_org_active()))', t);
    execute format('create policy mk_fn_all on public.%I for all to mk_fn using (true) with check (true)', t);
  end loop;
end $$;
create index if not exists mk_gifts_org on public.mk_gifts(org);
create index if not exists mk_staff_org on public.mk_staff(org);
create index if not exists mk_att_org on public.mk_attendance(org, day);

-- ===== الدوال بدور mk_fn (عليه العزل) =====
do $$
declare f text;
begin
  foreach f in array array['mk_gift(uuid,numeric,text,text,text,text)','mk_grade_move(uuid,numeric,numeric,text)','mk_punch_code()','mk_punch(text)',
    'mk_staff_pay(uuid,numeric,text,text)','mk_staff_advance(uuid,numeric,text)','mk_daily_report(date)','mk_report_preview(date)','mk_alert(text,text)'] loop
    execute format('alter function public.%s owner to mk_fn', f);
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, mk_fn', f);
  end loop;
  execute 'revoke all on function public.mk_daily_report(date) from authenticated';
  execute 'grant execute on function public.mk_n(numeric), public.mk_me() to authenticated, mk_fn';
end $$;
select 'OK app port' as result;
-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 👷 العمالة: ملف الموظف + الحضور بالـ QR + المرتبات والسلف
-- الحضور: شاشة المحل بتعرض QR بيتغير كل 30 ثانية، الموظف يصوّره من موبايله (وهو داخل بحسابه) فيتسجل حضوره/انصرافه
-- (الصورة القديمة للكود مابتنفعش — عشان محدش يسجل لزميله من البيت). والمدير يقدر يسجل يدوي.

create table if not exists public.mk_staff(
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
select 'OK staff' as result;

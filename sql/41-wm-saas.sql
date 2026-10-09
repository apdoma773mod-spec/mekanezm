-- WOODMASTER PRO — أبلكيشن باشتراك (على نفس مشروع ميكانيكس rzvncstjattlklpdtkfn، بجداول منفصلة wm_*)
-- كل مصنع/ورشة ليه صف بياناته (wm_state) + اشتراكه (wm_subs). تجربة مجانية وبعدها الكتابة بتتقفل من السيرفر لحد التفعيل.
-- الأدمن = نفس جدول app_admins.

insert into public.app_config(key, value) values ('wm_trial_days', '7'::jsonb) on conflict do nothing;

create table if not exists public.wm_subs(
  owner uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  shop text not null default '',
  phone text not null default '',
  city text not null default '',
  created_at timestamptz not null default now(),
  trial_end timestamptz not null default now() + interval '7 days',
  paid_until timestamptz,
  blocked boolean not null default false,
  note text not null default '',
  last_seen timestamptz,
  src text not null default '');

create table if not exists public.wm_state(
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now());

alter table public.wm_subs enable row level security;
alter table public.wm_state enable row level security;
revoke all on public.wm_subs, public.wm_state from anon;
grant select on public.wm_subs to authenticated;
grant select, insert, update on public.wm_state to authenticated;

create or replace function public.wm_active(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select not s.blocked and (now() < s.trial_end or (s.paid_until is not null and now() < s.paid_until))
                   from wm_subs s where s.owner = p), false)
      or exists(select 1 from auth.users u join app_admins a on lower(a.email) = lower(u.email) where u.id = p);
$$;

drop policy if exists wst_sel on public.wm_state;
drop policy if exists wst_ins on public.wm_state;
drop policy if exists wst_upd on public.wm_state;
create policy wst_sel on public.wm_state for select to authenticated using (owner = auth.uid());
create policy wst_ins on public.wm_state for insert to authenticated with check (owner = auth.uid() and public.wm_active(auth.uid()));
create policy wst_upd on public.wm_state for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid() and public.wm_active(auth.uid()));
drop policy if exists wsub_sel on public.wm_subs;
create policy wsub_sel on public.wm_subs for select to authenticated using (owner = auth.uid() or public.app_is_admin());

-- حالة اشتراكي (وبيعمل اشتراك تجريبي أول مرة)
create or replace function public.wm_my_sub(p_name text default null, p_shop text default null, p_phone text default null, p_city text default null, p_src text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s wm_subs; adm boolean := public.app_is_admin(); st text; d int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select coalesce((value)::text::int, 7) into d from app_config where key = 'wm_trial_days';
  insert into wm_subs(owner, email, trial_end, src) values (auth.uid(), coalesce(auth.jwt()->>'email',''), now() + make_interval(days => coalesce(d, 7)), coalesce(p_src, ''))
    on conflict (owner) do nothing;
  update wm_subs set last_seen = now(),
    name = case when coalesce(p_name,'') <> '' then left(p_name,120) else name end,
    shop = case when coalesce(p_shop,'') <> '' then left(p_shop,120) else shop end,
    phone = case when coalesce(p_phone,'') <> '' then left(p_phone,40) else phone end,
    city = case when coalesce(p_city,'') <> '' then left(p_city,60) else city end
  where owner = auth.uid() returning * into s;
  st := case when adm then 'admin' when s.blocked then 'blocked'
             when s.paid_until is not null and now() < s.paid_until then 'active'
             when now() < s.trial_end then 'trial' else 'expired' end;
  return jsonb_build_object('status', st, 'trial_end', s.trial_end, 'paid_until', s.paid_until, 'email', s.email, 'name', s.name, 'shop', s.shop, 'admin', adm,
    'days_left', greatest(0, ceil(extract(epoch from (case when st = 'active' then s.paid_until else s.trial_end end) - now()) / 86400))::int);
end $$;

-- لوحة الأدمن
create or replace function public.wm_admin_list() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select s.*, st.updated_at,
      coalesce(jsonb_array_length(st.data->'d'->'proj'), 0) as projects,
      coalesce(jsonb_array_length(st.data->'d'->'cust'), 0) as customers,
      coalesce(jsonb_array_length(st.data->'d'->'qt'), 0) as quotes,
      coalesce(pg_column_size(st.data), 0) as bytes
    from wm_subs s left join wm_state st on st.owner = s.owner) x), '[]'::jsonb);
end $$;

create or replace function public.wm_admin_set(p_owner uuid, p_days int default null, p_blocked boolean default null, p_note text default null, p_until timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s wm_subs;
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  update wm_subs set
    paid_until = case when p_until is not null then p_until when p_days is null then paid_until when p_days <= 0 then null
                      else greatest(coalesce(paid_until, now()), now()) + make_interval(days => p_days) end,
    blocked = coalesce(p_blocked, blocked), note = coalesce(p_note, note)
  where owner = p_owner returning * into s;
  if s.owner is null then raise exception 'not_found'; end if;
  return to_jsonb(s);
end $$;

-- الأدمن يمسح اشتراك وبيانات وود ماستر بتاعة حد (من غير ما يمس حسابه في ميكانيكس لو عنده)
create or replace function public.wm_admin_delete(p_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  if exists (select 1 from auth.users u join app_admins a on lower(a.email) = lower(u.email) where u.id = p_owner) then raise exception 'مينفعش تمسح حساب أدمن'; end if;
  delete from wm_state where owner = p_owner;
  delete from wm_subs where owner = p_owner;
end $$;

-- المستخدم يمسح بياناته بنفسه (مطلوب لجوجل بلاي)
create or replace function public.wm_delete_me() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from wm_state where owner = auth.uid();
  update wm_subs set blocked = true, note = trim(note || ' [طلب حذف ' || to_char(now(), 'YYYY-MM-DD') || ']') where owner = auth.uid();
end $$;

-- التسجيل: لو جاي من وود ماستر (app=wm) يتعمله اشتراك وود ماستر بس، من غير محل ميكانيكس
create or replace function public.app_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int; o uuid; shop text := btrim(coalesce(new.raw_user_meta_data->>'shop', '')); ph text := btrim(coalesce(new.raw_user_meta_data->>'phone', ''));
begin
  if coalesce(new.raw_user_meta_data->>'staff', '') = 'true' then return new; end if;
  if coalesce(new.raw_user_meta_data->>'app', '') = 'wm' then
    select coalesce((value)::text::int, 7) into d from app_config where key = 'wm_trial_days';
    insert into wm_subs(owner, email, name, shop, phone, city, trial_end, src)
    values (new.id, coalesce(new.email,''), btrim(coalesce(new.raw_user_meta_data->>'name','')), shop, ph, btrim(coalesce(new.raw_user_meta_data->>'city','')),
            now() + make_interval(days => coalesce(d,7)), coalesce(new.raw_user_meta_data->>'src',''))
    on conflict (owner) do nothing;
    return new;
  end if;
  select coalesce((value)::text::int, 7) into d from app_config where key = 'trial_days';
  insert into app_subs(owner, email, shop, phone, trial_end)
  values (new.id, coalesce(new.email,''), shop, ph, now() + make_interval(days => coalesce(d,7)))
  on conflict (owner) do nothing;
  insert into mk_orgs(name, owner) values (shop, new.id) on conflict (owner) do nothing returning id into o;
  if o is not null then
    insert into mk_members(user_id, org, name, role, email)
    values (new.id, o, coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), 'المدير'), 'admin', new.email)
    on conflict (user_id) do nothing;
    insert into mk_settings(org, key, value) values (o, 'company', jsonb_build_object('name', shop, 'phone', ph, 'address', '', 'ownerPhone', ph))
    on conflict (org, key) do nothing;
  end if;
  return new;
end $$;

-- لو دالة التسجيل مملوكة للدور mk_fn (من غير bypassrls) لازم يقدر يكتب في wm_subs
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'mk_fn') then
    execute 'grant select, insert on public.wm_subs to mk_fn';
    execute 'drop policy if exists wsub_fn on public.wm_subs';
    execute 'create policy wsub_fn on public.wm_subs for all to mk_fn using (true) with check (true)';
  end if;
end $$;

revoke all on function public.wm_my_sub(text,text,text,text,text), public.wm_admin_list(), public.wm_admin_set(uuid,int,boolean,text,timestamptz), public.wm_admin_delete(uuid), public.wm_delete_me() from anon, public;
grant execute on function public.wm_my_sub(text,text,text,text,text), public.wm_admin_list(), public.wm_admin_set(uuid,int,boolean,text,timestamptz), public.wm_admin_delete(uuid), public.wm_delete_me() to authenticated;
grant execute on function public.wm_active(uuid) to authenticated;
select 'OK woodmaster saas' as result;

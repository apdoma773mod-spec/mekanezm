-- Islam Transfer — المزامنة بين الأجهزة + الصلاحيات من السيرفر (على مشروع rzvncstjattlklpdtkfn بجداول it_*)
-- الحركات (events) مابتتعدلش ولا بتتمسح؛ كل جهاز بيرفع حركاته ويسحب حركات الباقيين. نفس الحركة مرتين = مرة واحدة (id).

create table if not exists public.it_orgs(
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  owner uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now());

create table if not exists public.it_members(
  org uuid not null references public.it_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'operator',
  perms jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (org, user_id));
create unique index if not exists it_members_user on public.it_members(user_id);

create table if not exists public.it_invites(
  code text primary key,
  org uuid not null references public.it_orgs(id) on delete cascade,
  role text not null default 'operator',
  perms jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid, used_at timestamptz);

create table if not exists public.it_events(
  seq bigserial,
  org uuid not null references public.it_orgs(id) on delete cascade,
  id text primary key,
  n bigint not null default 0,
  t timestamptz not null,
  type text not null,
  d jsonb not null default '{}'::jsonb,
  by text not null default '',
  dev text not null default '',
  user_id uuid,
  srv_at timestamptz not null default now());
create index if not exists it_events_org_seq on public.it_events(org, seq);

alter table public.it_orgs enable row level security;
alter table public.it_members enable row level security;
alter table public.it_invites enable row level security;
alter table public.it_events enable row level security;
revoke all on public.it_orgs, public.it_members, public.it_invites, public.it_events from anon;
grant select on public.it_orgs, public.it_members to authenticated;
grant select, insert on public.it_events to authenticated;
grant usage, select on sequence public.it_events_seq_seq to authenticated;

create or replace function public.it_my_org() returns uuid language sql stable security definer set search_path = public as
$$ select org from it_members where user_id = auth.uid() and active limit 1 $$;
create or replace function public.it_my_perms() returns jsonb language sql stable security definer set search_path = public as
$$ select case when role = 'admin' then '["approve","commission","collect","balances","reports","export","reopen","users"]'::jsonb else perms end from it_members where user_id = auth.uid() and active limit 1 $$;

drop policy if exists it_orgs_sel on public.it_orgs;
create policy it_orgs_sel on public.it_orgs for select to authenticated using (id = public.it_my_org());
drop policy if exists it_members_sel on public.it_members;
create policy it_members_sel on public.it_members for select to authenticated using (org = public.it_my_org());
drop policy if exists it_events_sel on public.it_events;
create policy it_events_sel on public.it_events for select to authenticated using (org = public.it_my_org());
drop policy if exists it_events_ins on public.it_events;
create policy it_events_ins on public.it_events for insert to authenticated with check (org = public.it_my_org());

-- السيرفر بيتأكد من الصلاحية لكل نوع حركة (مش بس الشاشة)
create or replace function public.it_events_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare p jsonb := coalesce(public.it_my_perms(), '[]'::jsonb); need text;
begin
  new.user_id := auth.uid(); new.srv_at := now();
  if new.org is distinct from public.it_my_org() then raise exception 'مش عضو في المكتب ده'; end if;
  need := case
    when new.type in ('tx.execute') then 'approve'
    when new.type = 'tx.status' and coalesce(new.d->>'status','') in ('completed','refunded') then 'approve'
    when new.type in ('rule.upsert') then 'commission'
    when new.type in ('coll.add') then 'collect'
    when new.type in ('coll.reverse','move.add','move.reverse') then 'balances'
    when new.type = 'wallet.upsert' and new.d ? 'opening' then 'balances'
    when new.type = 'settings.set' and coalesce(new.d->>'key','') = 'cashOpening' then 'balances'
    when new.type = 'day.reopen' then 'reopen'
    when new.type = 'user.upsert' then 'users'
    else null end;
  if need is not null and not (p ? need) then raise exception 'مش مسموح: %', need; end if;
  return new;
end $$;
drop trigger if exists it_events_guard on public.it_events;
create trigger it_events_guard before insert on public.it_events for each row execute function public.it_events_guard();

-- إنشاء مكتب جديد (اللي بيعمله بيبقى المدير)
create or replace function public.it_create_org(p_name text, p_member text) returns uuid language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.it_my_org() is not null then return public.it_my_org(); end if;
  insert into it_orgs(name, owner) values (coalesce(nullif(btrim(p_name),''),'Islam Transfer'), auth.uid()) returning id into o;
  insert into it_members(org, user_id, name, email, role, perms) values (o, auth.uid(), coalesce(nullif(btrim(p_member),''),'المدير'), coalesce(auth.jwt()->>'email',''), 'admin', '["approve","commission","collect","balances","reports","export","reopen","users"]');
  return o;
end $$;
-- كود دعوة لموظف
create or replace function public.it_invite(p_role text, p_perms jsonb) returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not (coalesce(public.it_my_perms(),'[]'::jsonb) ? 'users') then raise exception 'مش مسموح: users'; end if;
  c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into it_invites(code, org, role, perms, created_by) values (c, public.it_my_org(), coalesce(p_role,'operator'), coalesce(p_perms,'[]'::jsonb), auth.uid());
  return c;
end $$;
create or replace function public.it_join(p_code text, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare i it_invites;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.it_my_org() is not null then raise exception 'حسابك عضو في مكتب بالفعل'; end if;
  select * into i from it_invites where code = upper(btrim(p_code)) for update;
  if not found or i.used_by is not null or i.expires_at < now() then raise exception 'الكود غلط أو مستخدم أو خلص'; end if;
  insert into it_members(org, user_id, name, email, role, perms) values (i.org, auth.uid(), coalesce(nullif(btrim(p_name),''),'موظف'), coalesce(auth.jwt()->>'email',''), i.role, i.perms);
  update it_invites set used_by = auth.uid(), used_at = now() where code = i.code;
  return i.org;
end $$;
-- المدير يعدّل صلاحيات موظف أو يوقفه
create or replace function public.it_member_set(p_user uuid, p_role text, p_perms jsonb, p_active boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (coalesce(public.it_my_perms(),'[]'::jsonb) ? 'users') then raise exception 'مش مسموح: users'; end if;
  if p_user = auth.uid() and coalesce(p_active, true) = false then raise exception 'مينفعش توقف نفسك'; end if;
  update it_members set role = coalesce(p_role, role), perms = coalesce(p_perms, perms), active = coalesce(p_active, active) where org = public.it_my_org() and user_id = p_user;
end $$;
create or replace function public.it_me() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('org', m.org, 'org_name', o.name, 'name', m.name, 'role', m.role, 'perms', public.it_my_perms(), 'email', m.email)
  from it_members m join it_orgs o on o.id = m.org where m.user_id = auth.uid() and m.active limit 1 $$;

revoke all on function public.it_create_org(text,text), public.it_invite(text,jsonb), public.it_join(text,text), public.it_member_set(uuid,text,jsonb,boolean), public.it_me(), public.it_my_org(), public.it_my_perms() from public, anon;
grant execute on function public.it_create_org(text,text), public.it_invite(text,jsonb), public.it_join(text,text), public.it_member_set(uuid,text,jsonb,boolean), public.it_me(), public.it_my_org(), public.it_my_perms() to authenticated;

-- صور الإثباتات: مخزن خاص، كل مكتب يشوف صوره بس
insert into storage.buckets(id, name, public) values ('it-proofs', 'it-proofs', false) on conflict (id) do nothing;
drop policy if exists it_proofs_sel on storage.objects;
create policy it_proofs_sel on storage.objects for select to authenticated using (bucket_id = 'it-proofs' and (storage.foldername(name))[1] = public.it_my_org()::text);
drop policy if exists it_proofs_ins on storage.objects;
create policy it_proofs_ins on storage.objects for insert to authenticated with check (bucket_id = 'it-proofs' and (storage.foldername(name))[1] = public.it_my_org()::text);

-- التحديث اللحظي
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.it_events'; exception when others then null; end;
end $$;

-- التسجيل: حساب Islam Transfer مايعملش محل ميكانيكس
create or replace function public.app_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int; o uuid; shop text := btrim(coalesce(new.raw_user_meta_data->>'shop', '')); ph text := btrim(coalesce(new.raw_user_meta_data->>'phone', ''));
begin
  if coalesce(new.raw_user_meta_data->>'staff', '') = 'true' then return new; end if;
  if coalesce(new.raw_user_meta_data->>'app', '') = 'it' then return new; end if;
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
select 'OK it sync' as result;

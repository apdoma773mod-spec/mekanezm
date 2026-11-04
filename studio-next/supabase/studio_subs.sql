-- اشتراكات «ميكانيزم ستوديو» على مشروع mekanizm-app (rzvncstjattlklpdtkfn)
-- بنفس نمط wm_subs / cash_subs / ph_subs الموجود: صف لكل مستخدم + تجربة مجانية + أدمن بيجدد ويوقف.
-- إضافة بس (جداول ودوال بادئتها studio_) — مفيش حاجة موجودة اتغيّرت.
-- للتراجع: drop function studio_*; drop table studio_subs; delete from app_config where key like 'studio\_%';

create table if not exists public.studio_subs (
  owner      uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  name       text not null default '',
  phone      text not null default '',
  created_at timestamptz not null default now(),
  trial_end  timestamptz not null,
  paid_until timestamptz,
  blocked    boolean not null default false,
  note       text not null default '',
  last_seen  timestamptz,
  src        text not null default ''
);
alter table public.studio_subs enable row level security;

-- القراءة: صاحب الحساب أو الأدمن. الكتابة كلها من الدوال تحت (مفيش insert/update/delete مباشر من المتصفح).
drop policy if exists studio_subs_sel on public.studio_subs;
create policy studio_subs_sel on public.studio_subs for select to authenticated
  using (owner = (select auth.uid()) or public.app_is_admin());

-- إعدادات: أيام التجربة، تشغيل البوابة، رقم التواصل
insert into public.app_config(key, value) values
  ('studio_trial_days', to_jsonb(7)),
  ('studio_gate', to_jsonb(false)),
  ('studio_contact', to_jsonb(''::text))
on conflict (key) do nothing;

-- بيانات عامة بتتقرأ قبل تسجيل الدخول (هل البوابة شغالة؟ كام يوم التجربة؟)
create or replace function public.studio_public_cfg()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare g boolean; d int; c text;
begin
  select coalesce((value)::text = 'true', false) into g from app_config where key = 'studio_gate';
  select coalesce((value)::text::int, 7) into d from app_config where key = 'studio_trial_days';
  select coalesce(trim(both '"' from (value)::text), '') into c from app_config where key = 'studio_contact';
  return jsonb_build_object('gate', coalesce(g, false), 'trial_days', coalesce(d, 7), 'contact', coalesce(c, ''));
end $$;

-- حالة المستخدم الحالي (وبتفتح له تجربة مجانية أول مرة يدخل)
create or replace function public.studio_my_sub(p_name text default null, p_phone text default null, p_src text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare s studio_subs; adm boolean := public.app_is_admin(); st text; d int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select coalesce((value)::text::int, 7) into d from app_config where key = 'studio_trial_days';
  insert into studio_subs(owner, email, trial_end, src)
    values (auth.uid(), coalesce(auth.jwt()->>'email',''), now() + make_interval(days => coalesce(d, 7)), left(coalesce(p_src,''), 20))
    on conflict (owner) do nothing;
  update studio_subs set last_seen = now(),
    name  = case when coalesce(p_name,'')  <> '' then left(p_name, 120)  else name  end,
    phone = case when coalesce(p_phone,'') <> '' then left(p_phone, 40) else phone end
  where owner = auth.uid() returning * into s;
  st := case when adm then 'admin' when s.blocked then 'blocked'
             when s.paid_until is not null and now() < s.paid_until then 'active'
             when now() < s.trial_end then 'trial' else 'expired' end;
  return jsonb_build_object('status', st, 'trial_end', s.trial_end, 'paid_until', s.paid_until, 'email', s.email, 'name', s.name, 'admin', adm,
    'days_left', greatest(0, ceil(extract(epoch from (case when st = 'active' then s.paid_until else s.trial_end end) - now()) / 86400))::int);
end $$;

-- لوحة الأدمن: قايمة المشتركين
create or replace function public.studio_admin_list()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select s.owner, s.email, s.name, s.phone, s.created_at, s.trial_end, s.paid_until, s.blocked, s.note, s.last_seen, s.src,
      case when s.blocked then 'blocked' when s.paid_until is not null and now() < s.paid_until then 'active'
           when now() < s.trial_end then 'trial' else 'expired' end as status
    from studio_subs s) x), '[]'::jsonb);
end $$;

-- تجديد/إيقاف: p_days>0 يزوّد من آخر تاريخ، 0 يلغي الاشتراك المدفوع، p_until تاريخ محدد
create or replace function public.studio_admin_set(p_owner uuid, p_days integer default null, p_blocked boolean default null, p_note text default null, p_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare s studio_subs;
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  update studio_subs set
    paid_until = case when p_until is not null then p_until when p_days is null then paid_until when p_days <= 0 then null
                      else greatest(coalesce(paid_until, now()), now()) + make_interval(days => p_days) end,
    blocked = coalesce(p_blocked, blocked), note = coalesce(left(p_note, 500), note)
  where owner = p_owner returning * into s;
  if s.owner is null then raise exception 'not_found'; end if;
  return to_jsonb(s);
end $$;

-- تمديد التجربة
create or replace function public.studio_admin_trial(p_owner uuid, p_days integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  update studio_subs set trial_end = greatest(trial_end, now()) + make_interval(days => p_days), blocked = false where owner = p_owner;
end $$;

-- إعدادات المنتج (تشغيل البوابة، أيام التجربة، رقم التواصل)
create or replace function public.studio_admin_cfg(p_gate boolean default null, p_trial_days integer default null, p_contact text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  if p_gate is not null then insert into app_config(key, value) values ('studio_gate', to_jsonb(p_gate)) on conflict (key) do update set value = excluded.value; end if;
  if p_trial_days is not null and p_trial_days between 0 and 365 then insert into app_config(key, value) values ('studio_trial_days', to_jsonb(p_trial_days)) on conflict (key) do update set value = excluded.value; end if;
  if p_contact is not null then insert into app_config(key, value) values ('studio_contact', to_jsonb(left(p_contact, 60))) on conflict (key) do update set value = excluded.value; end if;
  return public.studio_public_cfg();
end $$;

-- الصلاحيات: الدوال كلها للمسجّلين بس، ماعدا الإعدادات العامة (قبل الدخول)
revoke all on function public.studio_my_sub(text, text, text) from public, anon;
revoke all on function public.studio_admin_list() from public, anon;
revoke all on function public.studio_admin_set(uuid, integer, boolean, text, timestamptz) from public, anon;
revoke all on function public.studio_admin_trial(uuid, integer) from public, anon;
revoke all on function public.studio_admin_cfg(boolean, integer, text) from public, anon;
revoke all on function public.studio_public_cfg() from public;
grant execute on function public.studio_my_sub(text, text, text) to authenticated;
grant execute on function public.studio_admin_list() to authenticated;
grant execute on function public.studio_admin_set(uuid, integer, boolean, text, timestamptz) to authenticated;
grant execute on function public.studio_admin_trial(uuid, integer) to authenticated;
grant execute on function public.studio_admin_cfg(boolean, integer, text) to authenticated;
grant execute on function public.studio_public_cfg() to anon, authenticated;

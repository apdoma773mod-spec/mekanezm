-- 62: صندوق رسايل الصفحات الموحد (فيسبوك / إنستجرام / تيك توك) — #15
-- جداول جديدة بس، مفيش أي جدول قديم بيتغير. الكتابة من الـ Edge Function «social-webhook» بس،
-- والقراءة والتجاهل للمدير (mk_social_can — جاهزة تتوسع لو اتضاف موظف).

create or replace function public.mk_social_can() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.mk_is_admin(), false) $$;
revoke all on function public.mk_social_can() from public, anon;
grant execute on function public.mk_social_can() to authenticated;

create table if not exists public.mk_social_msgs (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook','instagram','tiktok')),
  page_id text not null default '',
  thread_id text not null,
  sender_name text not null default '',
  direction text not null check (direction in ('in','out')),
  body text not null default '',
  ext_id text unique,
  rule_type text not null default '',
  status text not null default 'new' check (status in ('new','auto','replied','ignored','sent','failed','pending')),
  by_name text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mk_social_msgs_thread on public.mk_social_msgs (thread_id, created_at desc);
create index if not exists mk_social_msgs_time on public.mk_social_msgs (created_at desc);

alter table public.mk_social_msgs enable row level security;
create policy social_sel on public.mk_social_msgs for select to authenticated using (public.mk_social_can());
create policy social_upd on public.mk_social_msgs for update to authenticated using (public.mk_social_can()) with check (public.mk_social_can());
grant select, update on public.mk_social_msgs to authenticated;

-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 🔗 بوابة العميل: رابط خاص بكل عميل يشوف منه حسابه وفواتيره ويكتب طلبه ويبعت صور/فيديو
-- تشغيله مرة واحدة في SQL Editor. العميل مابيدخلش غير بالتوكن السري بتاع رابطه، ومابيشوفش غير حسابه.

create table if not exists public.mk_portal(
  token text primary key,
  cid text not null default '',
  name text not null default '',
  snap jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now());
alter table public.mk_portal enable row level security;
revoke all on public.mk_portal from anon;
grant select, insert, update, delete on public.mk_portal to authenticated;
drop policy if exists mk_portal_all on public.mk_portal;
create policy mk_portal_all on public.mk_portal for all to authenticated using (public.mk_is_member()) with check (public.mk_is_member());

create table if not exists public.mk_portal_msgs(
  id uuid primary key default gen_random_uuid(),
  token text not null references public.mk_portal(token) on delete cascade,
  name text not null default '',
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  seen boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists mk_portal_msgs_tok on public.mk_portal_msgs(token, created_at desc);
alter table public.mk_portal_msgs enable row level security;
revoke all on public.mk_portal_msgs from anon;
grant select, update, delete on public.mk_portal_msgs to authenticated;
drop policy if exists mk_portal_msgs_sel on public.mk_portal_msgs;
create policy mk_portal_msgs_sel on public.mk_portal_msgs for select to authenticated using (public.mk_is_member());
drop policy if exists mk_portal_msgs_upd on public.mk_portal_msgs;
create policy mk_portal_msgs_upd on public.mk_portal_msgs for update to authenticated using (public.mk_is_member());
drop policy if exists mk_portal_msgs_del on public.mk_portal_msgs;
create policy mk_portal_msgs_del on public.mk_portal_msgs for delete to authenticated using (public.mk_is_admin());

-- العميل (من غير تسجيل دخول) بيقرأ حسابه بالتوكن
create or replace function public.mk_portal_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; m jsonb;
begin
  if coalesce(length(p_token), 0) < 16 then return null; end if;
  select * into r from public.mk_portal where token = p_token;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('body', body, 'media', media, 'at', created_at) order by created_at desc), '[]'::jsonb)
    into m from (select * from public.mk_portal_msgs where token = p_token order by created_at desc limit 30) x;
  return jsonb_build_object('name', r.name, 'snap', r.snap, 'msgs', m, 'updated_at', r.updated_at);
end $$;
grant execute on function public.mk_portal_get(text) to anon, authenticated;

-- العميل بيبعت طلب/صور/فيديو
create or replace function public.mk_portal_send(p_token text, p_body text, p_media jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare r record; n int;
begin
  if coalesce(length(p_token), 0) < 16 then return false; end if;
  select * into r from public.mk_portal where token = p_token;
  if not found then return false; end if;
  if coalesce(btrim(p_body), '') = '' and coalesce(jsonb_array_length(p_media), 0) = 0 then return false; end if;
  select count(*) into n from public.mk_portal_msgs where token = p_token and created_at > now() - interval '1 hour';
  if n >= 20 then return false; end if;   -- حماية من الإزعاج
  insert into public.mk_portal_msgs(token, name, body, media)
  values (p_token, r.name, left(coalesce(p_body, ''), 4000), case when jsonb_typeof(p_media) = 'array' then p_media else '[]'::jsonb end);
  perform public.mk_alert('portal', '🔗 العميل ' || r.name || ' بعت طلب من رابطه' || E'\n' || left(coalesce(p_body, ''), 300)
    || case when coalesce(jsonb_array_length(p_media), 0) > 0 then E'\n📎 مرفقات: ' || jsonb_array_length(p_media) else '' end);
  return true;
end $$;
grant execute on function public.mk_portal_send(text, text, jsonb) to anon, authenticated;

-- مخزن الصور والفيديو (العميل يرفع، الرابط عشوائي مايتخمنش)
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('portal', 'portal', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists portal_up on storage.objects;
create policy portal_up on storage.objects for insert to anon, authenticated with check (bucket_id = 'portal' and exists (select 1 from public.mk_portal where token = (storage.foldername(name))[1]));

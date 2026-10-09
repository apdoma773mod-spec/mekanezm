-- ميكانيزم (tkzfjeizvanfptnqvrmr) — صور الواتساب + صندوق الصادر (الإرسال من رقم المحل)
-- الجسر بيبعت الصورة بالسر بتاعه (زي wa_submit)، والسيستم بيعرضها ويطابقها ويرد بكارت المنتج من رقم المحل.
create table if not exists public.wa_photos(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  msg_id text unique,
  phone text not null default '',
  name text not null default '',
  caption text not null default '',
  img text not null default '',          -- data:image/...;base64 (صور الواتساب صغيرة)
  seen text not null default '',
  matches jsonb not null default '[]',
  status text not null default 'new' check (status in ('new','sent','missing','ignored')),
  handled_by text not null default '',
  handled_at timestamptz);
create index if not exists wa_photos_new on public.wa_photos(created_at desc) where status = 'new';
alter table public.wa_photos enable row level security;
revoke all on public.wa_photos from anon;
grant select, update, delete on public.wa_photos to authenticated;
drop policy if exists wa_photos_sel on public.wa_photos;
create policy wa_photos_sel on public.wa_photos for select to authenticated using (public.mk_is_member());
drop policy if exists wa_photos_upd on public.wa_photos;
create policy wa_photos_upd on public.wa_photos for update to authenticated using (public.mk_is_member()) with check (public.mk_is_member());
drop policy if exists wa_photos_del on public.wa_photos;
create policy wa_photos_del on public.wa_photos for delete to authenticated using (public.mk_is_admin());

create table if not exists public.wa_out(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  to_phone text not null,
  body text not null default '',
  imgs jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  err text not null default '',
  by_name text not null default '',
  sent_at timestamptz);
create index if not exists wa_out_pending on public.wa_out(created_at) where status in ('pending','sending');
alter table public.wa_out enable row level security;
revoke all on public.wa_out from anon;
grant select, insert on public.wa_out to authenticated;
drop policy if exists wa_out_sel on public.wa_out;
create policy wa_out_sel on public.wa_out for select to authenticated using (public.mk_is_member());
drop policy if exists wa_out_ins on public.wa_out;
create policy wa_out_ins on public.wa_out for insert to authenticated with check (public.mk_is_member() and status = 'pending');

-- الجسر: صورة جديدة من عميل
create or replace function public.wa_photo_submit(p_secret text, p_msg_id text, p_phone text, p_name text, p_caption text, p_img text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from (select v from public.wa_config where k = 'secret') then raise exception 'forbidden'; end if;
  if coalesce(p_img, '') !~ '^data:image/(jpeg|png|webp);base64,' then raise exception 'not_image'; end if;
  if length(p_img) > 2500000 then raise exception 'too_big'; end if;
  insert into public.wa_photos(msg_id, phone, name, caption, img)
  values (p_msg_id, left(coalesce(p_phone,''), 30), left(coalesce(p_name,''), 120), left(coalesce(p_caption,''), 1000), p_img)
  on conflict (msg_id) do nothing returning id into v_id;
  delete from public.wa_photos where created_at < now() - interval '45 days' and status <> 'new';
  return coalesce(v_id::text, 'duplicate');
end $$;

-- الجسر: ياخد الرسايل اللي مستنية تتبعت (ولو واحدة علقت أكتر من ١٠ دقايق بترجع تتبعت)
create or replace function public.wa_out_claim(p_secret text)
returns setof public.wa_out language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select v from public.wa_config where k = 'secret') then raise exception 'forbidden'; end if;
  return query
  update public.wa_out o set status = 'sending'
  where o.id in (select id from public.wa_out where status = 'pending' or (status = 'sending' and created_at < now() - interval '10 minutes')
                 order by created_at limit 3 for update skip locked)
  returning o.*;
end $$;

create or replace function public.wa_out_done(p_secret text, p_id uuid, p_ok boolean, p_err text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select v from public.wa_config where k = 'secret') then raise exception 'forbidden'; end if;
  update public.wa_out set status = case when p_ok then 'sent' else 'failed' end, err = left(coalesce(p_err,''), 300), sent_at = now() where id = p_id;
end $$;

revoke all on function public.wa_photo_submit(text,text,text,text,text,text), public.wa_out_claim(text), public.wa_out_done(text,uuid,boolean,text) from public;
grant execute on function public.wa_photo_submit(text,text,text,text,text,text), public.wa_out_claim(text), public.wa_out_done(text,uuid,boolean,text) to anon, authenticated;
select 'OK wa photos + outbox' as result;

-- 71: المونتاج في الخلفية (سحابة) — جدول المهام + باكت تخزين خاص video-jobs + سر العامل. اتطبق 2026-10-23. من غير delete/drop.
-- العامل = GitHub Actions (.github/workflows/render-video.yml) بيكلّم دالة vr-worker بالسر VR_SECRET.
-- السر نفسه محطوط في الجدول mk_vr_secret بالإيدي (مش هنا).
create table if not exists public.mk_video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null default '',
  status text not null default 'uploading' check (status in ('uploading','queued','working','done','failed')),
  progress int not null default 0,
  note text not null default '',
  spec jsonb not null default '{}'::jsonb,
  parts jsonb not null default '[]'::jsonb,
  out_path text,
  error text not null default '',
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mk_video_jobs_q on public.mk_video_jobs (status, created_at);
alter table public.mk_video_jobs enable row level security;
create policy vj_sel on public.mk_video_jobs for select to authenticated using (user_id = auth.uid() or public.mk_is_admin());
create policy vj_ins on public.mk_video_jobs for insert to authenticated with check (user_id = auth.uid() and public.mk_role() is not null);
create policy vj_upd on public.mk_video_jobs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('uploading','queued'));
grant select, insert, update on public.mk_video_jobs to authenticated;
create table if not exists public.mk_vr_secret (secret text primary key);
alter table public.mk_vr_secret enable row level security;   -- من غير سياسات: الدوال بس (service role) هي اللي تقراه
insert into storage.buckets (id, name, public) values ('video-jobs', 'video-jobs', false) on conflict (id) do nothing;
create policy vjo_ins on storage.objects for insert to authenticated with check (bucket_id = 'video-jobs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy vjo_sel on storage.objects for select to authenticated using (bucket_id = 'video-jobs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy vjo_del on storage.objects for delete to authenticated using (bucket_id = 'video-jobs' and (storage.foldername(name))[1] = auth.uid()::text);

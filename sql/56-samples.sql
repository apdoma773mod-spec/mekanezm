-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 🧪 العينات (اختياري، يتشغّل ويتقفل من الإعدادات)
-- عينة تخرج من غير بيع: تسجيل الصنف والعميل والكمية، وبعدها خرجت/رجعت/اتحولت لبيع/اتخصمت كخسارة.
create table if not exists public.mk_samples(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_id uuid,
  product_name text not null default '',
  qty numeric not null default 1,
  customer text not null default '',
  date date not null default current_date,
  given_by text not null default '',
  status text not null default 'out' check (status in ('out','returned','sold','lost')),
  resolved_at timestamptz);
create index if not exists mk_samples_out on public.mk_samples(created_at desc) where status = 'out';
alter table public.mk_samples enable row level security;
revoke all on public.mk_samples from anon;
grant select, insert, update, delete on public.mk_samples to authenticated;
drop policy if exists mk_samples_all on public.mk_samples;
create policy mk_samples_all on public.mk_samples for all to authenticated using (public.mk_is_member()) with check (public.mk_is_member());
select 'OK mk_samples' as result;

-- 65: كود ورقة التجهيز MK-0001 (عداد في القاعدة) + جدول يربط الكود بالفاتورة/الأوردر (#19، #18). اتطبق 2026-10-22.
create sequence if not exists public.mk_prep_seq start 1;
create table if not exists public.mk_prep_sheets (
  code text primary key,
  kind text not null default 'invoice',
  ref text not null default '',
  wk_no int,
  person text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
alter table public.mk_prep_sheets enable row level security;
create policy prep_sel on public.mk_prep_sheets for select to authenticated using (public.mk_role() is not null);
grant select on public.mk_prep_sheets to authenticated;
create or replace function public.mk_prep_new(p_kind text, p_ref text, p_wk int, p_person text) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if public.mk_role() is null then raise exception 'not_member'; end if;
  c := 'MK-' || lpad(nextval('public.mk_prep_seq')::text, 4, '0');
  insert into public.mk_prep_sheets(code, kind, ref, wk_no, person, created_by) values (c, coalesce(p_kind,'invoice'), coalesce(p_ref,''), p_wk, coalesce(p_person,''), public.mk_me_name());
  return c;
end $$;
revoke all on function public.mk_prep_new(text,text,int,text) from public, anon;
grant execute on function public.mk_prep_new(text,text,int,text) to authenticated;

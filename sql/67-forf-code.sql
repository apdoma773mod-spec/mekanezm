-- 67: كود الفرفورجيه FR-0001 (عداد لوحده). ورقة التجهيز العادية PS- زي ما هي. من غير delete/drop.
create sequence if not exists public.mk_fr_seq start 1;
create or replace function public.mk_prep_new(p_kind text, p_ref text, p_wk int, p_person text) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if public.mk_role() is null then raise exception 'not_member'; end if;
  if coalesce(p_kind,'') = 'forf' then c := 'FR-' || lpad(nextval('public.mk_fr_seq')::text, 4, '0');
  else c := 'PS-' || lpad(nextval('public.mk_prep_seq')::text, 4, '0'); end if;
  insert into public.mk_prep_sheets(code, kind, ref, wk_no, person, created_by) values (c, coalesce(p_kind,'invoice'), coalesce(p_ref,''), p_wk, coalesce(p_person,''), public.mk_me_name());
  return c;
end $$;

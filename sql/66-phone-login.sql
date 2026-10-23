-- 66: الدخول برقم الموبايل + الرقم السري (بجانب الإيميل). مفيش رسايل ولا تكلفة.
-- الرقم السري هو نفس كلمة سر الحساب في Supabase (لازم 6 أرقام/حروف على الأقل).
alter table public.mk_members add column if not exists phone text;

-- بيرجّع الإيميل المرتبط بالرقم (للحسابات النشطة بس) — عشان الدخول يكمّل بنفس كلمة السر
create or replace function public.mk_phone_to_email(p_phone text) returns text
language sql security definer set search_path = public as $$
  select u.email::text from public.mk_members m join auth.users u on u.id = m.user_id
   where m.active and right(regexp_replace(coalesce(m.phone,''), '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10)
     and length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 10
   limit 1
$$;
revoke all on function public.mk_phone_to_email(text) from public;
grant execute on function public.mk_phone_to_email(text) to anon, authenticated;

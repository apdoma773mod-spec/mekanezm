-- ميكانيزم — 🔧 إصلاح رفع صور/فيديو بوابة العميل (خطأ 403)
-- السبب: سياسة الرفع كانت بتقرا جدول mk_portal، والعميل (anon) مابيقدرش يقراه، فالتحقق بيفشل.
-- الحل: دالة security definer بتتأكد من التوكن، والسياسة بتستخدمها. آمن: بيضيف بس، ومابيمسحش بيانات.

create or replace function public.mk_portal_tok_ok(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select length(coalesce(p, '')) >= 16 and exists (select 1 from public.mk_portal where token = p)
$$;
revoke all on function public.mk_portal_tok_ok(text) from public;
grant execute on function public.mk_portal_tok_ok(text) to anon, authenticated;

drop policy if exists portal_up on storage.objects;
create policy portal_up on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'portal' and public.mk_portal_tok_ok((storage.foldername(name))[1]));

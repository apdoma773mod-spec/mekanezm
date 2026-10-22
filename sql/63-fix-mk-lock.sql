-- 63: إصلاح — mk_save_invoice_core (من SQL 58) و mk_cancel_payment (SQL 60) بيندهوا public.mk_lock()
-- والدالة دي كانت موجودة في نسخة المشتركين بس (30-tenant-c.sql)، فأي حفظ فاتورة كان بيفشل (404 / 42883).
-- نسخة المحل: نفس القفل اللي باقي دوال المحل بتستخدمه (pg_advisory_xact_lock(7002)). اتطبق 2026-10-22.
create or replace function public.mk_lock() returns void
language sql security definer set search_path = public as
$$ select pg_advisory_xact_lock(7002) $$;
revoke all on function public.mk_lock() from public, anon;
grant execute on function public.mk_lock() to authenticated;

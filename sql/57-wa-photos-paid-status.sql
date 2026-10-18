-- ميكانيزم (tkzfjeizvanfptnqvrmr) — إضافة حالة 'paid' لصور الواتساب (تحويل فلوس اتسجّل دفعة تلقائي)
alter table public.wa_photos drop constraint if exists wa_photos_status_check;
alter table public.wa_photos add constraint wa_photos_status_check check (status in ('new','sent','missing','ignored','paid'));
select 'OK wa_photos paid status' as result;

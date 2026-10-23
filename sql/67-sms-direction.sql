-- 67: فودافون كاش — رقم الطرف الثاني واتجاه الحركة (صادر/وارد)
alter table public.mk_sms_inbox add column if not exists phone text, add column if not exists direction text;

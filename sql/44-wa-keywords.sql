-- 44-wa-keywords.sql  (2026-10-15)  فلتر كلمات الواتساب المفتاحية
-- شغّله بنفسك في Supabase SQL Editor. الجسر بيقرا القواعد من mk_settings (key = 'wa_rules')
-- وبيبعت عدّاد الرسايل المتجاهَلة (key = 'wa_rules_stat').
-- الدوال دي بتتحقق من نفس سرّ الجسر الموجود في wa_config (زي wa_photo_submit).

-- 1) الجسر يقرا القواعد
create or replace function public.wa_rules_get(p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_secret is distinct from (select v from public.wa_config where k = 'secret') then raise exception 'forbidden'; end if;
  select value into r from public.mk_settings where key = 'wa_rules';
  return coalesce(r, '{}'::jsonb);
end $$;

-- 2) الجسر يبعت عدّاد المتجاهَل + آخر الرسايل المتجاهَلة (مؤقتة، آخر 30 بس)
create or replace function public.wa_rules_stat(p_secret text, p_stat jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select v from public.wa_config where k = 'secret') then raise exception 'forbidden'; end if;
  insert into public.mk_settings(key, value) values ('wa_rules_stat', p_stat)
  on conflict (key) do update set value = excluded.value;
end $$;

-- 3) زر «اعتبرها طلب» من الشاشة (أدمن فقط)
create or replace function public.wa_rules_promote(p_msg_id text, p_phone text, p_name text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  insert into public.wa_orders(msg_id, phone, customer_name, body)
  values (coalesce(nullif(p_msg_id, ''), 'promo-' || gen_random_uuid()::text), left(p_phone, 30), left(p_name, 120), left(p_body, 4000))
  on conflict do nothing;
end $$;

revoke all on function public.wa_rules_get(text), public.wa_rules_stat(text, jsonb), public.wa_rules_promote(text, text, text, text) from public;
grant execute on function public.wa_rules_get(text), public.wa_rules_stat(text, jsonb) to anon, authenticated;
grant execute on function public.wa_rules_promote(text, text, text, text) to authenticated;

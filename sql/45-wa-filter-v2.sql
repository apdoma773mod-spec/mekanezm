-- 45-wa-filter-v2.sql  (2026-10-15)  فلتر الواتساب الصارم — الجزء التاني
-- شغّله بعد 44-wa-keywords.sql (الاتنين في Supabase → SQL Editor → Run).
-- بيخلّي الجسر يعرف أرقام العملاء والموردين المتسجلين في السيستم،
-- عشان صورهم (تحويلات مثلاً) تدخل حتى من غير كلمة، وأي رقم تاني (أهل/أصحاب) يتجاهل.
-- الجسر بياخد آخر ١٠ أرقام بس من كل تليفون، مفيش أسماء ولا أرصدة.

create or replace function public.wa_known_phones(p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v_org text;
begin
  if p_secret is distinct from (select v from public.wa_config where k = 'secret') then raise exception 'forbidden'; end if;
  select v into v_org from public.wa_config where k = 'org';
  select coalesce(jsonb_agg(distinct right(regexp_replace(phone, '\D', '', 'g'), 10)), '[]'::jsonb) into r
  from public.mk_contacts
  where length(regexp_replace(phone, '\D', '', 'g')) >= 10
    and (v_org is null or org::text = v_org);
  return r;
end $$;

revoke all on function public.wa_known_phones(text) from public;
grant execute on function public.wa_known_phones(text) to anon, authenticated;

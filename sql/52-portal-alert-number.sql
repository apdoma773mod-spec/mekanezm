-- ميكانيزم — 🔔 طلب العميل من البوابة يوصل لرقمك على واتساب
-- بيتأكد إن التنبيهات شغالة، وإن رقمك (201119199659) موجود، ونوع «portal» مفعّل.
-- آمن: بيضيف/يعدّل إعداد التنبيهات بس، ومابيمسحش حاجة.
-- ملحوظة: التنبيه بيتبعت من جهاز المحل (الجسر)، لازم يكون شغال ومربوط بالواتساب.

insert into public.mk_settings(key, value)
select 'alerts', '{}'::jsonb
where not exists (select 1 from public.mk_settings where key = 'alerts');

update public.mk_settings
set value = coalesce(value, '{}'::jsonb)
  || jsonb_build_object(
       'on', true,
       'to', (select coalesce(jsonb_agg(distinct x), '["201119199659"]'::jsonb)
              from (select jsonb_array_elements_text(
                      case when jsonb_typeof(coalesce(value->'to', '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(value->'to', '[]'::jsonb)) > 0
                           then value->'to' else '[]'::jsonb end) as x
                    union select '201119199659') s),
       'types', coalesce(value->'types', '{}'::jsonb) || '{"portal": true}'::jsonb)
where key = 'alerts';

-- للتأكد: select value from public.mk_settings where key = 'alerts';
-- وآخر تنبيهات اتبعتت: select to_phone, left(body, 80), status, created_at from public.wa_out order by created_at desc limit 5;

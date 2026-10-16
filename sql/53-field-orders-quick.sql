-- ميكانيزم — ⚡ الأوردر الميداني السريع + إشعار فوري لفريق ميكانيزم (دفعة أ)
-- آمن: بيضيف أعمدة جديدة بس، ومابيمسحش ولا بيعدّل بيانات موجودة. شغّله مرة واحدة في Supabase SQL Editor (بعد 49 و52).
begin;

alter table public.mk_field_orders
  add column if not exists lines     jsonb       not null default '[]'::jsonb,  -- البنود: [{pid,n,q,s,r,pr,wh,nw,d,st,sd,inv}]
  add column if not exists rep       text        not null default '',           -- المندوب
  add column if not exists sent_at   timestamptz,                               -- وقت الإرسال للمخزن (null = ماتبعتش/اتباع كله)
  add column if not exists eta       text        not null default '',           -- ميعاد التوصيل (فريق ميكانيزم)
  add column if not exists client_id text;                                      -- معرّف من التليفون لمنع تكرار الأوردر لو النت قطع

create unique index if not exists mk_field_orders_client on public.mk_field_orders(client_id) where client_id is not null;
create index if not exists mk_field_orders_sent on public.mk_field_orders(sent_at) where sent_at is not null;

-- ترقيم تلقائي للأوردر لو الرقم فاضي (HO-0001...) من غير تضارب بين مندوبين
create sequence if not exists public.mk_field_no_seq;
select setval('public.mk_field_no_seq',
  greatest(1, coalesce((select max(nullif(regexp_replace(no, '\D', '', 'g'), '')::int) from public.mk_field_orders), 0) + 1), false);

create or replace function public.mk_field_before() returns trigger language plpgsql as $$
begin
  if coalesce(new.no, '') = '' then new.no := 'HO-' || lpad(nextval('public.mk_field_no_seq')::text, 4, '0'); end if;
  return new;
end $$;
drop trigger if exists mk_field_before on public.mk_field_orders;
create trigger mk_field_before before insert on public.mk_field_orders for each row execute function public.mk_field_before();

-- 🔔 إشعار واتساب فوري لأرقام التنبيه (mk_settings key='alerts') أول ما أوردر فيه بنود مطلوبة يتبعت
create or replace function public.mk_alert_field() returns trigger language plpgsql security definer set search_path = public as $$
declare c jsonb; t text; txt text;
begin
  if new.sent_at is null or (tg_op = 'UPDATE' and old.sent_at is not null) then return null; end if;
  c := coalesce((select value from public.mk_settings where key = 'alerts'), '{}'::jsonb);
  if coalesce((c->>'on')::boolean, true) = false then return null; end if;
  if coalesce((c->'types'->>'field')::boolean, true) = false then return null; end if;
  select string_agg('• ' || (l->>'n') || ' × ' || public.mk_n((l->>'r')::numeric) || case when (l->>'nw') is not null then ' (صنف جديد)' else '' end, E'\n')
    into txt from jsonb_array_elements(new.lines) l where coalesce((l->>'r')::numeric, 0) > 0;
  txt := '📦 أوردر ميداني ' || new.no || ' — مطلوب من المخزن' || E'\n👤 العميل: ' || coalesce(new.customer, '')
      || coalesce(E'\n📞 ' || nullif(new.phone, ''), '') || coalesce(E'\n🚚 المندوب: ' || nullif(new.rep, ''), '')
      || E'\n' || coalesce(txt, '') || coalesce(E'\n📝 ' || nullif(new.note, ''), '');
  for t in select jsonb_array_elements_text(case when jsonb_typeof(c->'to') = 'array' and jsonb_array_length(c->'to') > 0 then c->'to' else '["201119199659"]'::jsonb end) loop
    insert into public.wa_out(to_phone, body, by_name)
    values (t, txt || E'\n🕒 ' || to_char(now() at time zone 'Africa/Cairo', 'HH24:MI — YYYY/MM/DD'), '🔔 أوردر ميداني');
  end loop;
  return null;
exception when others then return null;   -- الإشعار عمره ما يوقف حفظ الأوردر
end $$;
drop trigger if exists mk_alert_field on public.mk_field_orders;
create trigger mk_alert_field after insert or update of sent_at on public.mk_field_orders for each row execute function public.mk_alert_field();

commit;
-- للتأكد بعد التشغيل: select column_name from information_schema.columns where table_name='mk_field_orders' and column_name in ('lines','rep','sent_at','eta','client_id');

-- ميكانيزم: التشغيل الكامل (بوابة العميل + الشركتين + هيدرولك). الصقه كله في SQL Editor واضغط Run مرة واحدة.
-- الترتيب: 47 ثم 48 ثم 49. فيه نسخة احتياطية تلقائية في الأول (bak_20261016).

-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 🔗 بوابة العميل: رابط خاص بكل عميل يشوف منه حسابه وفواتيره ويكتب طلبه ويبعت صور/فيديو
-- تشغيله مرة واحدة في SQL Editor. العميل مابيدخلش غير بالتوكن السري بتاع رابطه، ومابيشوفش غير حسابه.

create table if not exists public.mk_portal(
  token text primary key,
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  cid text not null default '',
  name text not null default '',
  snap jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now());
alter table public.mk_portal enable row level security;
revoke all on public.mk_portal from anon;
grant select, insert, update, delete on public.mk_portal to authenticated;
drop policy if exists mk_portal_all on public.mk_portal;
create policy mk_portal_all on public.mk_portal for all to authenticated using (public.mk_is_member()) with check (public.mk_is_member());

create table if not exists public.mk_portal_msgs(
  id uuid primary key default gen_random_uuid(),
  org uuid references public.mk_orgs(id) on delete cascade,
  token text not null references public.mk_portal(token) on delete cascade,
  name text not null default '',
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  seen boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists mk_portal_msgs_tok on public.mk_portal_msgs(token, created_at desc);
alter table public.mk_portal_msgs enable row level security;
revoke all on public.mk_portal_msgs from anon;
grant select, update, delete on public.mk_portal_msgs to authenticated;
drop policy if exists mk_portal_msgs_sel on public.mk_portal_msgs;
create policy mk_portal_msgs_sel on public.mk_portal_msgs for select to authenticated using (public.mk_is_member());
drop policy if exists mk_portal_msgs_upd on public.mk_portal_msgs;
create policy mk_portal_msgs_upd on public.mk_portal_msgs for update to authenticated using (public.mk_is_member());
drop policy if exists mk_portal_msgs_del on public.mk_portal_msgs;
create policy mk_portal_msgs_del on public.mk_portal_msgs for delete to authenticated using (public.mk_is_admin());

-- العميل (من غير تسجيل دخول) بيقرأ حسابه بالتوكن
create or replace function public.mk_portal_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; m jsonb;
begin
  if coalesce(length(p_token), 0) < 16 then return null; end if;
  select * into r from public.mk_portal where token = p_token;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('body', body, 'media', media, 'at', created_at) order by created_at desc), '[]'::jsonb)
    into m from (select * from public.mk_portal_msgs where token = p_token order by created_at desc limit 30) x;
  return jsonb_build_object('name', r.name, 'snap', r.snap, 'msgs', m, 'updated_at', r.updated_at);
end $$;
grant execute on function public.mk_portal_get(text) to anon, authenticated;

-- العميل بيبعت طلب/صور/فيديو
create or replace function public.mk_portal_send(p_token text, p_body text, p_media jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare r record; n int;
begin
  if coalesce(length(p_token), 0) < 16 then return false; end if;
  select * into r from public.mk_portal where token = p_token;
  if not found then return false; end if;
  if coalesce(btrim(p_body), '') = '' and coalesce(jsonb_array_length(p_media), 0) = 0 then return false; end if;
  select count(*) into n from public.mk_portal_msgs where token = p_token and created_at > now() - interval '1 hour';
  if n >= 20 then return false; end if;   -- حماية من الإزعاج
  insert into public.mk_portal_msgs(org, token, name, body, media)
  values (r.org, p_token, r.name, left(coalesce(p_body, ''), 4000), case when jsonb_typeof(p_media) = 'array' then p_media else '[]'::jsonb end);
  perform public.mk_alert('portal', '🔗 العميل ' || r.name || ' بعت طلب من رابطه' || E'\n' || left(coalesce(p_body, ''), 300)
    || case when coalesce(jsonb_array_length(p_media), 0) > 0 then E'\n📎 مرفقات: ' || jsonb_array_length(p_media) else '' end);
  return true;
end $$;
grant execute on function public.mk_portal_send(text, text, jsonb) to anon, authenticated;

-- مخزن الصور والفيديو (العميل يرفع، الرابط عشوائي مايتخمنش)
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('portal', 'portal', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists portal_up on storage.objects;
create policy portal_up on storage.objects for insert to anon, authenticated with check (bucket_id = 'portal' and exists (select 1 from public.mk_portal where token = (storage.foldername(name))[1]));

-- ميكانيزم (tkzfjeizvanfptnqvrmr) — م0 + م1: نسخة احتياطية + خانة «الشركة» (mk = ميكانيزم، hy = هيدرولك)
-- شغّله مرة واحدة في SQL Editor. آمن: الاحتياطي الأول، والبيانات القديمة كلها بتفضل ميكانيزم، ومفيش دالة اتمسحت.
-- لو حصل أي خطأ كل اللي فات بيترجع لوحده (كله في transaction واحدة).

begin;

-- ===== م0: نسخة احتياطية جوه قاعدة البيانات (schema اسمه bak_20261016، مش ظاهر للتطبيق) =====
create schema if not exists bak_20261016;
do $$
declare t text;
begin
  foreach t in array array['mk_products','mk_product_costs','mk_contacts','mk_invoices','mk_invoice_items','mk_item_costs','mk_payments','mk_returns','mk_expenses','mk_settings','mk_stock_moves','mk_voided'] loop
    if to_regclass('public.' || t) is not null and to_regclass('bak_20261016.' || t) is null then
      execute format('create table bak_20261016.%I as table public.%I', t, t);
    end if;
  end loop;
end $$;
revoke all on schema bak_20261016 from anon, authenticated;

-- ===== م1: عمود الشركة =====
alter table public.mk_products  add column if not exists co text not null default 'mk' check (co in ('mk','hy'));
alter table public.mk_invoices  add column if not exists co text not null default 'mk' check (co in ('mk','hy'));
alter table public.mk_expenses  add column if not exists co text not null default 'mk' check (co in ('mk','hy'));
alter table public.mk_returns   add column if not exists co text not null default 'mk' check (co in ('mk','hy'));
alter table public.mk_payments  add column if not exists co text not null default 'mk' check (co in ('mk','hy'));
create index if not exists mk_products_co on public.mk_products(co);
create index if not exists mk_invoices_co on public.mk_invoices(co);

-- ===== الدوال: بنلفّ الدوال الحالية من غير ما نغيّر جواها =====
-- حفظ الفاتورة: الدالة الأصلية بتشتغل زي ما هي، وبعدها بنكتب الشركة على الفاتورة (لو اتبعتت)
do $$ begin
  if to_regprocedure('public.mk_save_invoice_core(jsonb)') is null then
    alter function public.mk_save_invoice(jsonb) rename to mk_save_invoice_core;
  end if;
end $$;
create or replace function public.mk_save_invoice(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; c text := nullif(p->>'co', '');
begin
  if c is not null and c not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  r := public.mk_save_invoice_core(p);
  if c is not null and r ? 'id' then update public.mk_invoices set co = c where id = (r->>'id')::uuid; end if;
  return r;
end $$;
revoke all on function public.mk_save_invoice(jsonb) from public, anon;
grant execute on function public.mk_save_invoice(jsonb) to authenticated;

-- المرتجعات
do $$ begin
  if to_regprocedure('public.mk_save_return_core(jsonb)') is null then
    alter function public.mk_save_return(jsonb) rename to mk_save_return_core;
  end if;
end $$;
create or replace function public.mk_save_return(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare r uuid; c text := nullif(p->>'co', '');
begin
  if c is not null and c not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  r := public.mk_save_return_core(p);
  if c is not null and r is not null then update public.mk_returns set co = c where id = r; end if;
  return r;
end $$;
revoke all on function public.mk_save_return(jsonb) from public, anon;
grant execute on function public.mk_save_return(jsonb) to authenticated;

-- الدفعات (تحصيل من عميل / سداد لمورد)
do $$ begin
  if to_regprocedure('public.mk_add_payment_core(uuid,numeric,text)') is null then
    alter function public.mk_add_payment(uuid, numeric, text) rename to mk_add_payment_core;
  end if;
end $$;
create or replace function public.mk_add_payment(p_contact uuid, p_amount numeric, p_note text, p_co text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  if p_co is not null and p_co not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  r := public.mk_add_payment_core(p_contact, p_amount, p_note);
  if p_co is not null and r is not null then update public.mk_payments set co = p_co where id = r; end if;
  return r;
end $$;
revoke all on function public.mk_add_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.mk_add_payment(uuid, numeric, text, text) to authenticated;

commit;
-- للتأكد: select co, count(*) from public.mk_invoices group by co;  (المفروض كله mk)

-- ميكانيزم (tkzfjeizvanfptnqvrmr) — هيدرولك م2..م6: التعامل بين الشركتين + الشركاء + السيارة + الأوردرات الميدانية
-- يتشغّل بعد sql/48-company.sql. آمن: بيضيف بس، ومابيمسحش ولا بيغيّر أي بيانات موجودة.
-- هيدرولك قسم دائم جوه ميكانيزم: نفس الجداول ونفس الصلاحيات، ومفيش أي API خارجي.

begin;

-- ===== م2: التعامل بين الشركتين =====
alter table public.mk_invoices add column if not exists ic text check (ic in ('mk','hy'));     -- الشركة التانية في التعامل (null = فاتورة عادية)
alter table public.mk_invoices add column if not exists ic_ref uuid;                           -- بيربط فاتورة البيع بفاتورة الشراء المقابلة
create index if not exists mk_invoices_icref on public.mk_invoices(ic_ref) where ic_ref is not null;

create or replace function public.mk_save_invoice(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; c text := nullif(p->>'co', ''); i text := nullif(p->>'ic', ''); f uuid := nullif(p->>'ic_ref', '')::uuid;
begin
  if c is not null and c not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  if i is not null and i not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  r := public.mk_save_invoice_core(p);
  if r ? 'id' then
    if c is not null then update public.mk_invoices set co = c where id = (r->>'id')::uuid; end if;
    if i is not null then update public.mk_invoices set ic = i, ic_ref = f where id = (r->>'id')::uuid; end if;
  end if;
  return r;
end $$;
revoke all on function public.mk_save_invoice(jsonb) from public, anon;
grant execute on function public.mk_save_invoice(jsonb) to authenticated;

-- ===== م3: الشركاء =====
create table if not exists public.mk_partners(
  id uuid primary key default gen_random_uuid(),
  org uuid default public.mk_org(),
  created_at timestamptz not null default now(),
  co text not null default 'hy' check (co in ('mk','hy')),
  name text not null,
  phone text not null default '',
  share numeric not null default 0,         -- نسبة الشريك من أرباح الشركة (%)
  note text not null default '',
  active boolean not null default true);
create table if not exists public.mk_partner_moves(
  id uuid primary key default gen_random_uuid(),
  org uuid default public.mk_org(),
  created_at timestamptz not null default now(),
  co text not null default 'hy' check (co in ('mk','hy')),
  partner_id uuid not null references public.mk_partners(id) on delete cascade,
  kind text not null check (kind in ('capital','draw','profit')),   -- تمويل / سحب / توزيع أرباح
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  note text not null default '',
  by_name text not null default '');
create index if not exists mk_partner_moves_p on public.mk_partner_moves(partner_id, date desc);

-- ===== م4: السيارة =====
create table if not exists public.mk_vehicles(
  id uuid primary key default gen_random_uuid(),
  org uuid default public.mk_org(),
  created_at timestamptz not null default now(),
  co text not null default 'hy' check (co in ('mk','hy')),
  name text not null,
  plate text not null default '',
  note text not null default '',
  active boolean not null default true);
create table if not exists public.mk_vehicle_log(
  id uuid primary key default gen_random_uuid(),
  org uuid default public.mk_org(),
  created_at timestamptz not null default now(),
  co text not null default 'hy' check (co in ('mk','hy')),
  vehicle_id uuid not null references public.mk_vehicles(id) on delete cascade,
  date date not null default current_date,
  kind text not null default 'بنزين',
  amount numeric not null default 0,
  km numeric,                -- قراءة العداد
  liters numeric,
  note text not null default '',
  expense_id uuid,           -- المصروف اللي اتسجل مع الحركة
  by_name text not null default '');
create index if not exists mk_vehicle_log_v on public.mk_vehicle_log(vehicle_id, date desc);

-- ===== م5: أوردرات هيدرولك الميدانية (ميكانيزم هي اللي بتنفّذ) =====
create table if not exists public.mk_field_orders(
  id uuid primary key default gen_random_uuid(),
  org uuid default public.mk_org(),
  created_at timestamptz not null default now(),
  co text not null default 'hy' check (co in ('mk','hy')),   -- الشركة صاحبة الأوردر
  no text not null default '',
  date date not null default current_date,
  customer text not null default '',
  phone text not null default '',
  addr text not null default '',
  items text not null default '',            -- وصف الشغل / الأصناف (سطر لكل بند)
  total numeric not null default 0,
  status text not null default 'new' check (status in ('new','doing','done','cancel')),
  done_by text not null default '',          -- مين نفّذ
  wh text check (wh in ('mk','hy')),         -- من أنهي مخزن اتخصم
  done_at timestamptz,
  invoice_no text not null default '',
  note text not null default '',
  created_by_name text not null default '');
create index if not exists mk_field_orders_st on public.mk_field_orders(status, date desc);

-- ===== الصلاحيات (نفس نمط باقي الجداول) =====
do $$
declare t text;
begin
  foreach t in array array['mk_partners','mk_partner_moves','mk_vehicles','mk_vehicle_log','mk_field_orders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.mk_is_member())', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_w', t);
    if t = 'mk_field_orders' then
      execute format('create policy %I on public.%I for all to authenticated using (public.mk_is_member()) with check (public.mk_is_member())', t || '_w', t);
    else
      execute format('create policy %I on public.%I for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin())', t || '_w', t);
    end if;
  end loop;
end $$;

commit;

-- ===== فحص بعد التشغيل (المفروض يطلع: كل الفواتير mk، و5 جداول هيدرولك موجودة) =====
select 'invoices_by_co' k, co::text v, count(*)::text n from public.mk_invoices group by co
union all select 'hy_tables', count(*)::text, '' from information_schema.tables where table_schema='public' and table_name in ('mk_partners','mk_partner_moves','mk_vehicles','mk_vehicle_log','mk_field_orders')
union all select 'portal_tables', count(*)::text, '' from information_schema.tables where table_schema='public' and table_name in ('mk_portal','mk_portal_msgs');

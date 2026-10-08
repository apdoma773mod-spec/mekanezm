-- =====================================================================
-- Mika Omnix (أبلكيشن المشتركين) — الجزء 1: المحلات + الجداول + العزل بين المحلات
-- نفس جداول سيستم ميكانيزم بالظبط + عمود org في كل جدول.
-- العزل: سياسة restrictive على كل جدول (org = محل المستخدم)، والدوال بتشتغل بدور mk_fn
-- اللي عليه RLS (مش postgres اللي بيعدّي RLS) — فحتى الدوال ماتقدرش تشوف محل تاني.
-- والكتابة بتتقفل لما الاشتراك/التجربة تخلص (mk_org_active).
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- المحلات ----------
create table if not exists public.mk_orgs(
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  owner uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists mk_orgs_owner on public.mk_orgs(owner);

create table if not exists public.mk_members(
  user_id    uuid primary key references auth.users(id) on delete cascade,
  org        uuid not null references public.mk_orgs(id) on delete cascade,
  name       text not null,
  role       text not null check (role in ('admin','emp')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  email      text
);
create index if not exists mk_members_org on public.mk_members(org);

create or replace function public.mk_org() returns uuid
language sql stable security definer set search_path = public as
$$ select org from public.mk_members where user_id = auth.uid() and active $$;

create or replace function public.mk_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.mk_members where user_id = auth.uid() and active $$;
create or replace function public.mk_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.mk_role() = 'admin', false) $$;
create or replace function public.mk_is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select public.mk_role() is not null $$;
create or replace function public.mk_me_name() returns text
language sql stable security definer set search_path = public as
$$ select coalesce((select name from public.mk_members where user_id = auth.uid()), '') $$;

-- الاشتراك شغال؟ (بيتحسب على صاحب المحل)
create or replace function public.mk_org_active() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select public.app_active(o.owner) from public.mk_orgs o where o.id = public.mk_org()), false) $$;

create or replace function public.mk_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Cairo')::date $$;
create or replace function public.mk_ar_date(d date) returns text
language sql immutable as $$
  select translate(extract(day from d)::int || '/' || extract(month from d)::int || '/' || extract(year from d)::int, '0123456789', '٠١٢٣٤٥٦٧٨٩')
$$;
-- السيستم هنا دايماً على الجداول (مفيش نظام قديم)
create or replace function public.mk_tables_on() returns boolean language sql stable as $$ select true $$;

-- ---------- الجداول (نفس سيستم ميكانيزم + org) ----------
create table if not exists public.mk_settings(
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  key text not null, value jsonb not null, updated_at timestamptz not null default now(),
  primary key (org, key));

create table if not exists public.mk_products(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  code text not null default '', name text not null, cat text not null default '', unit text not null default 'قطعة',
  qty numeric not null default 0, price numeric not null default 0, min numeric not null default 5,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  barcode text not null default '');
create index if not exists mk_products_org_code on public.mk_products(org, code);
create index if not exists mk_products_org_name on public.mk_products(org, name);
create index if not exists mk_products_barcode on public.mk_products(org, barcode) where barcode <> '';

create table if not exists public.mk_product_costs(
  product_id uuid primary key references public.mk_products(id) on delete cascade,
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  cost numeric not null default 0);

create table if not exists public.mk_contacts(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  name text not null, type text not null check (type in ('عميل','مورد')),
  phone text not null default '', addr text not null default '', note text not null default '',
  balance numeric not null default 0, created_at timestamptz not null default now());
create index if not exists mk_contacts_name on public.mk_contacts(org, type, name);

create table if not exists public.mk_invoices(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  kind text not null check (kind in ('sale','purchase')), no text not null,
  date date not null default public.mk_today(), date_txt text not null default '',
  person text not null default '', contact_id uuid references public.mk_contacts(id) on delete set null,
  phone text not null default '', addr text not null default '', note text not null default '',
  ship numeric not null default 0, total numeric not null default 0, paid numeric not null default 0, rem numeric not null default 0,
  source text not null default '', web_order_id uuid, quote_id uuid,
  created_by uuid default auth.uid(), created_by_name text not null default '',
  created_at timestamptz not null default now(), edited_at timestamptz, edited_by_name text);
create unique index if not exists mk_invoices_no on public.mk_invoices(org, kind, no);
create index if not exists mk_invoices_date on public.mk_invoices(org, kind, date);

create table if not exists public.mk_invoice_items(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  invoice_id uuid not null references public.mk_invoices(id) on delete cascade,
  product_id uuid references public.mk_products(id) on delete set null,
  product_name text not null, qty numeric not null, price numeric not null default 0, total numeric not null default 0, pos int not null default 0);
create index if not exists mk_items_invoice on public.mk_invoice_items(invoice_id);
create index if not exists mk_items_product on public.mk_invoice_items(product_id);

create table if not exists public.mk_item_costs(
  item_id uuid primary key references public.mk_invoice_items(id) on delete cascade,
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  cost numeric not null default 0);

create table if not exists public.mk_payments(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  contact_id uuid references public.mk_contacts(id) on delete set null, name text not null default '',
  dir text not null check (dir in ('in','out')), amount numeric not null, note text not null default '',
  date date not null default public.mk_today(), date_txt text not null default '', created_by_name text not null default '',
  created_at timestamptz not null default now());

create table if not exists public.mk_returns(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  type text not null check (type in ('sale','purchase')), product_id uuid references public.mk_products(id) on delete set null,
  product_name text not null default '', person text not null default '', qty numeric not null default 0,
  price numeric not null default 0, total numeric not null default 0, cost numeric, note text not null default '',
  date date not null default public.mk_today(), date_txt text not null default '', created_by_name text not null default '',
  created_at timestamptz not null default now());

create table if not exists public.mk_expenses(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  note text not null default '', cat text not null default 'عام', amount numeric not null default 0,
  date date not null default public.mk_today(), date_txt text not null default '', created_by_name text not null default '',
  created_at timestamptz not null default now());

create table if not exists public.mk_quotes(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  no text not null, date date not null default public.mk_today(), date_txt text not null default '',
  person text not null default '', phone text not null default '', addr text not null default '', note text not null default '',
  ship numeric not null default 0, items jsonb not null default '[]', total numeric not null default 0,
  status text not null default 'open', inv_no text, created_by uuid default auth.uid(), created_by_name text not null default '',
  created_at timestamptz not null default now(), edited_at timestamptz);

create table if not exists public.mk_voided(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  kind text not null, label text not null default '', data jsonb not null, by_name text not null default '',
  at timestamptz not null default now());

create table if not exists public.mk_log(
  id bigserial primary key,
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  at timestamptz not null default now(), user_id uuid default auth.uid(), user_name text not null default '',
  action text not null, ref text not null default '', details jsonb);
create index if not exists mk_log_at on public.mk_log(org, at desc);

create table if not exists public.mk_backups(
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  day date not null, data jsonb not null, made_at timestamptz not null default now(),
  primary key (org, day));

create table if not exists public.mk_stock_moves(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  product_id uuid references public.mk_products(id) on delete cascade, product_name text not null default '',
  kind text not null check (kind in ('count','adjust')), qty_before numeric not null default 0, qty_after numeric not null default 0,
  diff numeric not null default 0, cost numeric, note text not null default '', ref text not null default '',
  by_name text not null default '', date date not null default public.mk_today(), at timestamptz not null default now());
create index if not exists mk_moves_product on public.mk_stock_moves(product_id, at);

create table if not exists public.mk_counts(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  no text not null default '', note text not null default '', items jsonb not null default '[]', n_items int not null default 0,
  short_value numeric not null default 0, excess_value numeric not null default 0, by_name text not null default '',
  date date not null default public.mk_today(), at timestamptz not null default now());

create table if not exists public.mk_closings(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  day date not null, data jsonb not null, cash_expected numeric not null default 0, cash_actual numeric, cash_diff numeric,
  note text not null default '', by_name text not null default '', at timestamptz not null default now());
create index if not exists mk_closings_day on public.mk_closings(org, day desc);

create sequence if not exists public.mk_ship_seq;
create table if not exists public.mk_shipments(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  no text unique not null default ('SP-' || lpad(nextval('public.mk_ship_seq')::text, 4, '0')),
  kind text not null default 'ship' check (kind in ('ship','delivery')),
  status text not null default 'new' check (status in ('new','printed','handed','out','delivered','paid','returned','cancelled')),
  inv_no text, web_order_id uuid, name text not null default '', phone text not null default '', phone2 text not null default '',
  gov text not null default '', area text not null default '', address text not null default '', carrier text not null default '',
  tracking text not null default '', driver text not null default '', driver_phone text not null default '',
  cod numeric not null default 0, fee numeric not null default 0, pieces int not null default 1 check (pieces between 1 and 50),
  content text not null default '', note text not null default '', log jsonb not null default '[]', created_by text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz);
create index if not exists mk_shipments_inv on public.mk_shipments(org, inv_no);
create index if not exists mk_shipments_status on public.mk_shipments(org, status);

create table if not exists public.mk_daybook(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  day date not null default public.mk_today(), product_id uuid, name text not null,
  qty numeric not null check (qty > 0), price numeric not null default 0 check (price >= 0), owed numeric not null default 0 check (owed >= 0),
  person text not null default '', pay text not null default 'cash' check (pay in ('cash','insta','transfer','credit')),
  note text not null default '', created_by text not null default '', created_at timestamptz not null default now(),
  committed_at timestamptz, delivered_at timestamptz, posted_at timestamptz, invoice_id uuid, invoice_no text,
  kind text not null default 'item' check (kind in ('item','pay')),
  constraint mk_daybook_owed_le_qty check (owed <= qty));
create index if not exists mk_daybook_day on public.mk_daybook(org, day);
create index if not exists mk_daybook_due on public.mk_daybook(created_at) where committed_at is null and posted_at is null;

create table if not exists public.mk_scans(
  id uuid primary key default gen_random_uuid(),
  org uuid not null default public.mk_org() references public.mk_orgs(id) on delete cascade,
  created_at timestamptz not null default now(), created_by text not null default '',
  status text not null default 'pending' check (status in ('pending','working','done','failed','used')),
  pages jsonb not null default '[]', supplier text not null default '', result jsonb, error text not null default '',
  attempts int not null default 0, next_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists mk_scans_status on public.mk_scans(org, status, next_at);

-- طلبات الواتساب (كل محل ليه سر خاص بالجسر بتاعه)
create table if not exists public.wa_config(
  org uuid primary key default public.mk_org() references public.mk_orgs(id) on delete cascade,
  secret text not null unique default encode(gen_random_bytes(18), 'hex'));
create table if not exists public.wa_orders(
  id uuid primary key default gen_random_uuid(),
  org uuid not null references public.mk_orgs(id) on delete cascade,
  created_at timestamptz not null default now(), msg_id text, phone text, customer_name text, body text not null,
  status text not null default 'new', invoice_no text, handled_at timestamptz);
create unique index if not exists wa_orders_msg on public.wa_orders(org, msg_id);

select 'OK - part A (tables)' as result;

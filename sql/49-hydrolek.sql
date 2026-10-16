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

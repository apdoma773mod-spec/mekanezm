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

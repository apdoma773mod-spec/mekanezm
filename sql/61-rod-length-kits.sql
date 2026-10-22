-- 61: طول العود في بيانات الصنف (#8) + علامة «الطقم» على سطور الفاتورة (#7)
-- آمن: نسخة احتياطية الأول، وأعمدة جديدة فاضية بس — مفيش بيانات قديمة بتتغير.

-- 1) نسخة احتياطية
create schema if not exists bak_20261022;
create table if not exists bak_20261022.mk_products_pre61 as select * from public.mk_products;
create table if not exists bak_20261022.mk_invoice_items_pre61 as select * from public.mk_invoice_items;

-- 2) طول العود بالمتر (فاضي = مش متسجل)
alter table public.mk_products add column if not exists len_m numeric;

-- 3) اسم الطقم على سطور الفاتورة: السطور اللي ليها نفس العلامة بتتعرض سطر واحد
--    الشكل: رقم|العدد|اسم الطقم
alter table public.mk_invoice_items add column if not exists kit text;

-- 4) الحفظ: نفس الدالة القديمة + بتكتب علامة الطقم لكل سطر بترتيبه
create or replace function public.mk_save_invoice(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r jsonb; c text := nullif(p->>'co', ''); i text := nullif(p->>'ic', ''); f uuid := nullif(p->>'ic_ref', '')::uuid;
begin
  if c is not null and c not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  if i is not null and i not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  r := public.mk_save_invoice_core(p);
  if r ? 'id' then
    if c is not null then update public.mk_invoices set co = c where id = (r->>'id')::uuid; end if;
    if i is not null then update public.mk_invoices set ic = i, ic_ref = f where id = (r->>'id')::uuid; end if;
    update public.mk_invoice_items ii set kit = x.kit
      from (select e.ord::int as pos, nullif(e.val->>'kit', '') as kit
              from jsonb_array_elements(p->'items') with ordinality as e(val, ord)) x
     where ii.invoice_id = (r->>'id')::uuid and ii.pos = x.pos and x.kit is not null;
  end if;
  return r;
end $function$;

-- للرجوع: الدالة القديمة هي نفس اللي فوق من غير جملة update بتاعة kit.

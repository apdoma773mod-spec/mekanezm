-- ميكانيزم (tkzfjeizvanfptnqvrmr) — 🎁 هدايا الصنايعية + ⚠️ البضاعة المخربشة (درجة تانية) + التكلفة التقديرية للبضاعة القديمة
-- كل حركة بتخصم من المخزن على السيرفر (مرة واحدة ومضمونة) وبتتسجل في حركة الصنف.

-- ========== 🎁 الهدايا ==========
create table if not exists public.mk_gifts(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_id uuid references public.mk_products(id) on delete set null,
  product_name text not null default '',
  qty numeric not null default 0,
  cost numeric not null default 0,          -- تكلفة الوحدة وقت الهدية
  price numeric not null default 0,         -- سعر البيع وقت الهدية
  to_name text not null default '',
  to_phone text not null default '',
  to_kind text not null default 'صنايعي',   -- صنايعي / مساعد صنايعي / مهندس / عميل / أخرى
  note text not null default '',
  by_name text not null default '');
create index if not exists mk_gifts_at on public.mk_gifts(created_at desc);
create index if not exists mk_gifts_to on public.mk_gifts(to_phone);
alter table public.mk_gifts enable row level security;
revoke all on public.mk_gifts from anon;
grant select, delete on public.mk_gifts to authenticated;
drop policy if exists mk_gifts_sel on public.mk_gifts;
create policy mk_gifts_sel on public.mk_gifts for select to authenticated using (public.mk_is_member());
drop policy if exists mk_gifts_del on public.mk_gifts;
create policy mk_gifts_del on public.mk_gifts for delete to authenticated using (public.mk_is_admin());

create or replace function public.mk_gift(p_product uuid, p_qty numeric, p_to text, p_phone text, p_kind text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; c numeric; gid uuid; who text := public.mk_me();
begin
  if not public.mk_is_member() then raise exception 'not_member'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'اكتب الكمية'; end if;
  if coalesce(btrim(p_to), '') = '' then raise exception 'اكتب اسم اللي خد الهدية'; end if;
  select * into p from public.mk_products where id = p_product for update;
  if not found then raise exception 'الصنف مش موجود'; end if;
  if p.qty < p_qty then raise exception 'الرصيد % بس', p.qty; end if;
  c := coalesce((select cost from public.mk_product_costs where product_id = p.id), 0);
  update public.mk_products set qty = qty - p_qty, updated_at = now() where id = p.id;
  insert into public.mk_stock_moves(product_id, product_name, kind, qty_before, qty_after, diff, cost, note, ref, by_name)
  values (p.id, p.name, 'adjust', p.qty, p.qty - p_qty, -p_qty, c, '🎁 هدية لـ ' || p_to || coalesce(' (' || nullif(p_kind, '') || ')', ''), 'gift', who);
  insert into public.mk_gifts(product_id, product_name, qty, cost, price, to_name, to_phone, to_kind, note, by_name)
  values (p.id, p.name, p_qty, c, p.price, btrim(p_to), btrim(coalesce(p_phone, '')), coalesce(nullif(p_kind, ''), 'صنايعي'), coalesce(p_note, ''), who)
  returning id into gid;
  perform public.mk_alert('gift', '🎁 ' || coalesce(nullif(who, ''), 'حد') || ' ادّى هدية: ' || p.name || ' × ' || public.mk_n(p_qty)
    || E'\nلـ ' || p_to || coalesce(' (' || nullif(p_kind, '') || ')', '') || coalesce(' — ' || nullif(p_phone, ''), '')
    || E'\nقيمتها بسعر البيع ' || public.mk_n(p.price * p_qty) || ' ج' || coalesce(E'\n' || nullif(p_note, ''), ''));
  return gid;
end $$;

-- ========== ⚠️ درجة تانية (مخربش / متجرح) ==========
-- بينقل كمية من الصنف لصنف «درجة تانية» مرتبط بيه (بيتعمل أول مرة بكود جديد وسعر أقل)
create or replace function public.mk_grade_move(p_product uuid, p_qty numeric, p_price numeric, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; t record; tid uuid; c numeric; mx int; who text := public.mk_me(); g text; nm text;
begin
  if not public.mk_is_admin() then raise exception 'للمدير بس'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'اكتب الكمية'; end if;
  select * into p from public.mk_products where id = p_product for update;
  if not found then raise exception 'الصنف مش موجود'; end if;
  if p.qty < p_qty then raise exception 'الرصيد % بس', p.qty; end if;
  c := coalesce((select cost from public.mk_product_costs where product_id = p.id), 0);
  g := coalesce(nullif((select grp from public.mk_product_info where product_id = p.id), ''), p.name);
  nm := p.name || ' (درجة تانية)';
  select * into t from public.mk_products where name = nm limit 1;
  if not found then
    select coalesce(max((substring(code from '^P(\d+)$'))::int), 0) into mx from public.mk_products where code ~ '^P\d+$';
    insert into public.mk_products(code, name, cat, unit, qty, price, min, barcode)
    values ('P' || lpad((mx + 1)::text, 4, '0'), nm, p.cat, p.unit, 0, coalesce(nullif(p_price, 0), round(p.price * 0.75)), 0, '')
    returning * into t;
    if c > 0 then insert into public.mk_product_costs(product_id, cost) values (t.id, c) on conflict (product_id) do update set cost = excluded.cost; end if;
    insert into public.mk_product_info(product_id, grp, finish, specs) values (t.id, g, 'درجة تانية — مخربش / متجرح', 'فيه خدوش أو جروح بسيطة في الشكل، وشغال تمام')
    on conflict (product_id) do update set grp = excluded.grp, finish = excluded.finish;
    insert into public.mk_product_info(product_id, grp) values (p.id, g) on conflict (product_id) do update set grp = case when public.mk_product_info.grp = '' then excluded.grp else public.mk_product_info.grp end;
  elsif coalesce(p_price, 0) > 0 then
    update public.mk_products set price = p_price where id = t.id;
  end if;
  update public.mk_products set qty = qty - p_qty, updated_at = now() where id = p.id;
  update public.mk_products set qty = qty + p_qty, updated_at = now() where id = t.id;
  insert into public.mk_stock_moves(product_id, product_name, kind, qty_before, qty_after, diff, cost, note, ref, by_name) values
    (p.id, p.name, 'adjust', p.qty, p.qty - p_qty, -p_qty, c, '⚠️ اتنقل لدرجة تانية (مخربش)' || coalesce(' — ' || nullif(p_note, ''), ''), 'grade', who),
    (t.id, t.name, 'adjust', t.qty, t.qty + p_qty, p_qty, c, '⚠️ جه من الصنف الأصلي (مخربش)' || coalesce(' — ' || nullif(p_note, ''), ''), 'grade', who);
  return t.id;
end $$;

-- ========== 💰 التكلفة التقديرية (بضاعة قديمة مش فاكر سعر شرائها) ==========
alter table public.mk_product_info add column if not exists cost_est boolean not null default false;

-- التنبيه الفوري: الهدايا ليها تنبيه لوحدها، والدرجة التانية مش تعديل يدوي
create or replace function public.mk_alert_adjust() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'adjust' and coalesce(new.diff, 0) <> 0 and coalesce(new.ref, '') not in ('gift', 'grade') then
    perform public.mk_alert('adjust', '📦 ' || coalesce(nullif(new.by_name, ''), public.mk_me(), 'حد') || ' عدّل رصيد «' || coalesce(new.product_name, '') || '» يدوي من '
      || public.mk_n(new.qty_before) || ' لـ ' || public.mk_n(new.qty_after) || ' (' || case when new.diff > 0 then '+' else '' end || public.mk_n(new.diff) || ')'
      || coalesce(E'\nالسبب: ' || nullif(new.note, ''), ''));
  end if;
  return null;
exception when others then return null;
end $$;

revoke all on function public.mk_gift(uuid, numeric, text, text, text, text), public.mk_grade_move(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.mk_gift(uuid, numeric, text, text, text, text), public.mk_grade_move(uuid, numeric, numeric, text) to authenticated;
select 'OK gifts + grades' as result;

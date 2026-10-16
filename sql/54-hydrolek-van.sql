-- ميكانيزم — 🚚 هيدرولك دفعة ب: مكان البضاعة (العربية) + التحميل + تصفية آخر اليوم
-- يتشغّل مرة واحدة في Supabase SQL Editor بعد sql/53-field-orders-quick.sql.
-- آمن: بيضيف جداول ودوال جديدة بس، ومابيمسحش ولا بيعدّل أي بيانات موجودة.
-- الفكرة: رصيد الصنف الكلي (mk_products.qty) زي ما هو. العربية = جزء من بضاعة هيدرولك، بيتحسب من «حركات العربية».

begin;

-- ===== حركات العربية (كل حركة بإشارة: موجب = دخل العربية، سالب = خرج منها) =====
create table if not exists public.mk_van_moves(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null default current_date,
  vehicle_id uuid references public.mk_vehicles(id) on delete set null,
  product_id uuid not null,                                  -- صنف هيدرولك (mk_products.id)
  name text not null default '',
  kind text not null check (kind in ('load','sale','return','unload','adjust')),  -- تحميل / بيع / مرتجع / رجوع للمخزن / عجز-زيادة
  qty numeric not null,
  funder text not null default '',                           -- اسم الشريك الممول (فاضي = من غير ممول)
  src text not null default '' check (src in ('','partner','mk','hy')),   -- مصدر التحميل
  cost numeric not null default 0,                           -- تكلفة الوحدة
  ref text not null default '',                              -- رقم الفاتورة / التصفية
  note text not null default '',
  by_name text not null default '');
create index if not exists mk_van_moves_pf on public.mk_van_moves(product_id, funder);
create index if not exists mk_van_moves_d on public.mk_van_moves(date desc);

-- رصيد العربية الحالي لكل صنف وممول
create or replace view public.mk_van_stock with (security_invoker = true) as
  select product_id, funder, max(name) as name, sum(qty) as qty,
         coalesce(sum(qty * cost) filter (where kind = 'load') / nullif(sum(qty) filter (where kind = 'load'), 0), max(cost)) as cost
  from public.mk_van_moves group by product_id, funder
  having abs(sum(qty)) > 0.0001;

-- ملخص لكل ممول (لكشف حساب الشركاء)
create or replace view public.mk_van_fund with (security_invoker = true) as
  select funder, kind, sum(qty) as qty, sum(qty * cost) as value
  from public.mk_van_moves group by funder, kind;

-- ===== تصفية العربية (مرة لكل يوم لكل عربية) =====
create table if not exists public.mk_van_close(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null,
  vehicle_id uuid references public.mk_vehicles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,                   -- تفاصيل الأصناف والفلوس
  cash numeric not null default 0,                           -- المحصّل كاش
  credit numeric not null default 0,                         -- الآجل
  expenses numeric not null default 0,                       -- مصروفات العربية
  expected_cash numeric not null default 0,                  -- المفروض يتسلم
  handed numeric not null default 0,                         -- اتسلم فعلاً
  diff_value numeric not null default 0,                     -- قيمة عجز/زيادة البضاعة
  note text not null default '',
  closed boolean not null default true,
  closed_at timestamptz not null default now(),
  by_name text not null default '',
  reopened_by text not null default '',
  reopened_at timestamptz);
create unique index if not exists mk_van_close_day on public.mk_van_close(date, coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- التصفية المقفولة ماتتعدلش ولا تتمسح. الفتح للمدير بس.
create or replace function public.mk_van_close_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.closed then raise exception 'التصفية مقفولة — افتحها الأول'; end if;
    return old;
  end if;
  if old.closed and new.closed then raise exception 'التصفية مقفولة — افتحها الأول'; end if;
  if old.closed and not new.closed and not coalesce(public.mk_is_admin(), false) then raise exception 'فتح التصفية للمدير بس'; end if;
  return new;
end $$;
drop trigger if exists mk_van_close_guard on public.mk_van_close;
create trigger mk_van_close_guard before update or delete on public.mk_van_close for each row execute function public.mk_van_close_guard();

-- ===== الصلاحيات: قراءة للأعضاء، والكتابة عن طريق الدوال بس =====
alter table public.mk_van_moves enable row level security;
alter table public.mk_van_close enable row level security;
revoke all on public.mk_van_moves, public.mk_van_close from anon;
grant select on public.mk_van_moves to authenticated;
grant select, update on public.mk_van_close to authenticated;
grant select on public.mk_van_stock, public.mk_van_fund to authenticated;
drop policy if exists mk_van_moves_sel on public.mk_van_moves;
create policy mk_van_moves_sel on public.mk_van_moves for select to authenticated using (public.mk_is_member());
drop policy if exists mk_van_close_sel on public.mk_van_close;
create policy mk_van_close_sel on public.mk_van_close for select to authenticated using (public.mk_is_member());
drop policy if exists mk_van_close_upd on public.mk_van_close;
create policy mk_van_close_upd on public.mk_van_close for update to authenticated using (public.mk_is_member()) with check (public.mk_is_member());

-- ===== حركة على العربية =====
-- p: {kind, product_id, name, qty, funder, src, cost, ref, note, by, vehicle_id, date, force, only_funder}
-- الخروج (بيع/رجوع/عجز) بياخد من الممولين بالأقدم تحميلًا. force=true: ياخد المتاح ومايوقفش لو ناقص.
create or replace function public.mk_van_move(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text := p->>'kind';
  pid uuid := (p->>'product_id')::uuid;
  q numeric := coalesce((p->>'qty')::numeric, 0);
  f text := coalesce(p->>'funder', '');
  nm text := coalesce(p->>'name', '');
  vid uuid := nullif(p->>'vehicle_id', '')::uuid;
  d date := coalesce(nullif(p->>'date', '')::date, current_date);
  rf text := coalesce(p->>'ref', '');
  nt text := coalesce(p->>'note', '');
  who text := coalesce(p->>'by', '');
  frc boolean := coalesce((p->>'force')::boolean, false);
  onlyf boolean := coalesce((p->>'only_funder')::boolean, false);
  need numeric; tk numeric; r record; outv jsonb := '[]'::jsonb;
begin
  if not coalesce(public.mk_is_member(), false) then raise exception 'مش مسموح'; end if;
  if k is null or k not in ('load','sale','return','unload','adjust') then raise exception 'نوع حركة غير معروف'; end if;
  if pid is null then raise exception 'الصنف مش محدد'; end if;
  if q = 0 then return outv; end if;
  if k in ('load','return') and q < 0 then raise exception 'الكمية لازم تكون موجبة'; end if;
  perform pg_advisory_xact_lock(hashtext('van:' || pid::text));

  if k in ('load','return') or (k = 'adjust' and q > 0) then
    insert into public.mk_van_moves(date, vehicle_id, product_id, name, kind, qty, funder, src, cost, ref, note, by_name)
    values (d, vid, pid, nm, k, abs(q), f, coalesce(nullif(p->>'src', ''), ''), coalesce((p->>'cost')::numeric, 0), rf, nt, who);
    return jsonb_build_array(jsonb_build_object('funder', f, 'qty', abs(q)));
  end if;

  need := abs(q);
  for r in
    select s.funder, sum(s.qty) as qty,
           coalesce(sum(s.qty * s.cost) filter (where s.kind = 'load') / nullif(sum(s.qty) filter (where s.kind = 'load'), 0), 0) as cost,
           min(s.created_at) as t0
    from public.mk_van_moves s
    where s.product_id = pid and (not onlyf or s.funder = f)
    group by s.funder having sum(s.qty) > 0.0001
    order by min(s.created_at)
  loop
    exit when need <= 0.0001;
    tk := least(need, r.qty);
    insert into public.mk_van_moves(date, vehicle_id, product_id, name, kind, qty, funder, src, cost, ref, note, by_name)
    values (d, vid, pid, nm, k, -tk, r.funder, '', r.cost, rf, nt, who);
    outv := outv || jsonb_build_object('funder', r.funder, 'qty', tk, 'cost', r.cost);
    need := need - tk;
  end loop;
  if need > 0.0001 and not frc then
    raise exception 'رصيد «%» على العربية مش كفاية — ناقص %', nm, round(need, 2);
  end if;
  return outv;
end $$;

-- ===== قفل تصفية يوم (كله مرة واحدة: العجز/الزيادة + الرجوع للمخزن + حفظ التصفية) =====
-- p: {date, vehicle_id, by, note, cash, credit, expenses, expected_cash, handed, diff_value, data, adj:[{product_id,name,qty,note}], unload:[{product_id,name,qty}]}
create or replace function public.mk_van_close_day(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  d date := (p->>'date')::date;
  vid uuid := nullif(p->>'vehicle_id', '')::uuid;
  z uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  rf text; it jsonb; cid uuid;
begin
  if not coalesce(public.mk_is_member(), false) then raise exception 'مش مسموح'; end if;
  if d is null then raise exception 'اليوم مش محدد'; end if;
  perform pg_advisory_xact_lock(hashtext('vanclose:' || d::text));
  if exists (select 1 from public.mk_van_close where date = d and coalesce(vehicle_id, z) = coalesce(vid, z) and closed) then
    raise exception 'تصفية اليوم ده متقفلة خلاص';
  end if;
  delete from public.mk_van_close where date = d and coalesce(vehicle_id, z) = coalesce(vid, z) and not closed;   -- تصفية اتفتحت للتعديل
  rf := 'تصفية ' || to_char(d, 'YYYY-MM-DD');
  for it in select * from jsonb_array_elements(coalesce(p->'adj', '[]'::jsonb)) loop
    perform public.mk_van_move(jsonb_build_object('kind', 'adjust', 'product_id', it->>'product_id', 'name', coalesce(it->>'name', ''),
      'qty', (it->>'qty')::numeric, 'vehicle_id', coalesce(p->>'vehicle_id', ''), 'date', d, 'ref', rf, 'note', coalesce(it->>'note', ''), 'by', coalesce(p->>'by', ''), 'force', true));
  end loop;
  for it in select * from jsonb_array_elements(coalesce(p->'unload', '[]'::jsonb)) loop
    perform public.mk_van_move(jsonb_build_object('kind', 'unload', 'product_id', it->>'product_id', 'name', coalesce(it->>'name', ''),
      'qty', (it->>'qty')::numeric, 'vehicle_id', coalesce(p->>'vehicle_id', ''), 'date', d, 'ref', rf, 'note', 'رجع المخزن في التصفية', 'by', coalesce(p->>'by', ''), 'force', true));
  end loop;
  insert into public.mk_van_close(date, vehicle_id, data, cash, credit, expenses, expected_cash, handed, diff_value, note, by_name)
  values (d, vid, coalesce(p->'data', '{}'::jsonb), coalesce((p->>'cash')::numeric, 0), coalesce((p->>'credit')::numeric, 0),
          coalesce((p->>'expenses')::numeric, 0), coalesce((p->>'expected_cash')::numeric, 0), coalesce((p->>'handed')::numeric, 0),
          coalesce((p->>'diff_value')::numeric, 0), coalesce(p->>'note', ''), coalesce(p->>'by', ''))
  returning id into cid;
  return cid;
end $$;

revoke all on function public.mk_van_move(jsonb), public.mk_van_close_day(jsonb) from public, anon;
grant execute on function public.mk_van_move(jsonb), public.mk_van_close_day(jsonb) to authenticated;

commit;
-- للتأكد: select * from public.mk_van_stock limit 5;  و  select count(*) from public.mk_van_close;

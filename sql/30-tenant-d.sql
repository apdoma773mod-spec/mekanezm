-- =====================================================================
-- Mika Omnix — الجزء 4: التسجيل (محل جديد + مديره) + حالة الاشتراك + لوحة المدير + المهام الأوتوماتيك
-- =====================================================================
-- مشترك جديد: محل جديد فاضي + هو المدير + بيانات المحل + اشتراك تجريبي
-- (الموظفين اللي المدير بيضيفهم بيتعملوا بـ staff=true فمش بيتعملهم محل)
create or replace function public.app_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int; o uuid; shop text := btrim(coalesce(new.raw_user_meta_data->>'shop', '')); ph text := btrim(coalesce(new.raw_user_meta_data->>'phone', ''));
begin
  if coalesce(new.raw_user_meta_data->>'staff', '') = 'true' then return new; end if;
  select coalesce((value)::text::int, 7) into d from app_config where key = 'trial_days';
  insert into app_subs(owner, email, shop, phone, trial_end)
  values (new.id, coalesce(new.email,''), shop, ph, now() + make_interval(days => coalesce(d,7)))
  on conflict (owner) do nothing;
  insert into mk_orgs(name, owner) values (shop, new.id) on conflict (owner) do nothing returning id into o;
  if o is not null then
    insert into mk_members(user_id, org, name, role, email)
    values (new.id, o, coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), 'المدير'), 'admin', new.email)
    on conflict (user_id) do nothing;
    insert into mk_settings(org, key, value) values (o, 'company', jsonb_build_object('name', shop, 'phone', ph, 'address', '', 'ownerPhone', ph))
    on conflict (org, key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists app_on_signup on auth.users;
create trigger app_on_signup after insert on auth.users for each row execute function public.app_on_signup();

-- الحسابات اللي اتعملت قبل كده (من غير محل) — نعملها محل
do $$
declare u record; o uuid;
begin
  for u in select au.id, au.email, coalesce(s.shop, au.raw_user_meta_data->>'shop', '') shop, coalesce(s.phone, au.raw_user_meta_data->>'phone', '') phone
             from auth.users au left join app_subs s on s.owner = au.id
            where not exists (select 1 from mk_members m where m.user_id = au.id)
              and coalesce(au.raw_user_meta_data->>'staff', '') <> 'true' loop
    insert into mk_orgs(name, owner) values (u.shop, u.id) on conflict (owner) do nothing returning id into o;
    if o is null then select id into o from mk_orgs where owner = u.id; end if;
    insert into mk_members(user_id, org, name, role, email) values (u.id, o, 'المدير', 'admin', u.email) on conflict (user_id) do nothing;
    insert into mk_settings(org, key, value) values (o, 'company', jsonb_build_object('name', u.shop, 'phone', u.phone, 'address', '', 'ownerPhone', u.phone))
      on conflict (org, key) do nothing;
  end loop;
end $$;

-- حالة الاشتراك (للمدير والموظفين: بيتحسب على صاحب المحل)
create or replace function public.app_my_sub(p_shop text default null, p_phone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_subs; own uuid; adm boolean := public.app_is_admin(); st text; is_owner boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select o.owner into own from mk_orgs o where o.id = public.mk_org();
  own := coalesce(own, auth.uid());
  is_owner := own = auth.uid();
  if is_owner then
    insert into app_subs(owner, email) values (auth.uid(), coalesce(auth.jwt()->>'email','')) on conflict (owner) do nothing;
    update app_subs set last_seen = now(),
      shop = case when coalesce(p_shop,'') <> '' then left(p_shop,120) else shop end,
      phone = case when coalesce(p_phone,'') <> '' then left(p_phone,40) else phone end
    where owner = own;
  else
    update app_subs set last_seen = now() where owner = own;
  end if;
  select * into s from app_subs where owner = own;
  st := case when adm then 'admin' when s.owner is null then 'expired' when s.blocked then 'blocked'
             when s.paid_until is not null and now() < s.paid_until then 'active'
             when now() < s.trial_end then 'trial' else 'expired' end;
  return jsonb_build_object('status', st, 'trial_end', s.trial_end, 'paid_until', s.paid_until,
    'email', s.email, 'shop', s.shop, 'admin', adm, 'owner', is_owner,
    'days_left', greatest(0, ceil(extract(epoch from (case when st = 'active' then s.paid_until else s.trial_end end) - now()) / 86400))::int);
end $$;

-- لوحة المدير: الأعداد من جداول المحل
create or replace function public.app_admin_list() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_admin() then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select s.owner, s.email, s.shop, s.phone, s.created_at, s.trial_end, s.paid_until, s.blocked, s.note, s.last_seen,
      coalesce((select count(*) from mk_products p where p.org = o.id), 0) as products,
      coalesce((select count(*) from mk_invoices i where i.org = o.id and i.kind = 'sale'), 0) as sales,
      coalesce((select count(*) from mk_invoices i where i.org = o.id and i.kind = 'purchase'), 0) as purchases,
      coalesce((select count(*) from mk_members m where m.org = o.id), 0) as members,
      (select max(i.created_at) from mk_invoices i where i.org = o.id) as updated_at
    from app_subs s left join mk_orgs o on o.owner = s.owner) x), '[]'::jsonb);
end $$;

-- النسخ الاحتياطي اليومي لكل محل
create or replace function public.mk_backup_all() returns int
language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  for o in select id, owner from mk_orgs loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', o.owner, 'role', 'authenticated')::text, true);
      perform public.mk_backup_now(); n := n + 1;
    exception when others then null;
    end;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;
revoke all on function public.mk_backup_all() from public, anon, authenticated;

revoke all on function public.app_my_sub(text,text), public.app_admin_list() from anon, public;
grant execute on function public.app_my_sub(text,text), public.app_admin_list() to authenticated;
grant execute on function public.app_active(uuid), public.app_is_admin() to authenticated, mk_fn;

do $$ begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron: %', sqlerrm; end $$;
do $$ begin perform cron.unschedule('mk-daybook-commit'); exception when others then null; end $$;
do $$ begin perform cron.schedule('mk-daybook-commit', '* * * * *', 'select public.mk_daybook_commit_due()'); exception when others then raise notice 'cron: %', sqlerrm; end $$;
do $$ begin perform cron.unschedule('mk-daily-backup'); exception when others then null; end $$;
do $$ begin perform cron.schedule('mk-daily-backup', '0 1 * * *', 'select public.mk_backup_all()'); exception when others then raise notice 'cron: %', sqlerrm; end $$;

select 'OK - part D (signup + subs + cron)' as result;

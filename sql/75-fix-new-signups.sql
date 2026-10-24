create or replace function public.app_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int; o uuid; shop text := btrim(coalesce(new.raw_user_meta_data->>'shop', '')); ph text := btrim(coalesce(new.raw_user_meta_data->>'phone', ''));
        ind text := btrim(coalesce(new.raw_user_meta_data->>'industry', ''));
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
    -- applied=false: السيستم هيضيف الأقسام والأصناف الجاهزة أول دخول للمدير
    if ind <> '' then
      insert into mk_settings(org, key, value) values (o, 'industry', jsonb_build_object('id', ind, 'applied', false))
      on conflict (org, key) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists app_on_signup on auth.users;
create trigger app_on_signup after insert on auth.users for each row execute function public.app_on_signup();
do $$
declare u record; o uuid;
begin
  for u in select au.id, au.email, coalesce(s.shop, au.raw_user_meta_data->>'shop', '') shop, coalesce(s.phone, au.raw_user_meta_data->>'phone', '') phone, au.raw_user_meta_data->>'industry' ind
             from auth.users au left join app_subs s on s.owner = au.id
            where not exists (select 1 from mk_members m where m.user_id = au.id)
              and coalesce(au.raw_user_meta_data->>'staff', '') <> 'true' loop
    insert into app_subs(owner, email, shop, phone, trial_end) values (u.id, coalesce(u.email,''), u.shop, u.phone, now() + interval '7 days') on conflict (owner) do nothing;
    insert into mk_orgs(name, owner) values (u.shop, u.id) on conflict (owner) do nothing returning id into o;
    if o is null then select id into o from mk_orgs where owner = u.id; end if;
    insert into mk_members(user_id, org, name, role, email) values (u.id, o, 'المدير', 'admin', u.email) on conflict (user_id) do nothing;
    insert into mk_settings(org, key, value) values (o, 'company', jsonb_build_object('name', u.shop, 'phone', u.phone, 'address', '', 'ownerPhone', u.phone)) on conflict (org, key) do nothing;
    if coalesce(u.ind,'') <> '' then insert into mk_settings(org, key, value) values (o, 'industry', jsonb_build_object('id', u.ind, 'applied', false)) on conflict (org, key) do nothing; end if;
  end loop;
end $$;

-- ميكانيكس — حفظ مجال المحل عند التسجيل (اختياري: السيستم بيشتغل من غيره لأنه بيقرا المجال من بيانات التسجيل)
-- شغّله مرة واحدة في Supabase → SQL Editor
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

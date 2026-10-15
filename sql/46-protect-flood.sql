-- 46-protect-flood.sql  (2026-10-15)  حماية من الإغراق (حد أقصى للطلبات)
-- لو حد (أو برنامج) حاول يبعت مئات الأوردرات من المتجر أو يغرق الواتساب برسايل:
-- السيستم بيقبل عدد معقول بس من كل رقم ومن الكل في الساعة، والباقي بيترفض بهدوء.
-- الموظفين المسجلين دخول مش بيتأثروا خالص.
-- آمن تشغّله أكتر من مرة.

create table if not exists public.mk_rate(k text not null, at timestamptz not null default now());
create index if not exists mk_rate_k_at on public.mk_rate(k, at);
alter table public.mk_rate enable row level security;   -- مفيش أي صلاحية مباشرة عليه

create or replace function public.mk_throttle(p_key text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  select count(*) into n from public.mk_rate where k = p_key and at > now() - p_window;
  if n >= p_max then raise exception 'rate_limited' using hint = 'طلبات كتير ورا بعض — جرّب كمان شوية'; end if;
  insert into public.mk_rate(k) values (p_key);
  if random() < 0.02 then delete from public.mk_rate where at < now() - interval '2 days'; end if;
end $$;
revoke all on function public.mk_throttle(text, int, interval) from public, anon, authenticated;

-- أوردرات وطلبات المتجر (أي حد من غير تسجيل دخول)
create or replace function public.mk_rl_public() returns trigger
language plpgsql security definer set search_path = public as $$
declare ph text := right(regexp_replace(coalesce(to_jsonb(new)->>'phone', to_jsonb(new)->>'customer_phone', ''), '\D', '', 'g'), 10);
begin
  if coalesce(auth.role(), '') = 'authenticated' then return new; end if;
  perform public.mk_throttle(tg_table_name || ':all', 300, interval '1 hour');
  if ph <> '' then
    perform public.mk_throttle(tg_table_name || ':' || ph, 5, interval '10 minutes');
    perform public.mk_throttle(tg_table_name || ':d:' || ph, 25, interval '1 day');
  end if;
  return new;
end $$;

-- رسايل وصور الواتساب اللي الجسر بيدخلها
create or replace function public.mk_rl_wa() returns trigger
language plpgsql security definer set search_path = public as $$
declare ph text := right(regexp_replace(coalesce(to_jsonb(new)->>'phone', ''), '\D', '', 'g'), 10);
begin
  if coalesce(auth.role(), '') = 'authenticated' then return new; end if;
  perform public.mk_throttle(tg_table_name || ':all', 1500, interval '1 hour');
  if ph <> '' then perform public.mk_throttle(tg_table_name || ':' || ph, 40, interval '1 hour'); end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['web_orders', 'web_requests', 'site_requests', 'requests'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists mk_rl on public.%I', t);
      execute format('create trigger mk_rl before insert on public.%I for each row execute function public.mk_rl_public()', t);
    end if;
  end loop;
  foreach t in array array['wa_orders', 'wa_photos'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists mk_rl on public.%I', t);
      execute format('create trigger mk_rl before insert on public.%I for each row execute function public.mk_rl_wa()', t);
    end if;
  end loop;
end $$;

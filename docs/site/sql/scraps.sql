-- سوق الفضلة (site /scraps). NOT applied to the live database yet: review, then run once in the Supabase SQL editor.
-- Photos reuse the existing public bucket `customer-requests` (no new bucket / policy needed).
-- Public pages never read the table directly: only these functions. Phone numbers leave the database only through scrap_contact().

create table if not exists site_scraps (
  id         uuid primary key default gen_random_uuid(),
  secret     text not null default encode(gen_random_bytes(12), 'hex'),
  category   text not null check (category in ('sheet','solid','alu')),
  material   text not null default '',
  brand      text not null default '',
  code       text not null default '',
  color      text not null default '',
  thick      numeric,                       -- mm
  len        numeric not null,              -- cm
  wid        numeric,                       -- cm (null for aluminium lengths)
  qty        int  not null default 1,
  cond       text not null default 'new',   -- new | used | scratched
  edge       boolean not null default false,
  grain      boolean not null default false, -- true = has a grain direction, must not be rotated
  price_mode text not null default 'ask',   -- free | swap | ask | price
  price      numeric,
  area       text not null default '',
  name       text not null,
  phone      text not null,
  note       text not null default '',
  imgs       text[] not null default '{}',
  status     text not null default 'active', -- active | sold | removed | hidden
  reports    int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists site_scraps_active on site_scraps (status, expires_at desc);
alter table site_scraps enable row level security;   -- no policies: direct access is closed

create table if not exists site_scrap_log (id bigserial primary key, scrap_id uuid, kind text, at timestamptz default now());
alter table site_scrap_log enable row level security;

-- Public list (no name / phone / secret).
create or replace function scrap_list() returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
    select id, category, material, brand, code, color, thick, len, wid, qty, cond, edge, grain, price_mode, price, area, note, imgs, created_at
    from site_scraps where status = 'active' and expires_at > now() order by created_at desc limit 1500
  ) x;
$$;

create or replace function scrap_add(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_scraps; ph text := regexp_replace(coalesce(p->>'phone',''), '\D', '', 'g');
begin
  if length(ph) < 10 then raise exception 'phone'; end if;
  if length(coalesce(p->>'name','')) < 2 then raise exception 'name'; end if;
  if (select count(*) from site_scraps where phone = ph and status = 'active') >= 40 then raise exception 'too many'; end if;
  insert into site_scraps (category, material, brand, code, color, thick, len, wid, qty, cond, edge, grain, price_mode, price, area, name, phone, note, imgs)
  values (p->>'category', left(coalesce(p->>'material',''),60), left(coalesce(p->>'brand',''),60), left(coalesce(p->>'code',''),40), left(coalesce(p->>'color',''),60),
          nullif(p->>'thick','')::numeric, (p->>'len')::numeric, nullif(p->>'wid','')::numeric, greatest(1, least(999, coalesce(nullif(p->>'qty','')::int, 1))),
          coalesce(p->>'cond','new'), coalesce((p->>'edge')::boolean,false), coalesce((p->>'grain')::boolean,false),
          coalesce(p->>'price_mode','ask'), nullif(p->>'price','')::numeric, left(coalesce(p->>'area',''),80), left(p->>'name',80), ph, left(coalesce(p->>'note',''),400),
          coalesce(array(select jsonb_array_elements_text(p->'imgs') limit 4), '{}'))
  returning * into r;
  return jsonb_build_object('id', r.id, 'secret', r.secret);
end $$;

-- Reveals the owner's name / phone / area only when someone taps «اطلبها». Every reveal is logged.
create or replace function scrap_contact(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_scraps;
begin
  select * into r from site_scraps where id = p_id and status = 'active' and expires_at > now();
  if not found then raise exception 'gone'; end if;
  insert into site_scrap_log (scrap_id, kind) values (p_id, 'contact');
  return jsonb_build_object('name', r.name, 'phone', r.phone, 'area', r.area);
end $$;

create or replace function scrap_done(p_id uuid, p_secret text, p_status text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('sold','removed') then raise exception 'status'; end if;
  update site_scraps set status = p_status where id = p_id and secret = p_secret;
  return found;
end $$;

create or replace function scrap_renew(p_id uuid, p_secret text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update site_scraps set expires_at = now() + interval '30 days' where id = p_id and secret = p_secret and status = 'active';
  return found;
end $$;

-- «بلّغ»: 3 reports hide the listing until the shop reviews it.
create or replace function scrap_report(p_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into site_scrap_log (scrap_id, kind) values (p_id, 'report:' || left(coalesce(p_reason,''), 80));
  update site_scraps set reports = reports + 1, status = case when reports + 1 >= 3 then 'hidden' else status end where id = p_id;
end $$;

-- «فضلتي»: the owner's own listings, from the (id, secret) pairs kept on his phone.
create or replace function scrap_mine(p_pairs jsonb) returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
    select s.id, s.category, s.material, s.brand, s.code, s.color, s.thick, s.len, s.wid, s.qty, s.cond, s.price_mode, s.price, s.area, s.imgs, s.status, s.created_at, s.expires_at
    from site_scraps s join jsonb_to_recordset(p_pairs) as t(id uuid, secret text) on t.id = s.id and t.secret = s.secret
  ) x;
$$;

grant execute on function scrap_list(), scrap_add(jsonb), scrap_contact(uuid), scrap_done(uuid,text,text), scrap_renew(uuid,text), scrap_report(uuid,text), scrap_mine(jsonb) to anon, authenticated;

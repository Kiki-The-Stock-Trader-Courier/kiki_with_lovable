-- 지도 주변 상장사 POI (sync API가 upsert)
-- Applied via Supabase MCP / CLI — matches remote project migration name create_nearby_companies
create table if not exists public.nearby_companies (
  id bigserial primary key,
  source_place_id text not null unique,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  sector text,
  description text,
  source_station text,
  ticker text,
  stock_name text,
  map_display_name text,
  updated_at timestamptz not null default now()
);

create index if not exists nearby_companies_lat_idx on public.nearby_companies (lat);
create index if not exists nearby_companies_lng_idx on public.nearby_companies (lng);

alter table public.nearby_companies enable row level security;

drop policy if exists "nearby_companies_select_public" on public.nearby_companies;
create policy "nearby_companies_select_public"
  on public.nearby_companies
  for select
  to anon, authenticated
  using (true);

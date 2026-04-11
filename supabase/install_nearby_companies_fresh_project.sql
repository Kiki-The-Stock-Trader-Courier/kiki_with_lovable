-- =============================================================================
-- 새 Supabase 프로젝트(예: https://ofssebmhnseicwxjpvfk.supabase.co)에서 한 번 실행
-- Cursor Supabase MCP는 "한 번에 한 프로젝트"만 연결되므로, 다른 ref로 바꾼 뒤에는
-- MCP로 동일 작업을 하려면 Cursor에서 해당 프로젝트로 MCP를 다시 연결해야 합니다.
-- 이 스크립트는 대시보드 → SQL Editor에 붙여 넣어 실행하면 됩니다 (멱등).
-- =============================================================================

-- ── 테이블 + RLS (anon 읽기) ───────────────────────────────────────────────
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

-- ── 데모 시드 (KRX 티커 포함) ───────────────────────────────────────────────
insert into public.nearby_companies (source_place_id, name, lat, lng, sector, description, source_station, ticker, stock_name, map_display_name)
values
  ('seed:ss:cu1', '씨유 서울숲점', 37.5442, 127.0450, '유통', '데모 시드 · 서울숲역 인근', '서울숲역', '282330', 'BGF리테일', 'CU BGF리테일'),
  ('seed:ss:gs1', 'GS25', 37.5430, 127.0435, '유통', '데모 시드 · 서울숲역 인근', '서울숲역', '007070', 'GS리테일', 'GS25 GS리테일'),
  ('seed:ss:shinhan1', '신한은행', 37.5445, 127.0440, '금융', '데모 시드 · 서울숲역 인근', '서울숲역', '055550', '신한지주', '신한은행'),
  ('seed:yd:kb1', 'KB국민은행', 37.5225, 126.9245, '금융', '데모 시드 · 여의도역 인근', '여의도역', '105560', 'KB금융', 'KB금융'),
  ('seed:yd:lotte1', '롯데리아', 37.5210, 126.9250, '유통', '데모 시드 · 여의도역 인근', '여의도역', '023530', '롯데지주', '롯데리아 롯데'),
  ('seed:yd:paris1', '파리바게뜨', 37.5220, 126.9235, '유통', '데모 시드 · 여의도역 인근', '여의도역', '005610', 'SPC삼립', '파리바게뜨 SPC삼립'),
  ('seed:yd:naver1', '네이버', 37.5205, 126.9230, 'IT', '데모 시드 · 여의도역 인근', '여의도역', '035420', 'NAVER', 'NAVER')
on conflict (source_place_id) do update set
  name = excluded.name,
  lat = excluded.lat,
  lng = excluded.lng,
  sector = excluded.sector,
  description = excluded.description,
  source_station = excluded.source_station,
  ticker = excluded.ticker,
  stock_name = excluded.stock_name,
  map_display_name = excluded.map_display_name,
  updated_at = now();

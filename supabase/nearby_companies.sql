-- 서울숲역/여의도역 반경 1km 크롤링 데이터를 저장하는 테이블
create table if not exists public.nearby_companies (
  id bigserial primary key,
  source_place_id text not null unique,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  sector text,
  description text,
  source_station text,
  -- KRX 6자리 (상장 종목으로 매칭된 경우만 sync 시 채움)
  ticker text,
  -- 상장 법인 정식명 (예: BGF리테일) — 시트·시세 표시용
  stock_name text,
  -- 지도 마커 표시명 (예: CU BGF리테일)
  map_display_name text,
  updated_at timestamptz not null default now()
);

create index if not exists nearby_companies_lat_idx on public.nearby_companies (lat);
create index if not exists nearby_companies_lng_idx on public.nearby_companies (lng);

-- 지도 API(anon) 읽기 — RLS 켠 뒤 정책 없으면 행이 0건으로 보일 수 있음
alter table public.nearby_companies enable row level security;

drop policy if exists "nearby_companies_select_public" on public.nearby_companies;
create policy "nearby_companies_select_public"
  on public.nearby_companies
  for select
  to anon, authenticated
  using (true);

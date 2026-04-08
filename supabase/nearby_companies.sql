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
  updated_at timestamptz not null default now()
);

create index if not exists nearby_companies_lat_idx on public.nearby_companies (lat);
create index if not exists nearby_companies_lng_idx on public.nearby_companies (lng);

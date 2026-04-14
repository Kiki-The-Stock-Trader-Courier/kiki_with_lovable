-- 키움증권(039490) — 여의도 본사 인근 마커 보강 (seed 미적용 프로젝트용)
-- 좌표: 서울 영등포구 국제금융로2길 키움증권빌딩 일대(대표 지도 표시용)
insert into public.nearby_companies (
  source_place_id,
  name,
  lat,
  lng,
  sector,
  description,
  source_station,
  ticker,
  stock_name,
  map_display_name
)
values (
  'seed:yd:m005',
  '키움증권',
  37.52632,
  126.92088,
  '금융',
  '키움증권 본사(여의도)·DB 마이그레이션 시드',
  '여의도역',
  '039490',
  '키움증권',
  '키움증권'
)
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

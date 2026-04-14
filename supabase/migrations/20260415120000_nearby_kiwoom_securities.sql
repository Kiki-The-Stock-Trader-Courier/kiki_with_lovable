-- 키움증권(039490) — 본사: 서울 영등포구 의사당대로 96 TP타워(2024년경 구 키움증권빌딩·국제금융로2길에서 이전)
-- 지도 대표 좌표: TP타워 건물 중심 부근(WGS84)
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
  37.52155,
  126.92294,
  '금융',
  '키움증권 본사 TP타워(여의도 의사당대로 96)·DB 마이그레이션 시드',
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

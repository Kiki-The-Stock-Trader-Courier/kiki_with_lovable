-- 선택: 테이블 생성 후 지도·티커 동작 확인용 데모 행 (이미 MCP로 원격에 반영됨)
-- 여의도역 반경 1km 상장사 대량 보강은 seed_yeouido_listed_1km.sql 참고
-- Supabase SQL Editor에서 필요 시 재실행 가능 (on conflict 로 덮어씀)
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

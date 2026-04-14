-- 지도 POI 시드 seed:yd:m027(쿠팡) 제거
delete from public.nearby_companies
where source_place_id = 'seed:yd:m027';

-- 기존 DB에 이미 nearby_companies가 있을 때 한 번 실행
alter table public.nearby_companies
  add column if not exists ticker text;

alter table public.nearby_companies
  add column if not exists map_display_name text;

-- 기존 DB에 이미 nearby_companies가 있을 때 한 번 실행
alter table public.nearby_companies
  add column if not exists ticker text;

alter table public.nearby_companies
  add column if not exists stock_name text;

alter table public.nearby_companies
  add column if not exists map_display_name text;

-- anon 키로 지도에서 읽을 수 있도록 (RLS만 있고 정책 없으면 0건)
alter table public.nearby_companies enable row level security;

drop policy if exists "nearby_companies_select_public" on public.nearby_companies;
create policy "nearby_companies_select_public"
  on public.nearby_companies
  for select
  to anon, authenticated
  using (true);

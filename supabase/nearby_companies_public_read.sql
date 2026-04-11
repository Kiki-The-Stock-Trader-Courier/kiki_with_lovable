-- nearby_companies 는 지도에서 anon 키로 읽습니다.
-- Supabase에서 RLS만 켜져 있고 정책이 없으면 SELECT 결과가 항상 0건입니다.
-- 이 스크립트는 읽기 전용 공개 조회를 허용합니다. (sync는 service role로 RLS 우회)

alter table public.nearby_companies enable row level security;

drop policy if exists "nearby_companies_select_public" on public.nearby_companies;
create policy "nearby_companies_select_public"
  on public.nearby_companies
  for select
  to anon, authenticated
  using (true);

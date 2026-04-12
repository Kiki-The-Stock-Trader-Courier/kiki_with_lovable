-- 오늘 걸음 중 이미 포인트로 전환한 걸음 수 (100걸음 단위 적립, 수령 시 증가)
alter table public.user_walk_daily
  add column if not exists steps_claimed_for_cash integer not null default 0;

comment on column public.user_walk_daily.steps_claimed_for_cash is
  '오늘 걸음 중 캐시(포인트)로 전환에 사용된 걸음 수 — 100걸음당 1포인트 수령 시 누적';

-- 전 사용자 100걸음 = 1포인트 규칙에 맞게 표시용 비율 정렬 (1보당 0.01포인트)
alter table public.user_profiles
  alter column cash_per_step set default 0.01;

update public.user_profiles
set cash_per_step = 0.01
where cash_per_step is distinct from 0.01;

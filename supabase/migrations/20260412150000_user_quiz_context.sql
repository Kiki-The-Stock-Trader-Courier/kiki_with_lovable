-- 퀴즈 출제용: 검색 병합 의도(company_profile, news_issue, deep_analysis) 대화만 사용자별 저장
create table if not exists public.user_quiz_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  intent text not null
    check (intent in ('company_profile', 'news_issue', 'deep_analysis')),
  question text not null,
  answer text not null,
  stock_name text,
  stock_ticker text,
  created_at timestamptz not null default now()
);

create index if not exists user_quiz_context_user_created_idx
  on public.user_quiz_context (user_id, created_at desc);

alter table public.user_quiz_context enable row level security;

drop policy if exists "user_quiz_context_select_own" on public.user_quiz_context;
create policy "user_quiz_context_select_own"
  on public.user_quiz_context
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_quiz_context_insert_own" on public.user_quiz_context;
create policy "user_quiz_context_insert_own"
  on public.user_quiz_context
  for insert
  to authenticated
  with check (auth.uid() = user_id);

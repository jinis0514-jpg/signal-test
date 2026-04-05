--------------------------------------------------
-- extensions
create extension if not exists pgcrypto;

--------------------------------------------------
-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'guest',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

--------------------------------------------------
-- strategies
create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  -- "signal": 실행 전략(기존) / "method": PDF 기반 매매법(연결 전략을 통해 실행/검증)
  type text not null default 'signal' check (type in ('signal', 'method')),
  -- 전략 버전 (수정 시 증가, version별 결과/스냅샷 조회)
  version_no integer not null default 1,
  name text not null,
  description text default '',
  -- 구조화 설명(전략 이해/검수용) — signal 제출 시 필수
  strategy_summary text default '',
  entry_logic text default '',
  exit_logic text default '',
  market_condition text default '',
  risk_description text default '',
  asset text not null default 'BTC',
  timeframe text not null default '1h',
  mode text not null default 'nocode' check (mode in ('nocode', 'code')),
  strategy_type text default 'trend',
  risk_level text default 'mid' check (risk_level in ('low', 'mid', 'high')),
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'published', 'paused', 'archived')
  ),
  -- 마켓 노출: 검수 승인 시 true (anon 조회는 approved|published + is_public)
  is_public boolean not null default false,
  tags text[] not null default '{}',
  code text default '',
  conditions jsonb not null default '[]'::jsonb,
  risk_config jsonb not null default '{}'::jsonb,
  -- 실행/검증 기준 고정 (재현성)
  backtest_meta jsonb not null default '{}'::jsonb,
  -- 성과 스냅샷 (마켓/상세 표시용, 제출 시 저장 권장)
  performance jsonb not null default '{}'::jsonb,
  -- 엔진 기반 전체 거래 기록(검증 데이터) — 제출 시 저장 권장
  engine_trades jsonb not null default '[]'::jsonb,
  -- 실매매/외부 성과 등 "참고" 데이터(검증 기준 아님). 포함 시 고정 문구를 본문에 포함해야 합니다.
  live_trading_text text default '',
  -- signal 선택 PDF (프리미엄 부가가치)
  strategy_pdf_path text,
  strategy_pdf_preview_path text,
  strategy_pdf_url text,
  strategy_preview_mode text not null default 'none' check (strategy_preview_mode in ('none', 'file')),
  -- method 전용 필드
  method_pdf_path text,
  method_pdf_preview_path text,
  method_preview_mode text not null default 'none' check (method_preview_mode in ('none', 'file')),
  linked_signal_strategy_id uuid references public.strategies(id) on delete set null,
  review_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 제출(draft 제외) 시 method 필수 요건(설명/PDF/연결) 보장
alter table public.strategies
  drop constraint if exists strategies_method_requirements_on_submit;
alter table public.strategies
  add constraint strategies_method_requirements_on_submit
  check (
    type <> 'method'
    or status = 'draft'
    or (
      length(trim(coalesce(description, ''))) >= 40
      and method_pdf_path is not null
      and linked_signal_strategy_id is not null
    )
  );

-- 제출(draft 제외) 시 signal 필수 요건(구조화 설명 + 검증 기반) 보장
alter table public.strategies
  drop constraint if exists strategies_signal_requirements_on_submit;
alter table public.strategies
  add constraint strategies_signal_requirements_on_submit
  check (
    type <> 'signal'
    or status = 'draft'
    or (
      -- PDF가 있으면 최소 요약/리스크만 텍스트로 남김, PDF가 없으면 5종 구조화 설명 필수
      (
        (strategy_pdf_path is not null or strategy_pdf_preview_path is not null)
        and length(trim(coalesce(strategy_summary, ''))) >= 40
        and length(trim(coalesce(risk_description, ''))) >= 30
      )
      or (
        (strategy_pdf_path is null and strategy_pdf_preview_path is null)
        and length(trim(coalesce(strategy_summary, ''))) >= 40
        and length(trim(coalesce(entry_logic, ''))) >= 40
        and length(trim(coalesce(exit_logic, ''))) >= 40
        and length(trim(coalesce(market_condition, ''))) >= 30
        and length(trim(coalesce(risk_description, ''))) >= 30
      )
    )
  );

--------------------------------------------------
-- strategy_versions
create table if not exists public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  version_no integer not null,
  code text default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (strategy_id, version_no)
);

--------------------------------------------------
-- strategy_reviews
create table if not exists public.strategy_reviews (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('submitted', 'under_review', 'approved', 'rejected')),
  note text default '',
  created_at timestamptz not null default now()
);

--------------------------------------------------
-- subscriptions (클라이언트 단일 소스: user_id당 1행, 앱은 mergeSubscriptionIntoUser로 권한 확정)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'trial', 'subscribed')),
  status text not null default 'active' check (status in ('active', 'expired', 'canceled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

--------------------------------------------------
-- user_trials
create table if not exists public.user_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  unique (user_id, strategy_id)
);

--------------------------------------------------
-- notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('entry', 'exit', 'strategy_update', 'review_result', 'system')),
  title text not null,
  message text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

--------------------------------------------------
-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_strategies_updated_at on public.strategies;
create trigger trg_strategies_updated_at
before update on public.strategies
for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

--------------------------------------------------
-- RLS
alter table public.profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.strategy_versions enable row level security;
alter table public.strategy_reviews enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_trials enable row level security;
alter table public.notifications enable row level security;

--------------------------------------------------
-- profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id);

--------------------------------------------------
-- strategies policies
drop policy if exists "strategies_select_published_or_own" on public.strategies;
create policy "strategies_select_published_or_own"
on public.strategies
for select
to authenticated
using (
  status in ('approved', 'published')
  or creator_id = auth.uid()
);

drop policy if exists "strategies_insert_own" on public.strategies;
create policy "strategies_insert_own"
on public.strategies
for insert
to authenticated
with check (creator_id = auth.uid());

drop policy if exists "strategies_update_own" on public.strategies;
create policy "strategies_update_own"
on public.strategies
for update
to authenticated
using (creator_id = auth.uid());

drop policy if exists "strategies_delete_own" on public.strategies;
create policy "strategies_delete_own"
on public.strategies
for delete
to authenticated
using (creator_id = auth.uid());

--------------------------------------------------
-- subscriptions policies
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own"
on public.subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
on public.subscriptions
for update
to authenticated
using (user_id = auth.uid());

--------------------------------------------------
-- user_trials policies
drop policy if exists "user_trials_select_own" on public.user_trials;
create policy "user_trials_select_own"
on public.user_trials
for select
to authenticated
using (user_id = auth.uid());

--------------------------------------------------
-- notifications policies
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
on public.notifications
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "notifications_insert_admin" on public.notifications;
create policy "notifications_insert_admin"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

--------------------------------------------------

--------------------------------------------------
-- storage: strategy-pdfs 버킷 생성 + 정책
--------------------------------------------------

-- 버킷 생성 (public = true → getPublicUrl로 서명 없이 접근 가능)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'strategy-pdfs',
  'strategy-pdfs',
  true,
  26214400,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 로그인 사용자는 자신의 폴더({userId}/...)에만 업로드 가능
drop policy if exists "strategy_pdfs_insert_own" on storage.objects;
create policy "strategy_pdfs_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'strategy-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 로그인 사용자는 자신의 파일 삭제 가능
drop policy if exists "strategy_pdfs_delete_own" on storage.objects;
create policy "strategy_pdfs_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'strategy-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 누구나 공개 파일 읽기 가능
drop policy if exists "strategy_pdfs_select_public" on storage.objects;
create policy "strategy_pdfs_select_public"
on storage.objects for select
using (bucket_id = 'strategy-pdfs');

--------------------------------------------------

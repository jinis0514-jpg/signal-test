-- =========================================================
-- 실거래 인증 1차 기반 테이블
-- 목적:
-- 1) 판매자 거래소 API 연결 정보 저장
-- 2) 실제 체결 로그 저장
-- 3) 시그널 vs 실거래 매칭 결과 저장
-- 4) 전략 단위 인증 요약 저장
-- =========================================================

-- pgcrypto 필요할 수 있음
create extension if not exists pgcrypto;

-- =========================================================
-- 1. seller_exchange_connections
-- 판매자의 거래소 API 연결 정보
-- 주의:
-- - 지금은 encrypted_api_key / encrypted_secret 칼럼만 만들고
-- - 실제 암호화/복호화 로직은 서버에서 처리
-- =========================================================
create table if not exists public.seller_exchange_connections (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  exchange_name text not null check (exchange_name in ('binance')),
  encrypted_api_key text not null,
  encrypted_secret text not null,
  is_active boolean not null default true,
  permission_scope text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seller_exchange_connections_seller_id
  on public.seller_exchange_connections (seller_id);

create index if not exists idx_seller_exchange_connections_exchange_name
  on public.seller_exchange_connections (exchange_name);

-- =========================================================
-- 2. seller_trade_logs
-- 거래소에서 읽어온 실제 체결 로그
-- =========================================================
create table if not exists public.seller_trade_logs (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  exchange_connection_id uuid references public.seller_exchange_connections(id) on delete set null,
  exchange_name text not null check (exchange_name in ('binance')),
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL', 'LONG', 'SHORT')),
  executed_at timestamptz not null,
  executed_price numeric not null,
  qty numeric,
  order_id text,
  trade_id text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_seller_trade_logs_seller_id
  on public.seller_trade_logs (seller_id);

create index if not exists idx_seller_trade_logs_symbol
  on public.seller_trade_logs (symbol);

create index if not exists idx_seller_trade_logs_executed_at
  on public.seller_trade_logs (executed_at desc);

-- 중복 수집 방지용 (거래소별 trade_id가 있다면 강하게 활용)
create unique index if not exists uq_seller_trade_logs_exchange_trade
  on public.seller_trade_logs (seller_id, exchange_name, symbol, trade_id)
  where trade_id is not null;

-- =========================================================
-- 3. trade_verification_matches
-- 전략 시그널과 실제 체결 비교 결과
-- signal_id는 live_signals 테이블 구조에 맞춰 나중에 FK 추가 가능
-- =========================================================
create table if not exists public.trade_verification_matches (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  signal_id uuid,
  trade_log_id uuid not null references public.seller_trade_logs(id) on delete cascade,
  time_diff_sec integer,
  price_diff_pct numeric,
  side_matched boolean not null default false,
  is_verified_match boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_verification_matches_strategy_id
  on public.trade_verification_matches (strategy_id);

create index if not exists idx_trade_verification_matches_trade_log_id
  on public.trade_verification_matches (trade_log_id);

create index if not exists idx_trade_verification_matches_signal_id
  on public.trade_verification_matches (signal_id);

-- signal_id가 null이 아닐 때 중복 매칭 방지
create unique index if not exists uq_trade_verification_matches_signal_trade
  on public.trade_verification_matches (signal_id, trade_log_id)
  where signal_id is not null;

-- =========================================================
-- 4. strategy_verification_summary
-- 전략 단위 실거래 인증 요약
-- =========================================================
create table if not exists public.strategy_verification_summary (
  strategy_id uuid primary key references public.strategies(id) on delete cascade,
  last_30_signal_count integer not null default 0,
  matched_signal_count integer not null default 0,
  match_rate numeric not null default 0,
  avg_price_diff_pct numeric not null default 0,
  avg_time_diff_sec numeric not null default 0,
  verified_return_pct numeric not null default 0,
  verified_badge_level text,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 5. strategies 확장 컬럼
-- 실거래 인증 / 라이브 추적 상태를 전략에 바로 붙임
-- =========================================================
alter table public.strategies
  add column if not exists is_live_tracked boolean not null default false;

alter table public.strategies
  add column if not exists is_trade_verified boolean not null default false;

alter table public.strategies
  add column if not exists verified_badge_level text;

alter table public.strategies
  add column if not exists exchange_name text;

-- =========================================================
-- 6. updated_at 자동 갱신 트리거 함수
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_seller_exchange_connections_updated_at
  on public.seller_exchange_connections;

create trigger trg_seller_exchange_connections_updated_at
before update on public.seller_exchange_connections
for each row
execute function public.set_updated_at();

-- strategy_verification_summary도 updated_at 갱신
drop trigger if exists trg_strategy_verification_summary_updated_at
  on public.strategy_verification_summary;

create trigger trg_strategy_verification_summary_updated_at
before update on public.strategy_verification_summary
for each row
execute function public.set_updated_at();

-- =========================================================
-- 7. RLS 활성화
-- =========================================================
alter table public.seller_exchange_connections enable row level security;
alter table public.seller_trade_logs enable row level security;
alter table public.trade_verification_matches enable row level security;
alter table public.strategy_verification_summary enable row level security;

-- =========================================================
-- 8. RLS 정책
-- 원칙:
-- - 판매자는 자기 연결 정보/거래 로그만 접근
-- - verification summary는 공개 전략이면 조회 가능
-- - trade_verification_matches는 우선 작성자만 조회 가능하게 시작
-- =========================================================

-- seller_exchange_connections
drop policy if exists "seller_exchange_connections_select_own" on public.seller_exchange_connections;
create policy "seller_exchange_connections_select_own"
on public.seller_exchange_connections
for select
to authenticated
using (seller_id = auth.uid());

drop policy if exists "seller_exchange_connections_insert_own" on public.seller_exchange_connections;
create policy "seller_exchange_connections_insert_own"
on public.seller_exchange_connections
for insert
to authenticated
with check (seller_id = auth.uid());

drop policy if exists "seller_exchange_connections_update_own" on public.seller_exchange_connections;
create policy "seller_exchange_connections_update_own"
on public.seller_exchange_connections
for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists "seller_exchange_connections_delete_own" on public.seller_exchange_connections;
create policy "seller_exchange_connections_delete_own"
on public.seller_exchange_connections
for delete
to authenticated
using (seller_id = auth.uid());

-- seller_trade_logs
drop policy if exists "seller_trade_logs_select_own" on public.seller_trade_logs;
create policy "seller_trade_logs_select_own"
on public.seller_trade_logs
for select
to authenticated
using (seller_id = auth.uid());

drop policy if exists "seller_trade_logs_insert_own" on public.seller_trade_logs;
create policy "seller_trade_logs_insert_own"
on public.seller_trade_logs
for insert
to authenticated
with check (seller_id = auth.uid());

drop policy if exists "seller_trade_logs_update_own" on public.seller_trade_logs;
create policy "seller_trade_logs_update_own"
on public.seller_trade_logs
for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

-- trade_verification_matches
drop policy if exists "trade_verification_matches_select_owner" on public.trade_verification_matches;
create policy "trade_verification_matches_select_owner"
on public.trade_verification_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.strategies s
    where s.id = trade_verification_matches.strategy_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "trade_verification_matches_insert_owner" on public.trade_verification_matches;
create policy "trade_verification_matches_insert_owner"
on public.trade_verification_matches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.strategies s
    where s.id = trade_verification_matches.strategy_id
      and s.user_id = auth.uid()
  )
);

-- strategy_verification_summary
drop policy if exists "strategy_verification_summary_select_public_or_owner" on public.strategy_verification_summary;
create policy "strategy_verification_summary_select_public_or_owner"
on public.strategy_verification_summary
for select
to authenticated
using (
  exists (
    select 1
    from public.strategies s
    where s.id = strategy_verification_summary.strategy_id
      and (
        s.user_id = auth.uid()
        or (coalesce(s.is_public, false) = true)
      )
  )
);

drop policy if exists "strategy_verification_summary_insert_owner" on public.strategy_verification_summary;
create policy "strategy_verification_summary_insert_owner"
on public.strategy_verification_summary
for insert
to authenticated
with check (
  exists (
    select 1
    from public.strategies s
    where s.id = strategy_verification_summary.strategy_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "strategy_verification_summary_update_owner" on public.strategy_verification_summary;
create policy "strategy_verification_summary_update_owner"
on public.strategy_verification_summary
for update
to authenticated
using (
  exists (
    select 1
    from public.strategies s
    where s.id = strategy_verification_summary.strategy_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.strategies s
    where s.id = strategy_verification_summary.strategy_id
      and s.user_id = auth.uid()
  )
);

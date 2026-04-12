-- ============================================================
-- 거래소 API 연동 1차 설계 (Phase 1)
-- 목표: 자동매매가 아닌 "실거래 인증 + 클릭 실행 보조"
--
-- 물리 테이블: public.seller_exchange_connections (기존)
--   설계서·문서에서 부르는 exchange_connections 는 동일 엔티티를 가리킴.
--   민감정보(encrypted_secret 등)는 클라이언트 SELECT 금지 — Edge·서비스 롤만.
--
-- 원칙:
-- - API Secret 평문 DB 저장 금지 (Edge에서 암호화 후 저장)
-- - UI: api_key_masked 만 표시, secret 재노출 없음
-- - connection_id / execution_request 는 본인 소유만 (RLS)
-- - 관리자 RLS로도 secret 컬럼 조회 불가 — 조회 정책에 encrypted_* 미포함
--
-- 주문: prepare → submit 분리는 execution_requests 로 모델링 (2차 구현)
-- 상태: pending / submitted / unknown / partial_fill / filled / canceled / failed
-- 타임아웃 시 unknown 유지 후 폴링·재조회 (failed 로 단정 금지)
-- ============================================================

create extension if not exists pgcrypto;

-- ── 1) 기존 연결 테이블 확장: 마스킹·권한 플래그·테스트 시각 ─────────
alter table public.seller_exchange_connections
  add column if not exists api_key_masked text;

alter table public.seller_exchange_connections
  add column if not exists permission_read boolean;

alter table public.seller_exchange_connections
  add column if not exists permission_trade boolean;

alter table public.seller_exchange_connections
  add column if not exists permission_withdraw boolean;

alter table public.seller_exchange_connections
  add column if not exists last_connection_test_at timestamptz;

alter table public.seller_exchange_connections
  add column if not exists connection_test_ok boolean;

comment on column public.seller_exchange_connections.api_key_masked is 'UI 표시용 마스킹된 키 (예: abcd****wxyz). 평문 아님.';
comment on column public.seller_exchange_connections.permission_read is '마지막 연결 테스트 시점 기준 조회 가능 여부(계정 API 성공 시 true 권장)';
comment on column public.seller_exchange_connections.permission_trade is 'Binance account canTrade 등';
comment on column public.seller_exchange_connections.permission_withdraw is 'Binance account canWithdraw 등 — true 시 UI 강한 경고';

-- ── 2) exchange_connection_audit_logs ───────────────────────────────
create table if not exists public.exchange_connection_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid references public.seller_exchange_connections(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_exchange_conn_audit_user
  on public.exchange_connection_audit_logs (user_id, created_at desc);

create index if not exists idx_exchange_conn_audit_connection
  on public.exchange_connection_audit_logs (connection_id, created_at desc);

comment on table public.exchange_connection_audit_logs is '연결/검증/해제 등 감사 로그. secret·평문 키 저장 금지.';

-- ── 3) execution_requests (prepare → submit, 자동 반복 없음) ─────────
create table if not exists public.execution_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid not null references public.seller_exchange_connections(id) on delete cascade,
  status text not null default 'pending'
    check (status in (
      'pending',
      'submitted',
      'unknown',
      'partial_fill',
      'filled',
      'canceled',
      'failed'
    )),
  prepared_payload jsonb,
  external_order_id text,
  last_poll_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists idx_execution_requests_user
  on public.execution_requests (user_id, created_at desc);

create index if not exists idx_execution_requests_status
  on public.execution_requests (status, updated_at desc);

comment on table public.execution_requests is '주문 prepare/submit 단위. 자동 스케줄 주문 없음.';
comment on column public.execution_requests.status is '타임아웃 시 failed 단정 대신 unknown 후 재조회';

-- ── 4) trade_execution_events (상태 이벤트·거래소 응답 스냅샷) ───────
create table if not exists public.trade_execution_events (
  id uuid primary key default gen_random_uuid(),
  execution_request_id uuid not null references public.execution_requests(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_exec_events_req
  on public.trade_execution_events (execution_request_id, created_at desc);

-- ── 5) verified_trade_matches (시그널·실체결 매칭) ───────────────────
--    기존 trade_verification_matches 와 목적 유사; 1차 설계 명칭 반영.
create table if not exists public.verified_trade_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  signal_id uuid,
  seller_trade_log_id uuid references public.seller_trade_logs(id) on delete set null,
  side_matched boolean not null default false,
  is_verified_match boolean not null default false,
  time_diff_sec integer,
  price_diff_pct numeric,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_verified_trade_matches_strategy
  on public.verified_trade_matches (strategy_id);

create index if not exists idx_verified_trade_matches_trade_log
  on public.verified_trade_matches (seller_trade_log_id);

-- ── 6) 트리거: execution_requests.updated_at ────────────────────────
drop trigger if exists trg_execution_requests_updated_at on public.execution_requests;
create trigger trg_execution_requests_updated_at
before update on public.execution_requests
for each row
execute function public.set_updated_at();

-- ── 7) 설계서 명칭 뷰: exchange_connections (민감 컬럼 제외) ───────────
--    클라이언트는 이 뷰 또는 폴리시로 제한된 컬럼만 조회.
drop view if exists public.exchange_connections;
create view public.exchange_connections
with (security_invoker = true) as
select
  c.id,
  c.seller_id as user_id,
  c.exchange_name,
  c.api_key_masked,
  c.permission_read,
  c.permission_trade,
  c.permission_withdraw,
  c.is_active,
  c.permission_scope,
  c.last_sync_at,
  c.last_error,
  c.last_connection_test_at,
  c.connection_test_ok,
  c.created_at,
  c.updated_at
from public.seller_exchange_connections c;

comment on view public.exchange_connections is 'seller_exchange_connections 의 비밀 제외 뷰. user_id = seller_id.';

-- ── 8) RLS ───────────────────────────────────────────────────────────
alter table public.exchange_connection_audit_logs enable row level security;
alter table public.execution_requests enable row level security;
alter table public.trade_execution_events enable row level security;
alter table public.verified_trade_matches enable row level security;

-- audit logs: 본인만
drop policy if exists "exchange_conn_audit_select_own" on public.exchange_connection_audit_logs;
create policy "exchange_conn_audit_select_own"
on public.exchange_connection_audit_logs
for select to authenticated
using (user_id = auth.uid());

-- 감사 로그 insert: Edge(서비스 롤)만 — 클라이언트 직접 insert 불가

-- execution_requests: 조회·갱신은 본인만, insert 는 Edge(서비스 롤) 전용
drop policy if exists "execution_requests_select_own" on public.execution_requests;
create policy "execution_requests_select_own"
on public.execution_requests
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "execution_requests_insert_own" on public.execution_requests;
drop policy if exists "execution_requests_update_own" on public.execution_requests;
create policy "execution_requests_update_own"
on public.execution_requests
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- trade_execution_events: 조회만 본인 요청에 한함; insert 는 서비스 롤
drop policy if exists "trade_exec_events_select_own" on public.trade_execution_events;
create policy "trade_exec_events_select_own"
on public.trade_execution_events
for select to authenticated
using (
  exists (
    select 1 from public.execution_requests er
    where er.id = trade_execution_events.execution_request_id
      and er.user_id = auth.uid()
  )
);

drop policy if exists "trade_exec_events_insert_own" on public.trade_execution_events;

-- verified_trade_matches: 전략 소유자
drop policy if exists "verified_trade_matches_select_owner" on public.verified_trade_matches;
create policy "verified_trade_matches_select_owner"
on public.verified_trade_matches
for select to authenticated
using (
  exists (
    select 1 from public.strategies s
    where s.id = verified_trade_matches.strategy_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "verified_trade_matches_insert_owner" on public.verified_trade_matches;
create policy "verified_trade_matches_insert_owner"
on public.verified_trade_matches
for insert to authenticated
with check (
  exists (
    select 1 from public.strategies s
    where s.id = verified_trade_matches.strategy_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "verified_trade_matches_update_owner" on public.verified_trade_matches;
create policy "verified_trade_matches_update_owner"
on public.verified_trade_matches
for update to authenticated
using (
  exists (
    select 1 from public.strategies s
    where s.id = verified_trade_matches.strategy_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.strategies s
    where s.id = verified_trade_matches.strategy_id
      and s.user_id = auth.uid()
  )
);

-- 뷰 exchange_connections: 기존 seller_exchange_connections RLS 상속
grant select on public.exchange_connections to authenticated;

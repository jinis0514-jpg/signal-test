-- =========================================================
-- SaaS v2 Foundation (Server/DB centric authorization)
-- =========================================================
-- 목적:
-- 1) 결제/플랜 상태를 프론트 state가 아닌 DB 기준으로 단일화
-- 2) RLS로 사용자 데이터 접근을 원천 차단
-- 3) 향후 웹훅/서버 연동이 쉬운 구조로 확장
--
-- 주의:
-- - 기존 subscriptions(레거시 결제 상태)와 충돌을 피하기 위해
--   전략 구독 테이블은 strategy_subscriptions 로 분리합니다.
-- - 본 스크립트 적용 후 결제/플랜 변경은 서버(웹훅/백엔드) 경로만 허용됩니다.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 0) 공통 updated_at 함수
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 1) user_plans: 단일 진실원(SSOT) 플랜 상태
-- ---------------------------------------------------------
create table if not exists public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('free', 'standard', 'pro', 'premium')),
  status text not null default 'active' check (status in ('active', 'trialing', 'canceled', 'expired')),
  started_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  source text not null default 'system' check (source in ('system', 'webhook', 'admin', 'migration')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_user_plans_updated_at on public.user_plans;
create trigger trg_user_plans_updated_at
before update on public.user_plans
for each row execute function public.set_updated_at();

create index if not exists idx_user_plans_plan_status on public.user_plans (plan, status);

-- ---------------------------------------------------------
-- 2) payments: 결제 원장
-- ---------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('standard', 'pro', 'premium')),
  provider text not null check (provider in ('stripe', 'toss', 'kakaopay', 'mock')),
  provider_payment_id text not null,
  provider_checkout_id text,
  amount_krw integer not null check (amount_krw >= 0),
  currency text not null default 'KRW',
  status text not null check (status in ('pending', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded')),
  paid_at timestamptz,
  refunded_at timestamptz,
  failure_code text,
  failure_message text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create index if not exists idx_payments_user_created on public.payments (user_id, created_at desc);
create index if not exists idx_payments_status_created on public.payments (status, created_at desc);

-- ---------------------------------------------------------
-- 3) strategy_subscriptions: 사용자 전략 구독
-- ---------------------------------------------------------
create table if not exists public.strategy_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'canceled')),
  source text not null default 'user' check (source in ('user', 'system', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, strategy_id)
);

drop trigger if exists trg_strategy_subscriptions_updated_at on public.strategy_subscriptions;
create trigger trg_strategy_subscriptions_updated_at
before update on public.strategy_subscriptions
for each row execute function public.set_updated_at();

create index if not exists idx_strategy_subscriptions_user_status
  on public.strategy_subscriptions (user_id, status, created_at desc);

-- ---------------------------------------------------------
-- 4) strategy_performance / strategy_trades: 저장은 요약/로그 중심
-- ---------------------------------------------------------
create table if not exists public.strategy_performance (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  as_of timestamptz not null default now(),
  period text not null default 'all' check (period in ('7d', '30d', '90d', 'all')),
  roi numeric(10, 4),
  mdd numeric(10, 4),
  win_rate numeric(10, 4),
  trade_count integer,
  sharpe numeric(10, 4),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_strategy_performance_strategy_asof
  on public.strategy_performance (strategy_id, as_of desc);
create index if not exists idx_strategy_performance_owner_asof
  on public.strategy_performance (owner_id, as_of desc);

create table if not exists public.strategy_trades (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  trade_uid text not null,
  entry_time timestamptz,
  exit_time timestamptz,
  side text check (side in ('LONG', 'SHORT')),
  pnl_pct numeric(10, 4),
  hold_minutes integer,
  entry_reason text,
  exit_reason text,
  confidence integer check (confidence between 0 and 100),
  regime text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (strategy_id, trade_uid)
);

create index if not exists idx_strategy_trades_strategy_exit
  on public.strategy_trades (strategy_id, exit_time desc);
create index if not exists idx_strategy_trades_owner_exit
  on public.strategy_trades (owner_id, exit_time desc);

-- ---------------------------------------------------------
-- 5) feedback / support_tickets
-- ---------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('feature', 'ux', 'other')),
  title text not null,
  content text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_feedback_updated_at on public.feedback;
create trigger trg_feedback_updated_at
before update on public.feedback
for each row execute function public.set_updated_at();

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('billing', 'account', 'bug', 'strategy', 'other')),
  title text not null,
  content text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

create index if not exists idx_feedback_user_created on public.feedback (user_id, created_at desc);
create index if not exists idx_support_tickets_user_created on public.support_tickets (user_id, created_at desc);

-- ---------------------------------------------------------
-- 6) 플랜 정책 함수 (서버/DB 공통 참조)
-- ---------------------------------------------------------
create or replace function public.get_effective_plan(p_user_id uuid)
returns text
language sql
stable
as $$
  select coalesce((
    select up.plan
    from public.user_plans up
    where up.user_id = p_user_id
      and up.status in ('active', 'trialing')
      and (up.current_period_end is null or up.current_period_end > now())
    limit 1
  ), 'free');
$$;

create or replace function public.get_registration_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case
    when p_plan = 'premium' then 10
    when p_plan = 'pro' then 5
    when p_plan = 'standard' then 0
    else 0
  end;
$$;

create or replace function public.get_subscription_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case
    when p_plan = 'premium' then 2147483647
    when p_plan = 'pro' then 2147483647
    when p_plan = 'standard' then 2
    else 0
  end;
$$;

-- 전략 등록 제한 (DB 하드 가드)
create or replace function public.enforce_strategy_registration_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  v_plan := public.get_effective_plan(new.creator_id);
  v_limit := public.get_registration_limit(v_plan);
  select count(*) into v_count
  from public.strategies s
  where s.creator_id = new.creator_id;

  if v_count >= v_limit then
    raise exception 'strategy registration limit exceeded: %/%', v_count, v_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_strategy_registration_limit on public.strategies;
create trigger trg_enforce_strategy_registration_limit
before insert on public.strategies
for each row execute function public.enforce_strategy_registration_limit();

-- 전략 구독 제한 (DB 하드 가드)
create or replace function public.enforce_strategy_subscription_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  v_plan := public.get_effective_plan(new.user_id);
  v_limit := public.get_subscription_limit(v_plan);
  select count(*) into v_count
  from public.strategy_subscriptions ss
  where ss.user_id = new.user_id
    and ss.status = 'active';

  if v_count >= v_limit then
    raise exception 'strategy subscription limit exceeded: %/%', v_count, v_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_strategy_subscription_limit on public.strategy_subscriptions;
create trigger trg_enforce_strategy_subscription_limit
before insert on public.strategy_subscriptions
for each row execute function public.enforce_strategy_subscription_limit();

-- ---------------------------------------------------------
-- 7) RLS 활성화
-- ---------------------------------------------------------
alter table public.user_plans enable row level security;
alter table public.payments enable row level security;
alter table public.strategy_subscriptions enable row level security;
alter table public.strategy_performance enable row level security;
alter table public.strategy_trades enable row level security;
alter table public.feedback enable row level security;
alter table public.support_tickets enable row level security;

-- user_plans: 본인 읽기만 허용 (쓰기 금지: 서버/웹훅 전용)
drop policy if exists "user_plans_select_own" on public.user_plans;
create policy "user_plans_select_own"
on public.user_plans
for select
to authenticated
using (user_id = auth.uid());

-- payments: 본인 결제내역 읽기만 허용
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
on public.payments
for select
to authenticated
using (user_id = auth.uid());

-- strategy_subscriptions: 본인만 읽기/등록/수정/해지
drop policy if exists "strategy_subscriptions_select_own" on public.strategy_subscriptions;
create policy "strategy_subscriptions_select_own"
on public.strategy_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "strategy_subscriptions_insert_own" on public.strategy_subscriptions;
create policy "strategy_subscriptions_insert_own"
on public.strategy_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "strategy_subscriptions_update_own" on public.strategy_subscriptions;
create policy "strategy_subscriptions_update_own"
on public.strategy_subscriptions
for update
to authenticated
using (user_id = auth.uid());

-- strategy_performance/trades: 작성자 본인 + 공개 승인 전략은 읽기 가능
drop policy if exists "strategy_performance_select_owner_or_public" on public.strategy_performance;
create policy "strategy_performance_select_owner_or_public"
on public.strategy_performance
for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.strategies s
    where s.id = strategy_id
      and s.status in ('approved', 'published')
      and s.is_public = true
  )
);

drop policy if exists "strategy_trades_select_owner_or_public" on public.strategy_trades;
create policy "strategy_trades_select_owner_or_public"
on public.strategy_trades
for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.strategies s
    where s.id = strategy_id
      and s.status in ('approved', 'published')
      and s.is_public = true
  )
);

-- feedback: 본인 조회/등록 + admin 전체 조회
drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own"
on public.feedback
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
on public.feedback
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "feedback_admin_select_all" on public.feedback;
create policy "feedback_admin_select_all"
on public.feedback
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- support_tickets: 본인 조회/등록 + admin 전체 조회
drop policy if exists "support_tickets_select_own" on public.support_tickets;
create policy "support_tickets_select_own"
on public.support_tickets
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own"
on public.support_tickets
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "support_tickets_admin_select_all" on public.support_tickets;
create policy "support_tickets_admin_select_all"
on public.support_tickets
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- ---------------------------------------------------------
-- 8) 기존 subscriptions(레거시 결제 상태) 하드닝 옵션
-- ---------------------------------------------------------
-- 운영 전환 시 아래 정책을 활성화하면 사용자 직접 플랜 변경을 차단할 수 있습니다.
-- (기존 프론트 subscriptionService와 충돌하므로 서버 전환 후 적용 권장)
--
-- drop policy if exists "subscriptions_insert_own" on public.subscriptions;
-- drop policy if exists "subscriptions_update_own" on public.subscriptions;
--
-- create policy "subscriptions_select_own_only"
-- on public.subscriptions
-- for select
-- to authenticated
-- using (user_id = auth.uid());


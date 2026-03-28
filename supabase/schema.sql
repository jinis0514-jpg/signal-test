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
  name text not null,
  description text default '',
  asset text not null default 'BTC',
  timeframe text not null default '1h',
  mode text not null default 'nocode' check (mode in ('nocode', 'code')),
  strategy_type text default 'trend',
  risk_level text default 'mid' check (risk_level in ('low', 'mid', 'high')),
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'published', 'paused', 'archived')
  ),
  tags text[] not null default '{}',
  code text default '',
  conditions jsonb not null default '[]'::jsonb,
  risk_config jsonb not null default '{}'::jsonb,
  review_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
-- subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'trial', 'subscribed')),
  status text not null default 'active' check (status in ('active', 'expired', 'canceled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

--------------------------------------------------


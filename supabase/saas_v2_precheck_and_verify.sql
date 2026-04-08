-- =========================================================
-- SaaS v2 적용 전/후 점검 쿼리
-- 사용처: Supabase SQL Editor
-- =========================================================

-- 1) 기존 관련 테이블/정책/트리거 존재 여부 (실행 전 충돌 점검)
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'subscriptions',
    'user_plans',
    'payments',
    'strategy_subscriptions',
    'strategy_performance',
    'strategy_trades',
    'feedback',
    'support_tickets'
  )
order by tablename;

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('subscriptions', 'user_plans', 'payments')
order by tablename, policyname;

select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('user_plans', 'payments', 'strategy_subscriptions', 'strategies')
order by event_object_table, trigger_name;

-- 2) RLS 활성화 상태 확인 (실행 후 확인)
select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_plans', 'payments', 'strategy_subscriptions')
order by c.relname;

-- 3) 핵심 정책 확인 (실행 후 확인)
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_plans', 'payments', 'strategy_subscriptions')
order by tablename, policyname;

-- 4) 사용자 쓰기 권한 차단 검증용(수동 테스트)
-- 아래 테스트는 "authenticated 사용자 세션"에서 실행해야 의미가 있습니다.
-- user_plans / payments 는 insert/update가 실패해야 정상입니다.
--
-- insert into public.user_plans(user_id, plan, status) values (auth.uid(), 'pro', 'active');
-- update public.user_plans set plan = 'premium' where user_id = auth.uid();
-- insert into public.payments(user_id, plan, provider, provider_payment_id, amount_krw, status)
-- values (auth.uid(), 'pro', 'mock', 'test-1', 1000, 'succeeded');


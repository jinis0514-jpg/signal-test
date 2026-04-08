-- =========================================================
-- 레거시 subscriptions 정책 제거 (v2 안정화 이후 실행)
-- 주의: 프론트가 subscriptions write를 완전히 사용하지 않을 때만 실행
-- =========================================================

-- 기존 사용자 쓰기 정책 제거
drop policy if exists "subscriptions_insert_own" on public.subscriptions;
drop policy if exists "subscriptions_update_own" on public.subscriptions;

-- 본인 조회만 허용 (읽기 전용)
drop policy if exists "subscriptions_select_own_only" on public.subscriptions;
create policy "subscriptions_select_own_only"
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid());


-- 비로그인(anon)도 승인된 전략만 마켓 조회 가능 — 기존 RLS와 OR로 결합됩니다.
drop policy if exists "strategies_select_approved_anon" on public.strategies;
create policy "strategies_select_approved_anon"
on public.strategies
for select
to anon
using (status in ('approved', 'published'));

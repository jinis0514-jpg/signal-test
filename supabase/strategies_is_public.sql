-- 마켓 공개 여부: 검수 승인 시에만 true (anon 마켓 조회와 정합)
alter table public.strategies
  add column if not exists is_public boolean not null default false;

-- 기존 승인·게시 행은 공개로 간주
update public.strategies
  set is_public = true
  where status in ('approved', 'published');

-- anon: 공개 승인 전략만
drop policy if exists "strategies_select_approved_anon" on public.strategies;
create policy "strategies_select_approved_anon"
on public.strategies
for select
to anon
using (
  status in ('approved', 'published')
  and is_public = true
);

-- authenticated: 본인 전략은 전부 조회, 타인은 공개 승인만
drop policy if exists "strategies_select_published_or_own" on public.strategies;
create policy "strategies_select_published_or_own"
on public.strategies
for select
to authenticated
using (
  (
    status in ('approved', 'published')
    and is_public = true
  )
  or creator_id = auth.uid()
);

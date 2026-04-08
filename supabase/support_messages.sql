-- 사용자 피드백/문의 수집 테이블
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  form_type text not null check (form_type in ('feedback', 'inquiry')),
  category text not null,
  title text not null,
  content text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_messages_user_created
  on public.support_messages (user_id, created_at desc);

create index if not exists idx_support_messages_status_created
  on public.support_messages (status, created_at desc);

alter table public.support_messages enable row level security;

drop policy if exists "support_messages_select_own" on public.support_messages;
create policy "support_messages_select_own"
on public.support_messages
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "support_messages_insert_own" on public.support_messages;
create policy "support_messages_insert_own"
on public.support_messages
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "support_messages_admin_select_all" on public.support_messages;
create policy "support_messages_admin_select_all"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop trigger if exists trg_support_messages_updated_at on public.support_messages;
create trigger trg_support_messages_updated_at
before update on public.support_messages
for each row execute function public.set_updated_at();

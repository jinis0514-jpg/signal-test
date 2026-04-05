-- 알림 목록 조회 최적화 (user_id + 최신순)
-- Supabase SQL Editor에서 기존 DB에 적용 가능

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

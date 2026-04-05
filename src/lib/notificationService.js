import { supabase, isSupabaseConfigured } from './supabase'

/** DB `notifications.type` / 스키마 check 와 동일하게 유지 */
export const NOTIFICATION_TYPES = Object.freeze({
  ENTRY: 'entry',
  EXIT: 'exit',
  STRATEGY_UPDATE: 'strategy_update',
  REVIEW_RESULT: 'review_result',
  SYSTEM: 'system',
})

const ALLOWED = new Set(Object.values(NOTIFICATION_TYPES))

export class NotificationServiceError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message)
    this.name = 'NotificationServiceError'
    this.code = code
  }
}

function friendlyError(e, fallback) {
  if (e instanceof NotificationServiceError) return e
  const msg = e?.message ?? e?.error_description ?? fallback
  return new NotificationServiceError(typeof msg === 'string' ? msg : fallback, 'NETWORK')
}

function mustSupabase() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new NotificationServiceError(
      '알림 서버에 연결할 수 없습니다. 환경 설정을 확인해 주세요.',
      'NO_SUPABASE',
    )
  }
}

/** 타입별 짧은 배지 라벨 (UI) */
export function getNotificationTypeLabel(type) {
  const t = String(type ?? '')
  const m = {
    [NOTIFICATION_TYPES.ENTRY]: '진입',
    [NOTIFICATION_TYPES.EXIT]: '청산',
    [NOTIFICATION_TYPES.STRATEGY_UPDATE]: '전략',
    [NOTIFICATION_TYPES.REVIEW_RESULT]: '검수',
    [NOTIFICATION_TYPES.SYSTEM]: '시스템',
  }
  return m[t] ?? t
}

/** 절대/상대 시각 (짧게) */
export function formatNotificationTime(iso, now = Date.now()) {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Math.floor((now - t) / 1000)
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`
  return new Date(t).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

/** 목록에서 읽지 않은 개수 */
export function countUnreadNotifications(rows) {
  if (!Array.isArray(rows)) return 0
  return rows.filter((n) => n && !n.is_read).length
}

// ── 포맷터 (제목/본문 분리 → 향후 i18n·채널별 변형 용이) ─────────────────

export function formatReviewApproved(strategyName) {
  return {
    title: '전략 승인',
    message: `「${strategyName}」전략이 승인되었습니다.`,
  }
}

export function formatReviewRejected(strategyName, note = '') {
  return {
    title: '전략 반려',
    message: `「${strategyName}」전략이 반려되었습니다.${note ? ` 사유: ${note}` : ''}`,
  }
}

export function formatStrategySubmitted(strategyName) {
  return {
    title: '검수 대기 중',
    message: `「${strategyName}」전략이 검수 대기열에 등록되었습니다. 승인 후 마켓에 노출됩니다.`,
  }
}

export function formatStrategyUnderReview(strategyName) {
  return {
    title: '검토 시작',
    message: `「${strategyName}」전략이 운영자 검토 중입니다.`,
  }
}

export function formatSystemTrialStarted() {
  return { title: '체험 시작', message: '7일 무료 체험이 활성화되었습니다.' }
}

export function formatSystemSubscribed() {
  return { title: '구독 활성화', message: '유료 플랜이 활성화되었습니다.' }
}

export function formatSystemCanceled() {
  return { title: '구독 해지', message: '구독이 해지되었습니다. 무료 플랜 정책이 적용됩니다.' }
}

export function formatSignalEntry(strategyLabel, direction, price) {
  return {
    title: '진입 신호',
    message: `${strategyLabel} · ${direction} 진입 @ ${Number(price).toLocaleString()}`,
  }
}

export function formatSignalExit(strategyLabel, price) {
  return {
    title: '청산 신호',
    message: `${strategyLabel} · 청산 @ ${Number(price).toLocaleString()}`,
  }
}

/**
 * 향후 이메일/슬랙 등 — 인앱 저장과 분리된 발송 지점 (현재 no-op)
 * @param {object} payload
 */
export function dispatchExternalNotification(_payload) {
  /* Stripe / SendGrid / Telegram bot 등 연결 시 구현 */
}

/**
 * 최근 동일 알림 존재 시 insert 생략 (간단 중복 방지)
 * @param {string} userId
 * @param {{ type: string, title: string, windowMs?: number }} key
 */
async function hasRecentDuplicate(userId, { type, title, windowMs = 90_000 }) {
  if (!isSupabaseConfigured() || !supabase || !userId) return false
  const since = new Date(Date.now() - windowMs).toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,type,created_at')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('title', title)
    .gte('created_at', since)
    .limit(1)
  if (error || !data?.length) return false
  return true
}

/**
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.type — NOTIFICATION_TYPES
 * @param {string} p.title
 * @param {string} [p.message]
 * @param {boolean} [p.skipDuplicateCheck] — true면 중복 검사 안 함
 * @param {number} [p.dedupeWindowMs] — 중복 판정 시간(타이틀+타입 동일)
 */
export async function createNotification({
  userId,
  type,
  title,
  message = '',
  skipDuplicateCheck = false,
  dedupeWindowMs = 90_000,
}) {
  try {
    mustSupabase()
    const t = String(type)
    if (!ALLOWED.has(t)) {
      throw new NotificationServiceError(`지원하지 않는 알림 유형입니다: ${type}`, 'INVALID_TYPE')
    }
    if (!userId) {
      throw new NotificationServiceError('수신 사용자가 필요합니다.', 'NO_USER')
    }

    if (!skipDuplicateCheck) {
      const dup = await hasRecentDuplicate(userId, {
        type: t,
        title: String(title),
        windowMs: dedupeWindowMs,
      })
      if (dup) return null
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: t,
        title: String(title),
        message: String(message ?? ''),
      })
      .select('*')
      .single()

    if (error) throw error
    dispatchExternalNotification({ channel: 'in_app', row: data })
    return data
  } catch (e) {
    throw friendlyError(e, '알림을 저장하지 못했습니다.')
  }
}

export async function fetchNotifications(userId, limit = 50) {
  if (!isSupabaseConfigured() || !supabase || !userId) return []
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)))
    if (error) throw error
    return data ?? []
  } catch (e) {
    throw friendlyError(e, '알림 목록을 불러오지 못했습니다.')
  }
}

export async function markNotificationRead(notificationId, userId) {
  try {
    mustSupabase()
    if (!notificationId || !userId) {
      throw new NotificationServiceError('알림 정보가 올바르지 않습니다.', 'INVALID')
    }
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
    if (error) throw error
  } catch (e) {
    throw friendlyError(e, '읽음 처리에 실패했습니다.')
  }
}

export async function markAllNotificationsRead(userId) {
  try {
    mustSupabase()
    if (!userId) throw new NotificationServiceError('로그인이 필요합니다.', 'NO_USER')
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw error
  } catch (e) {
    throw friendlyError(e, '모두 읽음 처리에 실패했습니다.')
  }
}

/**
 * Realtime 구독
 * @returns {() => void} unsubscribe
 */
export function subscribeToNotifications(userId, onMessage) {
  if (!isSupabaseConfigured() || !supabase || !userId || typeof onMessage !== 'function') {
    return () => {}
  }

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        try {
          onMessage(payload)
        } catch {
          /* 콜백 오류는 무시 */
        }
      },
    )
    .subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      /* ignore */
    }
  }
}

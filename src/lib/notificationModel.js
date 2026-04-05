/**
 * 인앱 알림 UI/네비게이션 모델 (DB `notifications.type` 과 별개의 표시용 종류)
 * - DB: entry | exit | strategy_update | review_result | system
 * - UI: LONG/SHORT/청산/구독·전략 상태 등
 */

import { NOTIFICATION_TYPES } from './notificationService'

/** @typedef {'long_entry' | 'short_entry' | 'exit' | 'subscription' | 'strategy_status' | 'review' | 'system' | 'other'} NotificationUiKind */

const UI = Object.freeze({
  LONG_ENTRY: 'long_entry',
  SHORT_ENTRY: 'short_entry',
  EXIT: 'exit',
  SUBSCRIPTION: 'subscription',
  STRATEGY_STATUS: 'strategy_status',
  REVIEW: 'review',
  SYSTEM: 'system',
  OTHER: 'other',
})

const DEFAULT_SIGNAL_STRATEGY_ID = 'btc-trend'

/**
 * @param {object} row
 * @returns {NotificationUiKind}
 */
export function inferNotificationUiKind(row) {
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : null
  if (meta?.uiKind && typeof meta.uiKind === 'string') {
    const k = meta.uiKind
    if (Object.values(UI).includes(k)) return k
  }

  const t = String(row?.type ?? '')
  const title = String(row?.title ?? '')
  const msg = String(row?.message ?? '')

  if (t === NOTIFICATION_TYPES.SYSTEM) {
    if (/구독|체험|해지|플랜|결제/i.test(title + msg)) return UI.SUBSCRIPTION
    return UI.SYSTEM
  }

  if (t === NOTIFICATION_TYPES.STRATEGY_UPDATE) return UI.STRATEGY_STATUS
  if (t === NOTIFICATION_TYPES.REVIEW_RESULT) return UI.REVIEW

  if (t === NOTIFICATION_TYPES.EXIT) return UI.EXIT

  if (t === NOTIFICATION_TYPES.ENTRY) {
    if (/SHORT|숏/i.test(title) || /SHORT|숏/i.test(msg)) return UI.SHORT_ENTRY
    if (/LONG|롱/i.test(title) || /LONG|롱/i.test(msg)) return UI.LONG_ENTRY
    return UI.LONG_ENTRY
  }

  return UI.OTHER
}

/** @param {NotificationUiKind} kind */
export function getUiKindLabel(kind) {
  const m = {
    [UI.LONG_ENTRY]: 'LONG',
    [UI.SHORT_ENTRY]: 'SHORT',
    [UI.EXIT]: '청산',
    [UI.SUBSCRIPTION]: '구독',
    [UI.STRATEGY_STATUS]: '전략',
    [UI.REVIEW]: '검수',
    [UI.SYSTEM]: '시스템',
    [UI.OTHER]: '알림',
  }
  return m[kind] ?? '알림'
}

/** 배지 색 (가벼운 톤) */
export function getUiKindBadgeClass(kind) {
  switch (kind) {
    case UI.LONG_ENTRY:
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-200'
    case UI.SHORT_ENTRY:
      return 'bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
    case UI.EXIT:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/35 dark:text-amber-200'
    case UI.SUBSCRIPTION:
      return 'bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200'
    case UI.STRATEGY_STATUS:
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200'
    case UI.REVIEW:
      return 'bg-blue-100 text-blue-900 dark:bg-blue-950/45 dark:text-blue-200'
    case UI.SYSTEM:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  }
}

/**
 * 클릭 시 이동할 앱 페이지 (params는 App에서 처리)
 * @returns {{ page: string, strategyId?: string, section?: string } | null}
 */
export function getNotificationNavTarget(row) {
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {}
  const nav = meta.nav && typeof meta.nav === 'object' ? meta.nav : {}

  if (nav.page === 'signal' || nav.page === 'market' || nav.page === 'mypage' || nav.page === 'home' || nav.page === 'plans' || nav.page === 'editor') {
    return {
      page: nav.page,
      strategyId: typeof nav.strategyId === 'string' ? nav.strategyId : undefined,
      section: typeof nav.section === 'string' ? nav.section : undefined,
    }
  }

  const t = String(row?.type ?? '')

  if (t === NOTIFICATION_TYPES.ENTRY || t === NOTIFICATION_TYPES.EXIT) {
    return {
      page: 'signal',
      strategyId: typeof meta.strategyId === 'string' ? meta.strategyId : DEFAULT_SIGNAL_STRATEGY_ID,
    }
  }

  if (t === NOTIFICATION_TYPES.SYSTEM) {
    const kind = inferNotificationUiKind(row)
    if (kind === UI.SUBSCRIPTION) {
      return { page: 'mypage', section: 'subscription' }
    }
    return { page: 'mypage', section: 'subscription' }
  }

  if (t === NOTIFICATION_TYPES.STRATEGY_UPDATE || t === NOTIFICATION_TYPES.REVIEW_RESULT) {
    return { page: 'mypage', section: 'strategies' }
  }

  return { page: 'home' }
}

export function isMockNotificationId(id) {
  return typeof id === 'string' && id.startsWith('bb-mock-')
}

/** 앱 내부(클라이언트) 시그널 알림 id */
export function isAppNotificationId(id) {
  return typeof id === 'string' && id.startsWith('bb-app-')
}

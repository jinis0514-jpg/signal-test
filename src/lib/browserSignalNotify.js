/**
 * 브라우저 Notification API — 실시간 시그널 OS 알림 (macOS / Windows Chromium 계열)
 * - 권한: default 일 때 최초 1회만 request (localStorage 플래그)
 * - 거부(denied) 시 재요청 없음 (브라우저 정책 + 플래그로 default 재요청도 억제)
 */

const LS_PROMPTED = 'bb_signal_notify_prompted'
const DEDUPE_MS = 90_000
const MAX_RECENT = 400

/** @type {Map<string, number>} */
const recentFire = new Map()

/** @type {((strategyId: string) => void) | null} */
let navigateHandler = null

export function setBrowserSignalNavigateHandler(fn) {
  navigateHandler = typeof fn === 'function' ? fn : null
}

export function isBrowserNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function pruneRecent(now) {
  if (recentFire.size <= MAX_RECENT) return
  for (const [k, t] of recentFire) {
    if (now - t > DEDUPE_MS) recentFire.delete(k)
  }
}

/**
 * 최초 1회만 권한 요청. 이미 default가 아니거나 이미 요청 시도했으면 호출 no-op.
 * @returns {Promise<NotificationPermission | 'unsupported'>}
 */
export function requestSignalNotificationPermissionOnce() {
  if (!isBrowserNotificationSupported()) return Promise.resolve('unsupported')
  const cur = Notification.permission
  if (cur !== 'default') return Promise.resolve(cur)
  try {
    if (window.localStorage?.getItem(LS_PROMPTED) === '1') {
      return Promise.resolve('default')
    }
    window.localStorage?.setItem(LS_PROMPTED, '1')
  } catch {
    /* private mode 등 */
  }
  try {
    return Notification.requestPermission()
  } catch {
    return Promise.resolve('denied')
  }
}

function formatPriceLine(price) {
  const n = Number(price)
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('ko-KR')
}

/**
 * @param {object} p
 * @param {string} p.strategyName
 * @param {string} p.strategyId
 * @param {'long'|'short'|'exit'} p.kind
 * @param {number|string} p.price
 * @param {string} p.dedupeKey
 */
export function notifySignalBrowser({ strategyName, strategyId, kind, price, dedupeKey }) {
  if (!isBrowserNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  if (!dedupeKey) return

  const now = Date.now()
  pruneRecent(now)
  const last = recentFire.get(dedupeKey)
  if (last != null && now - last < DEDUPE_MS) return

  const title = `[${String(strategyName ?? '전략').trim() || '전략'}]`
  let headline = '시그널'
  if (kind === 'long') headline = 'LONG 진입 발생'
  else if (kind === 'short') headline = 'SHORT 진입 발생'
  else if (kind === 'exit') headline = '청산 발생'

  const body = `${headline}\n현재 가격: ${formatPriceLine(price)}`

  recentFire.set(dedupeKey, now)

  let n
  try {
    n = new Notification(title, {
      body,
      tag: dedupeKey.slice(0, 64),
      silent: false,
    })
  } catch {
    return
  }

  n.onclick = () => {
    try {
      window.focus()
    } catch {
      /* ignore */
    }
    try {
      navigateHandler?.(String(strategyId ?? ''))
    } catch {
      /* ignore */
    }
    try {
      n.close()
    } catch {
      /* ignore */
    }
  }
}

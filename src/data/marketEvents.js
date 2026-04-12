/**
 * 수동 입력 시장 이벤트 (추후 경제 캘린더·뉴스 API로 대체 가능)
 * scheduledAtUtc: Unix ms (UTC) — 화면에는 한국시간(KST)으로만 표시
 */

export const MANUAL_MARKET_EVENTS = [
  {
    id: 'ev-cpi',
    title: '미국 CPI 발표',
    impact: 'high',
    window: '이번 주',
    /** 2026-04-12 12:30 UTC ≒ KST 04/12 21:30 */
    scheduledAtUtc: Date.UTC(2026, 3, 12, 12, 30),
  },
  {
    id: 'ev-fomc',
    title: 'FOMC 금리 결정',
    impact: 'high',
    window: '다음 주',
    /** 2026-04-16 18:00 UTC ≒ KST 04/17 03:00 */
    scheduledAtUtc: Date.UTC(2026, 3, 16, 18, 0),
  },
  {
    id: 'ev-etf',
    title: '주요 ETF 흐름 관련 뉴스',
    impact: 'medium',
    window: '상시',
    scheduledAtUtc: null,
  },
  {
    id: 'ev-pce',
    title: 'PCE 물가 지표',
    impact: 'medium',
    window: '월간',
    scheduledAtUtc: Date.UTC(2026, 3, 28, 20, 30),
  },
]

/** @param {number | null | undefined} utcMs */
export function formatMarketEventKst(utcMs) {
  const n = Number(utcMs)
  if (!Number.isFinite(n)) return null
  const d = new Date(n)
  try {
    const s = d.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/\d{4},\s*(\d{1,2}):(\d{2})/)
    if (m) {
      return `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')} ${String(m[3]).padStart(2, '0')}:${m[4]} (KST)`
    }
    return `${s} (KST)`
  } catch {
    return null
  }
}

/** UI 강조용: high 우선, 없으면 첫 항목 */
export function pickHighlightMarketEvent(events = MANUAL_MARKET_EVENTS) {
  const list = Array.isArray(events) ? events : []
  const hi = list.find((e) => String(e?.impact ?? '').toLowerCase() === 'high')
  return hi ?? list[0] ?? null
}

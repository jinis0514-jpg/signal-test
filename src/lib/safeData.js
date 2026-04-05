/**
 * 출시 전 QA — null/undefined 방어 (white screen 방지)
 */

export function safeArray(value) {
  return Array.isArray(value) ? value : []
}

export function safeObject(value, fallback = {}) {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

export function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

/** 문자열 메서드 호출 전 */
export function safeStartsWith(str, prefix) {
  return safeString(str).startsWith(prefix)
}

/**
 * performance 객체에서 KPI 추출 (누락 시 숫자 0)
 */
export function buildSafePerformance(perf) {
  const safe = safeObject(perf)
  return {
    totalReturnPct: safeNumber(safe.totalReturnPct ?? safe.roi, 0),
    maxDrawdown: Math.abs(safeNumber(safe.maxDrawdown ?? safe.mdd, 0)),
    winRate: safeNumber(safe.winRate, 0),
    tradeCount: Math.max(0, Math.floor(safeNumber(safe.tradeCount ?? safe.totalTrades, 0))),
  }
}

/**
 * 시그널 결과 문자열 톤 (색상 매핑용)
 */
export function getSignalResultTone(result) {
  const s = safeString(result)
  if (!s) return 'neutral'
  if (s.startsWith('+')) return 'positive'
  if (s.startsWith('-')) return 'negative'
  return 'neutral'
}

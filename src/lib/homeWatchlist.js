/**
 * 홈 대시보드 — 종합 시세 리스트 (getCachedPrice와 동일 심볼 키)
 */

export const HOME_WATCH_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT',
  'MATIC', 'LTC', 'ATOM', 'UNI', 'ETC', 'APT', 'ARB', 'OP', 'NEAR', 'INJ',
  'SUI', 'SEI', 'TIA', 'WLD',
]

/** @param {number} pct */
export function commentForChange(pct) {
  const p = Number(pct)
  if (!Number.isFinite(p)) return '데이터 확인 중'
  if (p > 2) return '강한 상승세 지속 중'
  if (p < -2) return '하락 압력 증가'
  if (p < 0) return '단기 조정 구간'
  return '횡보 구간'
}

/**
 * @param {string} symbol
 * @param {{ changePercent?: number, usdPrice?: number }} quote
 */
export function formatCoinCommentLine(symbol, quote) {
  const pct = Number(quote?.changePercent)
  const sym = String(symbol || '').toUpperCase()
  if (!Number.isFinite(pct)) {
    return `${sym} — → "${commentForChange(0)}"`
  }
  const sign = pct >= 0 ? '+' : ''
  return `${sym} ${sign}${pct.toFixed(2)}% → ${commentForChange(pct)}`
}

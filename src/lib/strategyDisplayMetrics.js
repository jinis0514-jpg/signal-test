/**
 * 전 페이지 공통 — 전략 KPI 표시·추출 (normalizeMarketStrategy 단일 소스)
 */
import { normalizeMarketStrategy } from './marketStrategy'
import { safeArray, safeNumber, safeString } from './safeData'

export { safeArray, safeObject, safeNumber, safeString, buildSafePerformance } from './safeData'

/** 누적 수익률 등 — 부호 포함 */
export function formatDisplayPct(value, digits = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
}

/** MDD — 항상 −표기 */
export function formatDisplayMdd(value, digits = 1) {
  const n = Math.abs(Number(value))
  if (!Number.isFinite(n)) return '—'
  return `−${n.toFixed(digits)}%`
}

export function formatDisplayWinRate(value, digits = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

export function formatDisplayTradeCount(value) {
  const n = Math.floor(safeNumber(value, 0))
  return `${Math.max(0, n)}`
}

/**
 * 마켓·상세·홈 카드용 — 동일 필드로 통일
 */
export function getUnifiedStrategyMetrics(raw) {
  const n = normalizeMarketStrategy(raw && typeof raw === 'object' ? raw : {})
  const sig = safeArray(n.recentSignals)
  const last = sig[0]
  let positionLabel = '대기'
  const dirSrc = last?.dir ?? n.currentDir
  if (dirSrc) {
    const d = String(dirSrc).toUpperCase()
    if (d === 'LONG' || d === 'BUY') positionLabel = 'LONG'
    else if (d === 'SHORT' || d === 'SELL') positionLabel = 'SHORT'
  }
  return {
    id: safeString(n.id, ''),
    name: safeString(n.name, ''),
    totalReturnPct: safeNumber(n.totalReturnPct, 0),
    maxDrawdown: safeNumber(n.maxDrawdown, 0),
    winRate: safeNumber(n.winRate, 0),
    tradeCount: Math.max(0, Math.floor(safeNumber(n.tradeCount, 0))),
    recentRoi7d: n.recentRoi7d != null && Number.isFinite(Number(n.recentRoi7d)) ? Number(n.recentRoi7d) : null,
    recentRoi30d: n.recentRoi30d != null && Number.isFinite(Number(n.recentRoi30d)) ? Number(n.recentRoi30d) : null,
    positionLabel,
    riskLevelMarket: safeString(n.riskLevelMarket, '보통'),
  }
}

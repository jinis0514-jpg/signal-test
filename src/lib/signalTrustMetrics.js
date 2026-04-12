/**
 * 시그널 화면용 신뢰도·성공률·매칭률 집계
 */
import { computeRecentRoiPct } from './marketStrategy'
import { computeTrustScore } from './strategyTrustScore'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * 최근 청산 거래 기준 승률 (%)
 * @param {Array<{pnl?: number}>} trades
 */
export function computeRecentWinPctFromTrades(trades, { limit = 28 } = {}) {
  if (!Array.isArray(trades) || trades.length === 0) return null
  const withPnl = trades.filter((t) => t && Number.isFinite(Number(t.pnl)))
  if (!withPnl.length) return null
  const slice = withPnl.slice(-Math.max(1, limit))
  const wins = slice.filter((t) => Number(t.pnl) >= 0).length
  return (wins / slice.length) * 100
}

/**
 * @param {object} opts
 * @param {object} [opts.strategy] — 카탈로그 전략
 * @param {object|null} [opts.userStrat] — 사용자 전략(있으면 strategy 위에 병합)
 * @param {Array} [opts.trades] — 엔진 청산 거래
 * @param {object} [opts.backtestMeta] — computeRecentRoiPct용
 * @param {object} [opts.closedPerformance] — { mdd, winRate, totalTrades, roi }
 */
export function buildSignalTrustMetrics({
  strategy = {},
  userStrat = null,
  trades = [],
  backtestMeta = {},
  closedPerformance = {},
}) {
  const s = userStrat && typeof userStrat === 'object' ? { ...strategy, ...userStrat } : strategy

  const matchRaw = num(s.matchRate ?? s.match_rate)
  const matchPct = Number.isFinite(matchRaw) ? matchRaw : null

  let recentSuccessPct = computeRecentWinPctFromTrades(trades, { limit: 28 })
  if (recentSuccessPct == null) {
    const wr = num(closedPerformance.winRate ?? s.winRate)
    recentSuccessPct = Number.isFinite(wr) ? wr : null
  }

  const live30 = computeRecentRoiPct(trades, backtestMeta, 30)
  const verifiedReturn = num(s.verifiedReturn ?? s.verified_return_pct ?? closedPerformance.roi)

  const matchForScore = Number.isFinite(matchRaw) ? matchRaw : num(s.winRate ?? closedPerformance.winRate)

  const trustPct = computeTrustScore({
    matchRate: Number.isFinite(matchForScore) ? matchForScore : 0,
    verifiedReturn: Number.isFinite(verifiedReturn) ? verifiedReturn : 0,
    liveReturn30d: Number.isFinite(live30) ? live30 : 0,
    maxDrawdown: Math.abs(num(closedPerformance.mdd ?? s.mdd ?? s.maxDrawdown)),
    tradeCount: num(closedPerformance.totalTrades ?? trades.length ?? s.totalTrades ?? s.trades),
    hasRealVerification: !!(s.hasRealVerification ?? s.is_trade_verified),
  })

  return {
    trustPct,
    recentSuccessPct,
    matchPct,
  }
}

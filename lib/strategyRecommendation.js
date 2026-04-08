import { computeTrustScore } from './strategyTrustScore'

export function computeStrategyScore(strategy) {
  const trust = computeTrustScore({
    matchRate: strategy.matchRate,
    verifiedReturn: strategy.verifiedReturn,
    liveReturn30d: strategy.recentRoi30d ?? strategy.roi30d,
    maxDrawdown: strategy.maxDrawdown ?? strategy.mdd,
    tradeCount: strategy.tradeCount ?? strategy.trades,
    hasRealVerification: strategy.hasRealVerification,
  })

  const roi = Number(strategy.totalReturnPct ?? strategy.roi ?? 0)
  const recent = Number(strategy.recentRoi7d ?? strategy.roi7d ?? 0)
  const mdd = Math.abs(Number(strategy.maxDrawdown ?? strategy.mdd ?? 0))

  let score = 0

  // 신뢰 (핵심)
  score += trust * 0.5

  // 수익률
  score += roi * 0.3

  // 최근 흐름
  score += recent * 0.2

  // 리스크 패널티
  if (mdd > 20) score -= 10
  if (mdd > 30) score -= 20

  return score
}

export function pickTopStrategy(strategies = []) {
  if (!Array.isArray(strategies) || strategies.length === 0) return null

  const scored = strategies.map((s) => ({
    ...s,
    _score: computeStrategyScore(s),
  }))

  scored.sort((a, b) => b._score - a._score)

  return scored[0]
}

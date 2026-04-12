/**
 * 시장·전략·리스크·신뢰도·유저 성향을 통합한 AI 스타일 전략 추천 점수
 */
import { getMarketInsight } from './marketStateEngine'
import { computeTrustScore } from './strategyTrustScore'

function strategyMatchesRecommendedType(strategy, recommendedType) {
  if (recommendedType === '안정형') {
    return strategy.profileLabel === '안정형' || strategy.profileKey === 'stable'
  }
  if (recommendedType === '추세형') {
    return strategy.typeLabel === '추세형' || strategy.typeKey === 'trend'
  }
  if (recommendedType === '단타형') {
    return strategy.typeLabel === '단타형' || strategy.typeKey === 'scalping'
  }
  if (recommendedType === '역추세형') {
    return strategy.typeLabel === '역추세형' || strategy.typeKey === 'counter'
  }
  return false
}

/** recommendStrategiesByMarket 내부와 동일한 시장 적합도 (전체 전략에 대해 계산) */
function computeMarketFitScore(strategy, market) {
  let score = 0
  const insight = getMarketInsight(market)
  const recommendedType = insight.recommendedType

  if (strategyMatchesRecommendedType(strategy, recommendedType)) score += 30
  if (strategy.profileLabel === '안정형' && market.volatilityLabel === '높음') score += 10
  if (strategy.profileLabel === '공격형' && market.marketType === 'trend_up') score += 10
  if (Number(strategy.recentRoi7d ?? strategy.roi7d ?? 0) > 0) score += 10
  if (Boolean(strategy.hasRealVerification)) score += 15
  const mr = Number(strategy.matchRate ?? strategy.match_rate ?? 0)
  if (Number.isFinite(mr) && mr >= 70) score += 10
  const mddAbs = Math.abs(Number(strategy.maxDrawdown ?? strategy.mdd ?? 0))
  if (Number.isFinite(mddAbs) && mddAbs <= 12) score += 10

  return score
}

function resolveTrustScore(s) {
  const t = Number(s.trustScore)
  if (Number.isFinite(t) && t > 0) return t
  return computeTrustScore({
    matchRate: Number(s.matchRate ?? s.match_rate ?? 0),
    verifiedReturn: Number(s.verifiedReturn ?? s.verified_return ?? s.verified_return_pct ?? 0),
    liveReturn30d: Number(s.liveReturn30d ?? s.recentRoi30d ?? s.roi30d ?? 0),
    maxDrawdown: Math.abs(Number(s.maxDrawdown ?? s.mdd ?? 0)),
    tradeCount: Number(s.tradeCount ?? s.trades ?? 0),
    hasRealVerification: Boolean(s.hasRealVerification),
  })
}

export function recommendStrategies({
  strategies = [],
  market = {},
  userProfile = {},
}) {
  const safe = Array.isArray(strategies) ? strategies : []

  return safe
    .map((s) => {
      const mfRaw = Number(s.marketFitScore)
      const marketFitScore =
        Number.isFinite(mfRaw) && mfRaw > 0 ? mfRaw : computeMarketFitScore(s, market)

      const trustScore = resolveTrustScore(s)

      let score = 0

      score += marketFitScore * 0.3
      score += trustScore * 0.25

      if (s.hasRealVerification) score += 10

      const mr = Number(s.matchRate ?? s.match_rate ?? 0)
      if (Number.isFinite(mr) && mr >= 70) score += 10

      const mdd = Math.abs(Number(s.mdd ?? s.maxDrawdown ?? 0))
      if (Number.isFinite(mdd) && mdd <= 12) score += 10
      else if (Number.isFinite(mdd) && mdd >= 25) score -= 5

      const roi7d = Number(s.roi7d ?? s.recentRoi7d ?? 0)
      if (roi7d > 0) score += 5

      const pref = userProfile?.preference
      if (pref === '안정형' && s.profileLabel === '안정형') score += 10
      if (pref === '공격형' && s.profileLabel === '공격형') score += 10

      return {
        ...s,
        marketFitScore,
        trustScore,
        aiScore: score,
      }
    })
    .sort((a, b) => b.aiScore - a.aiScore)
}

export function buildAIPortfolio(strategies = []) {
  const sorted = [...strategies]
    .filter((s) => s && Number.isFinite(Number(s.aiScore)))
    .sort((a, b) => Number(b.aiScore) - Number(a.aiScore))

  if (!sorted.length) return []

  const primary = sorted[0]
  const secondary =
    sorted.find(
      (s) =>
        s.id !== primary.id
        && String(s.typeLabel ?? '') !== String(primary.typeLabel ?? ''),
    )
    ?? sorted.find((s) => s.id !== primary.id)
    ?? null

  const hedge = sorted.find(
    (s) => s.id !== primary.id && s.profileLabel === '안정형',
  )

  const out = []
  const seen = new Set()
  for (const item of [primary, secondary, hedge]) {
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out.slice(0, 3)
}

export function buildRecommendationReason(strategy = {}, _market = {}) {
  const reasons = []

  const mf = Number(strategy.marketFitScore ?? 0)
  if (mf >= 70) reasons.push('현재 시장과 적합')

  if (strategy.hasRealVerification) reasons.push('실거래 검증 완료')

  const mr = Number(strategy.matchRate ?? strategy.match_rate ?? 0)
  if (Number.isFinite(mr) && mr >= 70) reasons.push('시그널 일치도 높음')

  const mdd = Math.abs(Number(strategy.mdd ?? strategy.maxDrawdown ?? 0))
  if (Number.isFinite(mdd) && mdd <= 12) reasons.push('리스크 안정적')

  return reasons.slice(0, 3)
}

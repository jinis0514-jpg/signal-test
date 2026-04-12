/**
 * BTC 변동·방향 + (선택) 캔들 평균 레인지 → 시장 레짐 · 추천 문장 · 전략 3개
 */

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/**
 * @param {{ changePercent?: number|null, avgRangePct?: number|null }} ctx
 * @returns {{ dir: 'up'|'down'|'flat', vol: 'high'|'mid'|'low' }}
 */
export function inferMarketRegime(ctx = {}) {
  const ch = safeNum(ctx.changePercent, 0)
  const avgR = ctx.avgRangePct != null ? Number(ctx.avgRangePct) : NaN
  const absCh = Math.abs(ch)

  let dir = 'flat'
  if (ch > 0.35) dir = 'up'
  else if (ch < -0.35) dir = 'down'

  let vol = 'mid'
  if (Number.isFinite(avgR) && avgR > 0) {
    if (avgR >= 2.2) vol = 'high'
    else if (avgR < 1.0) vol = 'low'
  } else {
    if (absCh >= 2.5) vol = 'high'
    else if (absCh < 1) vol = 'low'
  }

  return { dir, vol }
}

/**
 * @param {{ dir: string, vol: string }} regime
 */
export function buildMarketRecommendationHeadline(regime) {
  const { dir, vol } = regime
  if (vol === 'high' && dir === 'up') {
    return '현재 시장에서는 변동성 돌파·모멘텀형 전략이 유리할 수 있습니다'
  }
  if (vol === 'high' && dir === 'down') {
    return '하락 압력과 변동성이 함께 큰 구간에서는 추세·돌파 신호를 우선 점검하는 편이 좋습니다'
  }
  if (vol === 'high' && dir === 'flat') {
    return '변동성은 크지만 방향성은 박스권에 가깝습니다. 돌파 확인 후 추세를 따라가는 전략을 고려해 보세요'
  }
  if (vol === 'low' && dir === 'flat') {
    return '현재 시장에서는 레인지·평균회귀 전략이 상대적으로 유리합니다'
  }
  if (vol === 'low' && (dir === 'up' || dir === 'down')) {
    return '변동성은 낮고 방향성만 있는 구간입니다. 완만한 추세 추종·분할 진입형 전략을 참고하세요'
  }
  if (dir === 'up') {
    return '현재 시장에서는 추세 전략이 유리합니다'
  }
  if (dir === 'down') {
    return '하락 압력이 큰 구간에서는 추세 대응·리스크 관리형 전략을 우선 살펴보세요'
  }
  return '횡보 구간에서는 박스권 대응·평균회귀 전략이 상대적으로 유리합니다'
}

function baseKind(s) {
  const t = String(s.type ?? s.strategy_type ?? '').toLowerCase()
  const me = String(s.marketEnv ?? '').toLowerCase()
  if (t === 'breakout') return 'breakout'
  if (t === 'mean_reversion' || t.includes('mean')) return 'range'
  if (t === 'range') return 'range'
  if (t === 'volatility') return 'volatility'
  if (t === 'trend' || t.includes('momentum')) return 'trend'
  if (me === 'range') return 'range'
  if (me === 'trend') return 'trend'
  return 'trend'
}

function scoreStrategyForRegime(s, regime) {
  const kind = baseKind(s)
  const { dir, vol } = regime
  let score = safeNum(s.recommendationScore, 0)

  const trendBoost = kind === 'trend' ? 120 : kind === 'momentum' ? 115 : 0
  const rangeBoost = kind === 'range' ? 120 : 0
  const breakBoost = kind === 'breakout' ? 120 : 0
  const volaBoost = kind === 'volatility' ? 95 : 0

  if (vol === 'high') {
    score += breakBoost + volaBoost * 0.95
    if (dir !== 'flat') score += trendBoost * 0.85
    else score += rangeBoost * 0.35
  } else if (vol === 'low') {
    score += rangeBoost + volaBoost * 0.45
    if (dir !== 'flat') score += trendBoost * 0.55
    score += breakBoost * 0.2
  } else {
    if (dir === 'flat') {
      score += rangeBoost + volaBoost * 0.5
      score += trendBoost * 0.45
      score += breakBoost * 0.35
    } else {
      score += trendBoost + breakBoost * 0.75
      score += volaBoost * 0.55
      score += rangeBoost * 0.35
    }
  }

  score += safeNum(s.recentRoi7d ?? s.roi7d, 0) * 0.45
  score += safeNum(s.totalReturnPct ?? s.roi, 0) * 0.03
  return score
}

/**
 * @param {object[]} strategies — normalizeMarketStrategy 결과
 * @param {{ changePercent?: number|null, avgRangePct?: number|null }} ctx
 * @param {{ limit?: number }} [options]
 */
export function pickMarketBasedRecommendations(strategies = [], ctx = {}, options = {}) {
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 3))
  const regime = inferMarketRegime(ctx)
  const headline = buildMarketRecommendationHeadline(regime)

  const list = (strategies ?? []).filter((s) => String(s.type ?? 'signal') !== 'method')
  const scored = list
    .map((s) => ({ s, score: scoreStrategyForRegime(s, regime) }))
    .sort((a, b) => b.score - a.score)

  return {
    regime,
    headline,
    strategies: scored.slice(0, limit).map((x) => x.s),
  }
}

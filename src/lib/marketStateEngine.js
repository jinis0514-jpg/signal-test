/**
 * 시장 상태 분류 · 해석 · 시장 기반 전략 추천 (과장 없이 데이터·방향만 제시)
 */

export function classifyMarketState({
  btcChange24h = 0,
  ethChange24h = 0,
  avgRangePct = 0,
  dominanceTrend = '',
  volumeTrend = '',
}) {
  const btc = Number(btcChange24h ?? 0)
  const eth = Number(ethChange24h ?? 0)
  const range = Math.abs(Number(avgRangePct ?? 0))

  let marketTrend = '중립'
  let volatilityLabel = '보통'
  let marketType = 'mixed'

  if (btc >= 2 && eth >= 1.5) {
    marketTrend = '상승 추세'
    marketType = 'trend_up'
  } else if (btc <= -2 && eth <= -1.5) {
    marketTrend = '하락 추세'
    marketType = 'trend_down'
  } else if (Math.abs(btc) < 1 && Math.abs(eth) < 1) {
    marketTrend = '횡보'
    marketType = 'range'
  }

  if (Math.abs(btc) >= 3.5 || range >= 2.2) {
    volatilityLabel = '높음'
  } else if (Math.abs(btc) >= 1.5 || range >= 1.0) {
    volatilityLabel = '보통'
  } else {
    volatilityLabel = '낮음'
  }

  return {
    marketTrend,
    volatilityLabel,
    marketType,
    dominanceTrend,
    volumeTrend,
  }
}

export function getMarketInsight(market = {}) {
  const { volatilityLabel, marketType } = market

  if (marketType === 'trend_up' && volatilityLabel === '높음') {
    return {
      summary: '강한 상승 추세 속 변동성이 큰 구간입니다.',
      action: '추세 추종형 전략이 유리할 수 있지만 추격 진입보다 눌림 확인이 중요합니다.',
      recommendedType: '추세형',
    }
  }

  if (marketType === 'trend_down' && volatilityLabel === '높음') {
    return {
      summary: '하락 추세 속 변동성이 커진 구간입니다.',
      action: '숏 관점 전략이나 보수적 대응이 더 적합할 수 있습니다.',
      recommendedType: '역추세형',
    }
  }

  if (marketType === 'range') {
    return {
      summary: '방향성이 약한 횡보 구간입니다.',
      action: '짧은 손절 기반 단타 전략이 더 유리할 수 있습니다.',
      recommendedType: '단타형',
    }
  }

  return {
    summary: '현재 시장은 뚜렷한 방향성이 강하지 않습니다.',
    action: '검증된 전략 위주로 보수적으로 접근하는 것이 좋습니다.',
    recommendedType: '안정형',
  }
}

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

export function recommendStrategiesByMarket(strategies = [], market = {}) {
  const insight = getMarketInsight(market)
  const recommendedType = insight.recommendedType

  const scored = (strategies ?? []).map((strategy) => {
    let score = 0

    if (strategyMatchesRecommendedType(strategy, recommendedType)) score += 30
    if (strategy.profileLabel === '안정형' && market.volatilityLabel === '높음') score += 10
    if (strategy.profileLabel === '공격형' && market.marketType === 'trend_up') score += 10
    if (Number(strategy.recentRoi7d ?? strategy.roi7d ?? 0) > 0) score += 10
    if (Boolean(strategy.hasRealVerification)) score += 15
    const mr = Number(strategy.matchRate ?? strategy.match_rate ?? 0)
    if (Number.isFinite(mr) && mr >= 70) score += 10
    const mddAbs = Math.abs(Number(strategy.maxDrawdown ?? strategy.mdd ?? 0))
    if (Number.isFinite(mddAbs) && mddAbs <= 12) score += 10

    return {
      ...strategy,
      marketFitScore: score,
    }
  })

  return scored
    .sort((a, b) => b.marketFitScore - a.marketFitScore)
    .slice(0, 3)
}

/**
 * 상세 모달용 — 시장 분류와 전략 성격 연결 한 줄
 */
export function describeStrategyMarketFit(strategy = {}, market = {}) {
  const insight = getMarketInsight(market)
  const rec = insight.recommendedType
  const tl = String(strategy.typeLabel ?? '')
  const pl = String(strategy.profileLabel ?? '')
  const tKey = String(strategy.typeKey ?? '')

  const matches =
    (rec === '안정형' && (pl === '안정형' || strategy.profileKey === 'stable'))
    || (rec === '추세형' && (tl === '추세형' || tKey === 'trend'))
    || (rec === '단타형' && (tl === '단타형' || tKey === 'scalping'))
    || (rec === '역추세형' && (tl === '역추세형' || tKey === 'counter'))

  if (matches) {
    return '현재 시장 분류와 전략 유형이 비교적 잘 맞는 편입니다.'
  }
  if (market.volatilityLabel === '높음') {
    return '변동성이 큰 구간이므로 포지션·손절 기준을 보수적으로 두는 편이 좋습니다.'
  }
  if (market.marketType === 'range') {
    return '횡보 구간에서는 방향성 신호가 잦아질 수 있어 짧은 손절·리스크 관리가 중요합니다.'
  }
  if (market.marketType === 'trend_down' && market.volatilityLabel === '높음') {
    return '하락·고변동 구간에서는 추격 진입보다 확인 후 대응이 안전할 수 있습니다.'
  }
  return '시장 분류와 전략 성격을 함께 보고 판단해 주세요.'
}

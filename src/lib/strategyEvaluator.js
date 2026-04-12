/**
 * 전략 자동 평가 — 수치 기반 한 줄 결론·강약점 (과장 표현 없음)
 */

function num(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

export function evaluateStrategy(strategy = {}) {
  const roi = num(strategy.totalReturnPct ?? strategy.roi, 0)
  const winRate = num(strategy.winRate, 0)
  const mdd = Math.abs(num(strategy.maxDrawdown ?? strategy.mdd, 0))
  const tradeCount = num(strategy.tradeCount ?? strategy.trades, 0)
  const matchRate = num(strategy.matchRate ?? strategy.match_rate, 0)
  const recent7d = num(strategy.recentRoi7d ?? strategy.roi7d, 0)
  const hasRealVerification = Boolean(strategy.hasRealVerification)

  let summary = ''
  let strength = ''
  let weakness = ''
  let verdict = ''
  let tone = 'neutral'

  if (mdd <= 10 && winRate >= 60) {
    summary = '안정적으로 수익을 추구하는 전략입니다.'
  } else if (roi >= 30 && mdd >= 15) {
    summary = '수익률은 높지만 변동성도 큰 전략입니다.'
  } else if (tradeCount < 30) {
    summary = '아직 데이터가 충분히 쌓이지 않은 전략입니다.'
  } else {
    summary = '성과와 리스크가 균형적인 전략입니다.'
  }

  if (roi >= 30) {
    strength = '최근 누적 수익률이 높은 편입니다.'
  } else if (winRate >= 65) {
    strength = '승률이 안정적인 편입니다.'
  } else if (hasRealVerification && matchRate >= 70) {
    strength = '실거래 기준 일치도가 높은 전략입니다.'
  } else {
    strength = '특정 시장 구간에서 꾸준한 성과를 보입니다.'
  }

  if (mdd >= 20) {
    weakness = '손실 구간에서 낙폭이 커질 수 있습니다.'
  } else if (tradeCount < 30) {
    weakness = '표본 수가 적어 추가 검증이 필요합니다.'
  } else if (recent7d < 0) {
    weakness = '최근 단기 성과는 다소 약한 편입니다.'
  } else {
    weakness = '횡보장에서는 효율이 낮아질 수 있습니다.'
  }

  if (hasRealVerification && matchRate >= 75 && recent7d >= 0 && mdd <= 15) {
    verdict = '실거래 기준으로도 비교적 신뢰할 수 있는 전략입니다.'
    tone = 'positive'
  } else if (tradeCount < 20 || matchRate < 50) {
    verdict = '추가 검증이 더 필요한 전략입니다.'
    tone = 'warning'
  } else if (mdd >= 25) {
    verdict = '수익 가능성은 있지만 리스크 관리가 중요한 전략입니다.'
    tone = 'warning'
  } else {
    verdict = '현재 기준으로 무난하게 검토할 수 있는 전략입니다.'
    tone = 'neutral'
  }

  return {
    summary,
    strength,
    weakness,
    verdict,
    tone,
  }
}

function archetypeHints(strategy = {}) {
  const typeL = String(strategy.typeLabel ?? '').trim()
  const typeAlt = String(strategy.type ?? '').trim()
  return {
    trend: typeL === '추세형' || (typeAlt.includes('추세') && !typeAlt.includes('역')),
    scalping: typeL === '단타형' || typeAlt.includes('단타'),
    counter: typeL === '역추세형' || typeAlt.includes('역추세'),
  }
}

/**
 * @param {object} strategy
 * @param {object} market
 * @param {string} [market.volatilityLabel] 예: 높음/보통/낮음
 * @param {string} [market.marketTrend] 예: 강한 상승/상승/횡보/하락
 * @param {string} [market.trendLabel] marketTrend 대체 키
 */
export function evaluateStrategyWithMarket(strategy = {}, market = {}) {
  const base = evaluateStrategy(strategy)
  const volatility = String(market.volatilityLabel ?? '')
  const trend = String(market.marketTrend ?? market.trendLabel ?? '')
  const { trend: isTrend, scalping, counter } = archetypeHints(strategy)

  let currentFit = ''

  if (isTrend && trend.includes('상승')) {
    currentFit = '현재 시장 흐름과 비교적 잘 맞는 상태입니다.'
  } else if (scalping && volatility.includes('높음')) {
    currentFit = '현재 변동성이 커 단타 전략에 유리할 수 있습니다.'
  } else if (counter && trend.includes('강한 상승')) {
    currentFit = '강한 추세 구간에서는 보수적으로 보는 것이 좋습니다.'
  } else {
    currentFit = '현재 시장과의 적합성은 보통 수준입니다.'
  }

  return {
    ...base,
    currentFit,
  }
}

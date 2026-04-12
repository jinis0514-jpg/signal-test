/**
 * 전략·시장 맥락 시나리오 (판단 보조, 예측·확약 표현 없음)
 */

import { computeTrustScore } from './strategyTrustScore'

function effectiveTrustScore(strategy = {}) {
  const raw = Number(strategy.trustScore)
  if (Number.isFinite(raw) && raw > 0) return raw
  return computeTrustScore({
    matchRate: Number(strategy.matchRate ?? strategy.match_rate ?? 0),
    verifiedReturn: Number(strategy.verifiedReturn ?? strategy.verified_return_pct ?? 0),
    liveReturn30d: Number(strategy.recentRoi30d ?? strategy.roi30d ?? 0),
    maxDrawdown: Math.abs(Number(strategy.maxDrawdown ?? strategy.mdd ?? 0)),
    tradeCount: Number(strategy.tradeCount ?? strategy.trades ?? 0),
    hasRealVerification: !!strategy.hasRealVerification,
  })
}

function inferTypeLabel(strategy = {}) {
  const direct = String(strategy.typeLabel ?? '').trim()
  if (direct) return direct
  const t = String(strategy.type ?? strategy.strategyTypeLabel ?? '')
  if (/역추세|역\s*추세|counter|mean\s*revert/i.test(t)) return '역추세형'
  if (/스윙|swing/i.test(t)) return '스윙형'
  if (/단타|스캘프|scalp|레인지|range|횡보|박스/i.test(t)) return '단타형'
  if (/추세|트렌드|trend|모멘텀|돌파|momentum|breakout/i.test(t)) return '추세형'
  return '추세형'
}

function inferProfileLabel(strategy = {}) {
  const direct = String(strategy.profileLabel ?? '').trim()
  if (direct) return direct
  const mdd = Math.abs(Number(strategy.maxDrawdown ?? strategy.mdd ?? 0))
  if (Number.isFinite(mdd) && mdd <= 10) return '안정형'
  if (Number.isFinite(mdd) && mdd >= 18) return '공격형'
  return '안정형'
}

/**
 * @param {object} strategy
 * @param {object} market — classifyMarketState 결과 등 (marketType, volatilityLabel)
 */
export function buildStrategyScenario(strategy = {}, market = {}) {
  const typeLabel = inferTypeLabel(strategy)
  const profileLabel = inferProfileLabel(strategy)
  const marketType = String(market.marketType ?? '')
  const volatilityLabel = String(market.volatilityLabel ?? '')
  const recent7d = Number(strategy.recentRoi7d ?? strategy.roi7d ?? 0)
  const mdd = Math.abs(Number(strategy.maxDrawdown ?? strategy.mdd ?? 0))
  const trustScore = effectiveTrustScore(strategy)

  let primaryScenario = ''
  let riskScenario = ''
  let actionGuide = ''
  let confidence = '보통'

  if (typeLabel === '추세형' && marketType === 'trend_up') {
    primaryScenario = '상승 추세가 유지되면 비교적 좋은 흐름을 이어갈 가능성이 있습니다.'
    riskScenario = '급격한 눌림이나 가짜 돌파가 나오면 손절이 짧게 반복될 수 있습니다.'
    actionGuide = '추격 진입보다 눌림 확인 이후 접근이 더 유리할 수 있습니다.'
  } else if (typeLabel === '단타형' && marketType === 'range') {
    primaryScenario = '횡보 구간에서는 짧은 진입/청산으로 대응하기 유리할 수 있습니다.'
    riskScenario = '박스권 상단/하단 이탈이 급하게 나오면 반대 방향 손실이 커질 수 있습니다.'
    actionGuide = '짧은 손절 기준을 명확히 두고 진입하는 것이 중요합니다.'
  } else if (typeLabel === '역추세형' && marketType === 'trend_up') {
    primaryScenario = '과열 구간에서 짧은 되돌림을 노리는 전략으로 볼 수 있습니다.'
    riskScenario = '강한 추세가 계속 이어지면 역방향 진입이 불리할 수 있습니다.'
    actionGuide = '추세가 매우 강할 때는 보수적으로 보는 것이 좋습니다.'
  } else if (typeLabel === '스윙형') {
    primaryScenario = '방향성이 유지되면 중기 흐름을 따라가기 유리한 전략입니다.'
    riskScenario = '단기 변동성이 커지면 중간 손실 구간이 길어질 수 있습니다.'
    actionGuide = '짧은 결과보다 며칠 단위 흐름으로 보는 것이 더 적합합니다.'
  } else {
    primaryScenario = '현재 시장에서는 무난하게 검토할 수 있는 전략입니다.'
    riskScenario = '방향성이 자주 바뀌는 장세에서는 성과가 흔들릴 수 있습니다.'
    actionGuide = '확신이 약하면 표본이 더 쌓일 때까지 관찰하는 것도 좋습니다.'
  }

  if (volatilityLabel === '높음' && actionGuide) {
    actionGuide = `${actionGuide} 변동성이 큰 구간에서는 포지션 크기를 줄여 보는 것도 고려할 수 있습니다.`
  }

  if (profileLabel === '공격형' && riskScenario) {
    riskScenario = `${riskScenario} 공격형 설정은 손실 폭이 커질 수 있습니다.`
  }

  if (trustScore >= 80 && recent7d >= 0 && mdd <= 12) {
    confidence = '높음'
  } else if (trustScore < 55 || mdd >= 20 || recent7d < 0) {
    confidence = '주의'
  }

  return {
    primaryScenario,
    riskScenario,
    actionGuide,
    confidence,
  }
}

export function getScenarioSummary(scenario = {}) {
  const confidence = String(scenario.confidence ?? '보통')

  if (confidence === '높음') {
    return '현재 시장 기준으로 비교적 기대 시나리오가 명확한 전략입니다.'
  }

  if (confidence === '주의') {
    return '가능성은 있지만 보수적으로 접근해야 하는 전략입니다.'
  }

  return '현재 시장에서 무난하게 검토할 수 있는 전략입니다.'
}

/** 홈·마켓 카드용 짧은 한 줄 */
export function getScenarioOneLiner(strategy = {}, market = {}) {
  const typeLabel = inferTypeLabel(strategy)
  const marketType = String(market.marketType ?? '')

  if (typeLabel === '추세형' && marketType === 'trend_up') {
    return '상승 추세 유지 시 유리할 수 있습니다.'
  }
  if (typeLabel === '단타형' && marketType === 'range') {
    return '횡보 구간에서는 짧은 대응에 적합할 수 있습니다.'
  }
  if (typeLabel === '역추세형' && marketType === 'trend_up') {
    return '강한 추세장에서는 보수적으로 볼 필요가 있습니다.'
  }
  if (typeLabel === '스윙형') {
    return '중기 흐름을 기준으로 보는 편이 맞습니다.'
  }
  if (marketType === 'trend_down') {
    return '하락장에서는 손절·포지션 크기를 더 엄격히 보는 편이 좋습니다.'
  }
  const sc = buildStrategyScenario(strategy, market)
  const sum = getScenarioSummary(sc)
  return sum.length > 48 ? `${sum.slice(0, 46)}…` : sum
}

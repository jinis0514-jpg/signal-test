/**
 * 시장 이벤트(CPI·금리 등)와 전략/시장 맥락 연결 — 예측이 아닌 영향·참고 수준
 */

export function classifyMarketEvent(event = {}) {
  const title = String(event.title ?? '')
  const impact = String(event.impact ?? 'medium').toLowerCase()

  if (/CPI|PCE|물가/i.test(title)) {
    return {
      type: 'inflation',
      label: '물가 지표',
      impact,
    }
  }

  if (/FOMC|금리|연준|Fed/i.test(title)) {
    return {
      type: 'interest_rate',
      label: '금리 이벤트',
      impact,
    }
  }

  if (/ETF/i.test(title)) {
    return {
      type: 'etf',
      label: 'ETF 관련',
      impact,
    }
  }

  return {
    type: 'general',
    label: '일반 이벤트',
    impact,
  }
}

/** 원본 이벤트에 분류 필드 병합 */
export function mergeClassifiedEvent(event = {}) {
  const c = classifyMarketEvent(event)
  return {
    ...event,
    ...c,
    impact: String(event.impact ?? c.impact ?? 'medium').toLowerCase(),
  }
}

export function getEventImpactOnStrategy(event = {}, strategy = {}, market = {}) {
  const merged = mergeClassifiedEvent(event)
  const eventType = merged.type
  const typeLabel = String(strategy.typeLabel ?? '')
  const volatility = String(market.volatilityLabel ?? '')

  let summary = ''
  let impactLevel = 'neutral'
  let action = ''

  if (eventType === 'inflation') {
    summary = '물가 지표 발표 전후로 변동성이 커질 가능성이 있습니다.'
    if (typeLabel === '단타형') {
      impactLevel = 'positive'
      action = '짧은 대응 전략이 유리할 수 있습니다.'
    } else {
      impactLevel = 'warning'
      action = '큰 변동성으로 손절 구간이 늘어날 수 있습니다.'
    }
    if (volatility === '높음') {
      action = `${action} 현재 변동성도 높은 편이라 체크를 촘촘히 하는 것이 좋습니다.`
    }
  } else if (eventType === 'interest_rate') {
    summary = '금리 이벤트는 방향성을 크게 바꿀 수 있습니다.'
    if (typeLabel === '추세형') {
      impactLevel = 'warning'
      action = '방향 전환 가능성에 주의가 필요합니다.'
    } else {
      impactLevel = 'neutral'
      action = '변동성 확대 구간으로 볼 수 있습니다.'
    }
    if (volatility === '높음' && typeLabel !== '추세형') {
      action = `${action} 변동성이 이미 큰 구간과 겹칠 수 있습니다.`
    }
  } else if (eventType === 'etf') {
    summary = 'ETF 관련 뉴스는 시장 방향에 영향을 줄 수 있습니다.'
    if (typeLabel === '추세형') {
      impactLevel = 'positive'
      action = '추세가 이어질 때는 유리할 수 있습니다.'
    } else {
      impactLevel = 'neutral'
      action = '방향성 확인 후 접근하는 편이 좋습니다.'
    }
  } else {
    summary = '시장에 영향을 줄 수 있는 이벤트입니다.'
    impactLevel = 'neutral'
    action = '보수적으로 접근하는 것이 좋습니다.'
  }

  return {
    summary,
    impactLevel,
    action,
    label: merged.label,
    type: eventType,
  }
}

export function getMarketEventInsight(event = {}, market = {}) {
  const merged = mergeClassifiedEvent(event)
  const volatility = String(market.volatilityLabel ?? '')

  if (merged.impact === 'high') {
    return {
      summary: '중요 이벤트로 인해 시장 변동성이 확대될 수 있습니다.',
      guide: '진입 타이밍을 신중하게 보는 것이 좋습니다.',
    }
  }

  if (volatility === '높음') {
    return {
      summary: '현재 시장에 영향을 줄 수 있는 이벤트가 존재합니다.',
      guide: '변동성이 큰 구간과 겹칠 수 있어 참고하는 것이 좋습니다.',
    }
  }

  return {
    summary: '현재 시장에 영향을 줄 수 있는 이벤트가 존재합니다.',
    guide: '전략 선택 시 참고하는 것이 좋습니다.',
  }
}

/**
 * 시그널 신뢰도 보정: 중요(high) 이벤트 구간은 불확실성 반영으로 소폭 감점
 */
export function getSignalTrustEventAdjustment(events = [], _market = {}) {
  const list = Array.isArray(events) ? events : []
  const hasHigh = list.some((ev) => mergeClassifiedEvent(ev).impact === 'high')
  if (hasHigh) return -3
  return 0
}

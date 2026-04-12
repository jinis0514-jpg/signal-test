/**
 * 개별 시그널 신뢰도 (0~100) — 전략 신뢰도와 별개로 “지금 이 신호”의 질을 보조 판단
 */

export function computeSignalTrustScore({
  strategyTrustScore = 0,
  matchRate = 0,
  recentWinRate = 0,
  marketFitScore = 0,
  reasonCount = 0,
  volatilityLabel = '보통',
  signalAgeMinutes = 0,
  hasRealVerification = false,
  /** 시장 이벤트 등 외부 보정(보통 음수 소폭) */
  eventTrustAdjustment = 0,
}) {
  let score = 0

  score += Math.min(30, Number(strategyTrustScore ?? 0) * 0.3)

  const mr = Number(matchRate ?? 0)
  if (mr >= 80) score += 20
  else if (mr >= 65) score += 14
  else if (mr >= 50) score += 8

  const rw = Number(recentWinRate ?? 0)
  if (rw >= 65) score += 15
  else if (rw >= 55) score += 10
  else if (rw >= 45) score += 5

  const mf = Number(marketFitScore ?? 0)
  if (mf >= 80) score += 15
  else if (mf >= 60) score += 10
  else if (mf >= 40) score += 5

  const rc = Number(reasonCount ?? 0)
  if (rc >= 3) score += 10
  else if (rc === 2) score += 6
  else if (rc === 1) score += 3

  if (hasRealVerification) score += 5

  const age = Number(signalAgeMinutes ?? 0)
  if (age > 60) score -= 10
  else if (age > 20) score -= 5

  if (volatilityLabel === '높음') score -= 3

  score += Number(eventTrustAdjustment ?? 0)

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function getSignalTrustGrade(score = 0) {
  const s = Number(score)
  if (s >= 85) {
    return { label: '매우 높음', tone: 'positive' }
  }
  if (s >= 70) {
    return { label: '높음', tone: 'positive' }
  }
  if (s >= 55) {
    return { label: '보통', tone: 'neutral' }
  }
  if (s >= 40) {
    return { label: '주의', tone: 'warning' }
  }
  return { label: '낮음', tone: 'danger' }
}

export function getSignalTrustInsight(score = 0) {
  const s = Number(score)
  if (s >= 85) {
    return '실거래 기준과 최근 성과를 함께 볼 때 비교적 강한 신호입니다.'
  }
  if (s >= 70) {
    return '현재 기준으로 비교적 신뢰할 수 있는 신호입니다.'
  }
  if (s >= 55) {
    return '확인은 가능하지만 보수적으로 보는 것이 좋습니다.'
  }
  if (s >= 40) {
    return '시장 변동성 또는 근거 부족으로 주의가 필요합니다.'
  }
  return '추가 확인이 더 필요한 신호입니다.'
}

/**
 * 짧은 근거 칩 (최대 3개)
 */
export function getSignalTrustEvidenceTags({
  matchRate = 0,
  recentWinRate = 0,
  marketFitScore = 0,
  reasonCount = 0,
  hasRealVerification = false,
} = {}) {
  const tags = []
  const mr = Number(matchRate)
  if (mr >= 65) tags.push('실거래 매칭률 양호')
  else if (mr >= 50) tags.push('매칭률 확인 가능')

  const rw = Number(recentWinRate)
  if (rw >= 55) tags.push('최근 성과 안정적')
  else if (rw >= 45) tags.push('최근 성과 보통')

  const mf = Number(marketFitScore)
  if (mf >= 60) tags.push('시장 적합도 높음')
  else if (mf >= 40) tags.push('시장 적합 참고')

  const rc = Number(reasonCount)
  if (rc >= 3) tags.push('진입 근거 다수')
  else if (rc >= 1) tags.push('진입 근거 있음')

  if (hasRealVerification) tags.push('실거래 인증 연동')

  return [...new Set(tags)].slice(0, 3)
}

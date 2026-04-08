export function computeTrustScore({
  matchRate = 0,
  verifiedReturn = 0,
  liveReturn30d = 0,
  maxDrawdown = 0,
  tradeCount = 0,
  hasRealVerification = false,
}) {
  let score = 0

  // 1. 실거래 인증
  if (hasRealVerification) score += 25

  // 2. 매칭률
  if (matchRate >= 80) score += 25
  else if (matchRate >= 60) score += 18
  else if (matchRate >= 40) score += 10

  // 3. 실거래 수익률
  if (verifiedReturn > 10) score += 15
  else if (verifiedReturn > 0) score += 10

  // 4. 최근 성과 (30일)
  if (liveReturn30d > 5) score += 10
  else if (liveReturn30d > 0) score += 5

  // 5. 리스크 (MDD)
  if (maxDrawdown < 10) score += 15
  else if (maxDrawdown < 20) score += 8

  // 6. 거래 수
  if (tradeCount > 100) score += 10
  else if (tradeCount > 50) score += 5

  return Math.min(100, Math.max(0, Math.round(score)))
}

export function getTrustGrade(score = 0) {
  if (score >= 85) return { grade: 'S', label: '매우 신뢰', color: 'emerald' }
  if (score >= 70) return { grade: 'A', label: '신뢰 가능', color: 'emerald' }
  if (score >= 55) return { grade: 'B', label: '보통', color: 'yellow' }
  if (score >= 40) return { grade: 'C', label: '주의', color: 'orange' }
  return { grade: 'D', label: '위험', color: 'red' }
}

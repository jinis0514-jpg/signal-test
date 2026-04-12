/**
 * 전략 간 유사도·분산(상관) — 조합 질·겹침 참고 (과장 없음)
 */

export function computeStrategySimilarity(a = {}, b = {}) {
  let score = 0

  if (a.typeLabel && b.typeLabel && a.typeLabel === b.typeLabel) score += 30

  if (a.profileLabel && b.profileLabel && a.profileLabel === b.profileLabel) score += 20

  const aMdd = Math.abs(Number(a.maxDrawdown ?? a.mdd ?? 0))
  const bMdd = Math.abs(Number(b.maxDrawdown ?? b.mdd ?? 0))
  if (Number.isFinite(aMdd) && Number.isFinite(bMdd) && Math.abs(aMdd - bMdd) <= 5) score += 10

  const aRecent = Number(a.recentRoi7d ?? a.roi7d ?? 0)
  const bRecent = Number(b.recentRoi7d ?? b.roi7d ?? 0)
  if ((aRecent >= 0 && bRecent >= 0) || (aRecent < 0 && bRecent < 0)) score += 10

  if (a.strongMarketLabel && b.strongMarketLabel && a.strongMarketLabel === b.strongMarketLabel) {
    score += 15
  }
  if (a.weakMarketLabel && b.weakMarketLabel && a.weakMarketLabel === b.weakMarketLabel) {
    score += 15
  }

  return Math.min(100, score)
}

export function computeDiversificationScore(a = {}, b = {}) {
  const similarity = computeStrategySimilarity(a, b)

  let bonus = 0

  if (a.typeLabel && b.typeLabel && a.typeLabel !== b.typeLabel) bonus += 20

  if (a.profileLabel && b.profileLabel && a.profileLabel !== b.profileLabel) bonus += 15

  if (a.strongMarketLabel && b.strongMarketLabel && a.strongMarketLabel !== b.strongMarketLabel) {
    bonus += 15
  }

  const aRecent = Number(a.recentRoi7d ?? a.roi7d ?? 0)
  const bRecent = Number(b.recentRoi7d ?? b.roi7d ?? 0)
  if ((aRecent >= 0 && bRecent < 0) || (aRecent < 0 && bRecent >= 0)) bonus += 10

  const score = Math.max(0, Math.min(100, 100 - similarity + bonus))

  return score
}

export function evaluateStrategyPair(a = {}, b = {}) {
  const similarity = computeStrategySimilarity(a, b)
  const diversification = computeDiversificationScore(a, b)

  let summary = ''
  let warning = ''
  let recommendation = ''

  if (similarity >= 70) {
    summary = '두 전략의 성격이 비슷해 조합 효과는 크지 않을 수 있습니다.'
    warning = '같은 장세에서 동시에 약해질 가능성이 있습니다.'
    recommendation = '둘 중 하나를 고르거나, 성격이 다른 전략을 섞는 것이 좋습니다.'
  } else if (diversification >= 75) {
    summary = '성격이 달라 분산 효과를 기대할 수 있는 조합입니다.'
    warning = '성과 흐름이 다를 수 있으므로 기대 수익도 균일하지 않을 수 있습니다.'
    recommendation = '공격형 + 안정형처럼 보완적 조합으로 보기 좋습니다.'
  } else {
    summary = '부분적으로 겹치지만 일정 수준의 분산은 가능한 조합입니다.'
    warning = '시장 상황에 따라 비슷하게 움직일 수 있습니다.'
    recommendation = '현재 시장 상태를 함께 고려해 선택하는 것이 좋습니다.'
  }

  return {
    similarity,
    diversification,
    summary,
    warning,
    recommendation,
  }
}

export function findComplementaryStrategies(baseStrategy = {}, strategies = []) {
  const safe = Array.isArray(strategies) ? strategies : []
  const bid = baseStrategy?.id

  return safe
    .filter((s) => s != null && String(s.id) !== String(bid))
    .map((s) => {
      const pair = evaluateStrategyPair(baseStrategy, s)
      return {
        ...s,
        pairSimilarity: pair.similarity,
        pairDiversification: pair.diversification,
        pairSummary: pair.summary,
        pairWarning: pair.warning,
        pairRecommendation: pair.recommendation,
      }
    })
    .sort((a, b) => Number(b.pairDiversification ?? 0) - Number(a.pairDiversification ?? 0))
    .slice(0, 3)
}

export function findOverlappingStrategies(baseStrategy = {}, strategies = []) {
  const safe = Array.isArray(strategies) ? strategies : []
  const bid = baseStrategy?.id

  return safe
    .filter((s) => s != null && String(s.id) !== String(bid))
    .map((s) => {
      const pair = evaluateStrategyPair(baseStrategy, s)
      return {
        ...s,
        pairSimilarity: pair.similarity,
        pairDiversification: pair.diversification,
        pairSummary: pair.summary,
      }
    })
    .sort((a, b) => Number(b.pairSimilarity ?? 0) - Number(a.pairSimilarity ?? 0))
    .slice(0, 3)
}

/**
 * 선호 순서가 정해진 후보(예: 시장 적합도 내림차순)에서 첫 항목을 유지한 채
 * 나머지는 기존 선택 대비 분산 점수가 최대가 되도록 탐욕 선택
 */
export function pickDiversifiedFromOrdered(orderedStrategies = [], limit = 3) {
  const seen = new Set()
  const pool = []
  for (const s of orderedStrategies ?? []) {
    if (!s || s.id == null) continue
    const id = String(s.id)
    if (seen.has(id)) continue
    seen.add(id)
    pool.push(s)
  }
  if (pool.length === 0) return []

  const selected = [pool[0]]
  const rest = pool.slice(1)

  while (selected.length < limit && rest.length > 0) {
    let bestI = 0
    let bestMinDiv = -Infinity
    for (let i = 0; i < rest.length; i += 1) {
      const cand = rest[i]
      const minDiv = Math.min(
        ...selected.map((s) => computeDiversificationScore(cand, s)),
      )
      if (minDiv > bestMinDiv) {
        bestMinDiv = minDiv
        bestI = i
      }
    }
    selected.push(rest[bestI])
    rest.splice(bestI, 1)
  }

  return selected
}

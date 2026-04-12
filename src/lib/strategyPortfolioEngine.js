/**
 * 전략 조합(포트폴리오) 추천 — 단일 추천을 넘어 보완·분산 관점 제시 (과장 없음)
 */

import { recommendStrategiesByMarket } from './marketStateEngine'
import { computeTrustScore } from './strategyTrustScore'
import { pickDiversifiedFromOrdered } from './strategyCorrelationEngine'

function signalStrategiesOnly(strategies) {
  const safe = Array.isArray(strategies) ? strategies : []
  return safe.filter((s) => String(s?.type ?? 'signal') !== 'method')
}

function attachTrustScore(s) {
  const existing = Number(s?.trustScore)
  if (Number.isFinite(existing) && existing > 0) return { ...s, trustScore: existing }
  return {
    ...s,
    trustScore: computeTrustScore({
      matchRate: Number(s?.matchRate ?? s?.match_rate ?? 0),
      verifiedReturn: Number(s?.verifiedReturn ?? s?.verified_return_pct ?? 0),
      liveReturn30d: Number(s?.recentRoi30d ?? s?.roi30d ?? 0),
      maxDrawdown: Math.abs(Number(s?.maxDrawdown ?? s?.mdd ?? 0)),
      tradeCount: Number(s?.tradeCount ?? s?.trades ?? 0),
      hasRealVerification: !!s?.hasRealVerification,
    }),
  }
}

/**
 * 유형별 대표 1개씩 (안정·공격·단타·스윙)
 */
export function buildStrategyPortfolio(strategies = []) {
  const safe = signalStrategiesOnly(strategies).map(attachTrustScore)

  const stable = safe
    .filter((s) => s.profileLabel === '안정형')
    .sort((a, b) => Number(b.trustScore ?? 0) - Number(a.trustScore ?? 0))[0] ?? null

  const aggressive = safe
    .filter((s) => s.profileLabel === '공격형')
    .sort(
      (a, b) =>
        Number(b.roi ?? b.totalReturnPct ?? 0) - Number(a.roi ?? a.totalReturnPct ?? 0),
    )[0] ?? null

  const shortTerm = safe
    .filter((s) => s.typeLabel === '단타형')
    .sort(
      (a, b) =>
        Number(b.recentRoi7d ?? b.roi7d ?? 0) - Number(a.recentRoi7d ?? a.roi7d ?? 0),
    )[0] ?? null

  const swing = safe
    .filter((s) => s.typeLabel === '스윙형')
    .sort((a, b) => Number(b.trustScore ?? 0) - Number(a.trustScore ?? 0))[0] ?? null

  return {
    stable,
    aggressive,
    shortTerm,
    swing,
  }
}

function dedupeById(list) {
  const seen = new Set()
  const out = []
  for (const s of list) {
    const id = s?.id
    if (id == null || seen.has(id)) continue
    seen.add(id)
    out.push(s)
  }
  return out
}

/**
 * 시장 상태에 맞춘 3개 조합 + 요약 문구
 */
export function buildRecommendedPortfolio(strategies = [], market = {}) {
  const base = signalStrategiesOnly(strategies)
  const scored = recommendStrategiesByMarket(base, market)

  const marketType = String(market.marketType ?? '')
  const volatility = String(market.volatilityLabel ?? '')

  let picks = []
  let summary = ''
  let reason = ''

  if (marketType === 'trend_up' && volatility === '높음') {
    picks = scored.filter(
      (s) =>
        ['추세형', '단타형'].includes(s.typeLabel) ||
        ['공격형', '안정형'].includes(s.profileLabel),
    )
    picks.sort((a, b) => Number(b.marketFitScore ?? 0) - Number(a.marketFitScore ?? 0))
    picks = pickDiversifiedFromOrdered(dedupeById(picks), 3)
    summary = '상승 추세 + 고변동성 대응 조합'
    reason = '추세 추종 전략과 짧은 대응 전략을 함께 보는 구간입니다.'
  } else if (marketType === 'range') {
    picks = scored.filter(
      (s) =>
        ['단타형', '역추세형'].includes(s.typeLabel) ||
        s.profileLabel === '안정형',
    )
    picks.sort((a, b) => Number(b.marketFitScore ?? 0) - Number(a.marketFitScore ?? 0))
    picks = pickDiversifiedFromOrdered(dedupeById(picks), 3)
    summary = '횡보장 대응 조합'
    reason = '방향성이 약한 구간이라 짧은 손절 기반 전략 조합이 유리할 수 있습니다.'
  } else if (marketType === 'trend_down') {
    picks = scored.filter(
      (s) =>
        ['역추세형', '단타형'].includes(s.typeLabel) ||
        s.profileLabel === '안정형',
    )
    picks.sort((a, b) => Number(b.marketFitScore ?? 0) - Number(a.marketFitScore ?? 0))
    picks = pickDiversifiedFromOrdered(dedupeById(picks), 3)
    summary = '하락장 방어 조합'
    reason = '보수적 대응 또는 짧은 진입 기반 전략이 더 적합한 구간입니다.'
  } else {
    const withTrust = scored.map(attachTrustScore)
    picks = [...withTrust]
      .sort((a, b) => Number(b.trustScore ?? 0) - Number(a.trustScore ?? 0))
    picks = pickDiversifiedFromOrdered(dedupeById(picks), 3)
    summary = '균형형 추천 조합'
    reason = '현재는 검증된 전략을 균형 있게 섞어 보는 것이 좋습니다.'
  }

  if (picks.length < 3) {
    const have = new Set((picks ?? []).map((p) => String(p.id)))
    const rest = scored
      .filter((s) => !have.has(String(s.id)))
      .sort((a, b) => Number(b.marketFitScore ?? 0) - Number(a.marketFitScore ?? 0))
    const merged = dedupeById([...(picks ?? []), ...rest])
    picks = pickDiversifiedFromOrdered(merged, 3)
  }

  return {
    picks,
    summary,
    reason,
  }
}

/**
 * 조합 성격 한 줄 설명
 */
export function describePortfolioMix(strategies = []) {
  const list = Array.isArray(strategies) ? strategies : []

  const hasStable = list.some((s) => s.profileLabel === '안정형')
  const hasAggressive = list.some((s) => s.profileLabel === '공격형')
  const hasShortTerm = list.some((s) => s.typeLabel === '단타형')
  const hasSwing = list.some((s) => s.typeLabel === '스윙형')

  if (hasStable && hasAggressive) {
    return '안정형과 공격형을 함께 섞어 수익성과 방어력을 균형 있게 가져가는 조합입니다.'
  }

  if (hasShortTerm && hasSwing) {
    return '짧은 대응 전략과 중기 전략을 함께 보는 분산형 조합입니다.'
  }

  if (hasStable) {
    return '변동성을 낮추고 안정적으로 접근하는 보수형 조합입니다.'
  }

  return '시장 상황에 맞는 전략을 함께 묶어 보는 기본 조합입니다.'
}

/**
 * 상세 화면용 — 현재 전략과 보완 성격 1~2개
 */
export function pickComplementaryStrategies(current, strategies = [], market = {}, max = 2) {
  if (!current?.id) return []
  const id = String(current.id)
  const pool = signalStrategiesOnly(strategies).filter((s) => String(s.id) !== id)
  if (pool.length === 0) return []

  const scored = recommendStrategiesByMarket(pool, market)
  const curProf = String(current.profileLabel ?? '')
  const curType = String(current.typeLabel ?? '')

  const ranked = scored.map((s) => {
    let bonus = 0
    if (curProf === '공격형' && s.profileLabel === '안정형') bonus += 40
    if (curProf === '안정형' && s.profileLabel === '공격형') bonus += 28
    if (curType === '추세형' && (s.typeLabel === '단타형' || s.typeLabel === '스윙형')) bonus += 26
    if (curType === '단타형' && s.typeLabel === '스윙형') bonus += 24
    if (curType === '스윙형' && s.typeLabel === '단타형') bonus += 22
    if (s.typeLabel && s.typeLabel !== curType) bonus += 12
    if (s.profileLabel && s.profileLabel !== curProf) bonus += 8
    return { s, score: bonus + Number(s.marketFitScore ?? 0) }
  })

  ranked.sort((a, b) => b.score - a.score)

  const out = []
  const seen = new Set()
  for (const { s } of ranked) {
    const sid = String(s.id)
    if (seen.has(sid)) continue
    seen.add(sid)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

/**
 * 상세 모달 상단 안내 한 줄
 */
export function describeComplementaryIntro(current, market = {}) {
  const mt = String(market.marketType ?? '')
  const curProf = String(current?.profileLabel ?? '')
  const curType = String(current?.typeLabel ?? '')

  if (curProf === '공격형') {
    return '이 전략은 공격적인 편이라 안정형 전략과 함께 보는 것이 좋습니다.'
  }
  if (mt === 'range' || mt === 'trend_down') {
    return '현재 시장에서는 단타형·보수형 전략과 조합해 보는 것이 더 적합할 수 있습니다.'
  }
  if (curType === '추세형') {
    return '추세형은 단기 대응 전략과 함께 보면 진입 타이밍을 나눠 볼 수 있습니다.'
  }
  return '성격이 다른 전략을 함께 보면 분산 관점을 갖기에 유리할 수 있습니다.'
}

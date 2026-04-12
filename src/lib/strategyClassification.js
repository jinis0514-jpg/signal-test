/**
 * 전략 분류 — 타입(운용) vs 성향(투자자) 분리
 * 수동 필드(typeKey, profileKey) 우선, 없으면 메타·성과 기반 추정
 */

export const ARCHETYPE_LABEL = {
  trend: '추세형',
  counter: '역추세형',
  scalping: '단타형',
  swing: '스윙형',
  breakout: '돌파형',
  pullback: '눌림매수형',
  range_box: '박스권형',
}

export const PROFILE_LABEL = {
  beginner: '초보 추천',
  stable: '안정형',
  aggressive: '공격형',
  observer: '관찰형',
  expert: '숙련자용',
}

/** mock `type` 필드 → archetype key */
const LEGACY_TYPE_TO_ARCHETYPE = {
  trend: 'trend',
  range: 'range_box',
  breakout: 'breakout',
  mean_reversion: 'counter',
  seasonal: 'swing',
  divergence: 'counter',
}

export function parseAvgHoldingHours(v) {
  if (v == null) return null
  if (Number.isFinite(Number(v))) return Number(v)
  const s = String(v).trim()
  const h = s.match(/([\d.]+)\s*시간/)
  if (h) return Number(h[1])
  const d = s.match(/([\d.]+)\s*일/)
  if (d) return Number(d[1]) * 24
  return null
}

function inferArchetypeKey(raw, metrics) {
  const explicit = String(raw.typeKey ?? '').trim()
  if (explicit && Object.prototype.hasOwnProperty.call(ARCHETYPE_LABEL, explicit)) return explicit

  const hrs = metrics.avgHoldingHours
  if (hrs != null && hrs <= 4) return 'scalping'
  if (hrs != null && hrs > 48) return 'swing'

  const legacy = String(raw.type ?? '').trim()
  if (LEGACY_TYPE_TO_ARCHETYPE[legacy]) return LEGACY_TYPE_TO_ARCHETYPE[legacy]

  const wr = metrics.winRate ?? 0
  const tc = metrics.tradeCount ?? 0
  if (tc >= 80 && Math.abs(wr - 55) < 20) return 'scalping'

  return 'trend'
}

function inferProfileKey(raw, metrics) {
  const explicit = String(raw.profileKey ?? '').trim()
  if (explicit && Object.prototype.hasOwnProperty.call(PROFILE_LABEL, explicit)) return explicit

  const diff = String(raw.difficulty ?? raw.difficulty_level ?? '').toLowerCase()
  if (diff === 'beginner' || diff === '초급') return 'beginner'
  if (diff === 'advanced' || diff === 'expert' || diff === '고급') return 'expert'
  if (diff === 'intermediate' || diff === '중급') return 'stable'

  const mdd = Math.abs(Number(metrics.maxDrawdown) || 0)
  const wr = Number(metrics.winRate) || 0
  const ret = Number(metrics.totalReturnPct) || 0
  const tc = Number(metrics.tradeCount) || 0

  if (mdd <= 12 && wr >= 58 && tc >= 30) return 'stable'
  if (mdd >= 22 || (ret >= 40 && mdd >= 16)) return 'aggressive'
  if (tc < 25 && mdd >= 14) return 'observer'
  if (wr >= 52 && mdd <= 16) return 'beginner'
  return 'stable'
}

function buildProfileSummaryLine(typeKey, profileKey) {
  const t = ARCHETYPE_LABEL[typeKey] ?? '이 전략'
  const p = PROFILE_LABEL[profileKey] ?? '일반'

  const tail = (() => {
    if (profileKey === 'beginner') return '절차를 단순히 유지하려는 성격입니다.'
    if (profileKey === 'stable') return '낙폭을 의식한 운용에 맞는 성격입니다.'
    if (profileKey === 'aggressive') return '수익·변동 모두 크게 나올 수 있는 성격입니다.'
    if (profileKey === 'observer') return '표본·신호를 더 본 뒤 판단하는 편이 맞습니다.'
    if (profileKey === 'expert') return '규칙·리스크를 스스로 조절할 수 있을 때 맞습니다.'
    return '시장·시그널을 함께 확인해 선택하세요.'
  })()

  return `${t} 계열이며, ${p} 성향에 가깝습니다. ${tail}`
}

/**
 * @param {object} raw — DB·mock 전략 객체
 * @param {object} metrics — totalReturnPct, winRate, tradeCount, maxDrawdown, avgHoldingHours
 */
export function resolveStrategyClassification(raw = {}, metrics = {}) {
  const avgHoldingHours =
    metrics.avgHoldingHours != null
      ? metrics.avgHoldingHours
      : parseAvgHoldingHours(raw.avgHolding)

  const m = {
    totalReturnPct: metrics.totalReturnPct,
    winRate: metrics.winRate,
    tradeCount: metrics.tradeCount,
    maxDrawdown: metrics.maxDrawdown,
    avgHoldingHours,
  }

  const typeKey = inferArchetypeKey(raw, m)
  const typeLabel = raw.typeKey
    ? (String(raw.typeLabel ?? '').trim() || ARCHETYPE_LABEL[typeKey] || '추세형')
    : (ARCHETYPE_LABEL[typeKey] ?? '추세형')

  const profileKey = inferProfileKey(raw, m)
  const profileLabel = raw.profileKey
    ? (String(raw.profileLabel ?? '').trim() || PROFILE_LABEL[profileKey] || '안정형')
    : (PROFILE_LABEL[profileKey] ?? '안정형')

  const profileSummary = String(raw.profileSummary ?? '').trim()
    || buildProfileSummaryLine(typeKey, profileKey)

  return {
    typeKey,
    typeLabel,
    profileKey,
    profileLabel,
    profileSummary,
  }
}

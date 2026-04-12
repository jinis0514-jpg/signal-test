/**
 * 마켓 전략 정규화 · 추천 점수 · 배지
 */

import { computeStrategyStatus, TRUST_LEVEL } from './strategyTrust'
import { resolveStrategyClassification, parseAvgHoldingHours } from './strategyClassification'

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

const NEW_MS = 14 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function toMarketStateLabel(v) {
  const s = String(v ?? '').toLowerCase()
  if (s.includes('횡보') || s.includes('range')) return '횡보'
  if (s.includes('상승') || s.includes('bull') || s.includes('up')) return '상승'
  if (s.includes('하락') || s.includes('bear') || s.includes('down')) return '하락'
  return '횡보'
}

export function computeTrustScore(raw = {}, perf = {}) {
  const badge = String(raw?.verified_badge_level ?? '')
  const matchRate = Number(raw?.match_rate ?? raw?.verification_summary?.match_rate ?? 0)
  const livePerf = Number(raw?.recentRoi30d ?? raw?.roi30d ?? perf?.recentRoi30d ?? 0)

  let score = 35
  if (badge === 'trade_verified') score += 35
  else if (badge === 'live_verified') score += 20
  else score += 8

  const mr = Number.isFinite(matchRate) ? clamp(matchRate, 0, 100) : 0
  score += mr * 0.2

  if (Number.isFinite(livePerf)) {
    score += clamp(livePerf, -15, 30) * 0.5
  }
  return Math.round(clamp(score, 0, 100))
}

function buildOneLineSummary(raw, { totalReturnPct, maxDrawdown, winRate }) {
  if (typeof raw?.summary === 'string' && raw.summary.trim()) return raw.summary.trim()
  const market = toMarketStateLabel(raw?.market_condition)
  const style = totalReturnPct >= 20 ? '공격형' : maxDrawdown <= 15 ? '안정형' : winRate >= 55 ? '균형형' : '추세 대응형'
  return `이 전략은 ${market} 시장에 맞춘 ${style} 전략입니다`
}

function deriveStrategyTypeLabel({ totalReturnPct, maxDrawdown, tradeCount, recentRoi7d }) {
  const mdd = Math.abs(Number(maxDrawdown) || 0)
  const ret = Number(totalReturnPct) || 0
  const tc = Number(tradeCount) || 0
  const r7 = Number(recentRoi7d) || 0
  if (mdd <= 12 && tc >= 40) return '안정형'
  if (ret >= 25 && mdd >= 18) return '공격형'
  if (tc >= 80 && Math.abs(r7) <= 4) return '단타형'
  return '추세형'
}

/**
 * 최근 N일 성과(%) — 엔진 거래 기록 + backtest_meta 기준.
 * - bt.endTime이 있으면 그 시점을 "현재"로 간주 (재현 가능한 검증 구조와 일관)
 * - 없으면 trades의 마지막 exitTime을 사용
 * - 기간 내 종료된 거래만 누적
 */
export function computeRecentRoiPct(trades, backtestMeta, days = 7) {
  const list = Array.isArray(trades) ? trades : []
  if (list.length === 0) return null
  const bt = backtestMeta && typeof backtestMeta === 'object' ? backtestMeta : {}
  const end =
    Number.isFinite(Number(bt.endTime)) ? Number(bt.endTime)
      : (() => {
          const last = [...list].reverse().find((t) => Number.isFinite(Number(t?.exitTime)))
          return last ? Number(last.exitTime) : NaN
        })()
  if (!Number.isFinite(end)) return null
  const d = clamp(Number(days) || 7, 1, 90)
  const from = end - d * DAY_MS

  let eq = 100
  let any = false
  for (const t of list) {
    const xt = Number(t?.exitTime)
    if (!Number.isFinite(xt)) continue
    if (xt < from || xt > end) continue
    const pnl = Number(t?.pnl)
    if (!Number.isFinite(pnl)) continue
    any = true
    eq *= 1 + pnl / 100
  }
  if (!any) return 0
  return +(eq - 100).toFixed(2)
}

/**
 * 추천 점수 (가중 합산, 높을수록 우선)
 */
/** 검증 상태(정상/주의/위험) → 마켓 카드용 안정/보통/위험 */
export function mapTrustToRiskLevelMarket(trustLabel) {
  if (trustLabel === TRUST_LEVEL.DANGER) return '위험'
  if (trustLabel === TRUST_LEVEL.CAUTION) return '보통'
  return '안정'
}

/**
 * 월 구독가(원). DB·performance에 없으면 id 기반 결정적 플레이스홀더(판매자별 상이 UI).
 */
export function deriveMonthlyPriceKrw(raw, perf = {}) {
  const candidates = [
    raw?.monthly_price_krw,
    raw?.monthlyPriceKrw,
    perf?.monthly_price_krw,
    perf?.monthlyPriceKrw,
    raw?.monthly_price,
    perf?.monthly_price,
    raw?.price,
  ]
  for (const c of candidates) {
    if (c != null && Number.isFinite(Number(c)) && Number(c) > 0) {
      return Math.round(Number(c))
    }
  }
  const id = String(raw?.id ?? 'default')
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const tiers = [9900, 12900, 14900, 19900, 24900, 29900, 39000, 49000]
  return tiers[h % tiers.length]
}

export function computeRecommendationScore({
  totalReturnPct = 0,
  winRate = 0,
  tradeCount = 0,
  maxDrawdown = 0,
}) {
  const tc = Math.min(safeNum(tradeCount, 0), 50)
  const mdd = Math.abs(safeNum(maxDrawdown, 0))
  return (
    safeNum(totalReturnPct, 0) * 0.4
    + safeNum(winRate, 0) * 0.3
    + tc * 0.1
    - mdd * 0.2
  )
}

/**
 * DB 행·mock 객체 → 마켓용 통일 필드
 */
export function normalizeMarketStrategy(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      name: '',
      totalReturnPct: 0,
      winRate: 0,
      tradeCount: 0,
      maxDrawdown: 0,
      updatedAt: Date.now(),
      recommendationScore: 0,
      roi: 0,
      trades: 0,
      mdd: 0,
      trustBadges: [],
      monthlyPriceKrw: 0,
      monthly_price: 0,
      riskLevelMarket: '보통',
      typeKey: 'trend',
      typeLabel: '추세형',
      profileKey: 'stable',
      profileLabel: '안정형',
      profileSummary: '',
      strategyTypeLabel: '추세형',
    }
  }

  let perf = {}
  if (raw.performance && typeof raw.performance === 'object') {
    perf = raw.performance
  } else if (typeof raw.performance === 'string' && raw.performance.trim()) {
    try {
      perf = JSON.parse(raw.performance)
    } catch {
      perf = {}
    }
  }

  const totalReturnPct = safeNum(
    perf.totalReturnPct ?? raw.totalReturnPct ?? raw.roi,
    0,
  )
  const winRate = safeNum(perf.winRate ?? raw.winRate, 0)
  const tradeCount = Math.max(
    0,
    Math.floor(safeNum(perf.tradeCount ?? raw.tradeCount ?? raw.trades, 0)),
  )
  const maxDrawdown = Math.abs(safeNum(perf.maxDrawdown ?? raw.maxDrawdown ?? raw.mdd, 0))

  let updatedAt = Date.now()
  if (raw.updated_at) {
    const t = Date.parse(raw.updated_at)
    if (Number.isFinite(t)) updatedAt = t
  } else if (raw.updatedAt != null) {
    updatedAt = safeNum(raw.updatedAt, updatedAt)
  } else if (raw.createdAt != null) {
    const t = typeof raw.createdAt === 'string' ? Date.parse(raw.createdAt) : safeNum(raw.createdAt, NaN)
    if (Number.isFinite(t)) updatedAt = t
  }

  const recommendationScore = computeRecommendationScore({
    totalReturnPct,
    winRate,
    tradeCount,
    maxDrawdown,
  })

  const bt = raw.backtest_meta && typeof raw.backtest_meta === 'object'
    ? raw.backtest_meta
    : {}

  // 최근 성과(7일 / 30일): mock의 roi7d/roi30d 우선, 없으면 엔진 거래 기록 기반으로 산출
  const engineTrades = Array.isArray(raw.engine_trades)
    ? raw.engine_trades
    : (Array.isArray(raw.engineTrades) ? raw.engineTrades : null)
  const recentRoi7d =
    raw.roi7d != null && Number.isFinite(Number(raw.roi7d))
      ? Number(raw.roi7d)
      : computeRecentRoiPct(engineTrades, bt, 7)
  const recentRoi30d =
    raw.roi30d != null && Number.isFinite(Number(raw.roi30d))
      ? Number(raw.roi30d)
      : computeRecentRoiPct(engineTrades, bt, 30)

  const authorDisplay =
    (typeof raw.author === 'string' && raw.author.trim())
      ? raw.author.trim()
      : (raw.creator_nickname ?? raw.creator_display_name ?? raw.seller_name ?? '판매자')

  const trustBadges = buildTrustBadges(raw, {
    totalReturnPct,
    maxDrawdown,
    winRate,
  })

  const trustStatus = computeStrategyStatus({
    performance: {
      totalTrades: tradeCount,
      tradeCount,
      mdd: maxDrawdown,
      maxDrawdown,
    },
    backtestMeta: bt,
  })
  const riskLevelMarket = mapTrustToRiskLevelMarket(trustStatus)
  const monthlyPriceKrw = deriveMonthlyPriceKrw(raw, perf)
  const summary = buildOneLineSummary(raw, { totalReturnPct, maxDrawdown, winRate })
  const trustScore = computeTrustScore(
    { ...raw, recentRoi30d, roi30d: recentRoi30d },
    { ...perf, recentRoi30d },
  )

  const styleTypeLabel = deriveStrategyTypeLabel({ totalReturnPct, maxDrawdown, tradeCount, recentRoi7d })
  const classification = resolveStrategyClassification(raw, {
    totalReturnPct,
    winRate,
    tradeCount,
    maxDrawdown,
    avgHoldingHours: parseAvgHoldingHours(raw.avgHolding),
  })

  const methodTypeLabel = String(raw?.type ?? 'signal') === 'method'
    ? (raw?.typeLabel ?? '매매법')
    : null

  return {
    ...raw,
    author: authorDisplay,
    totalReturnPct,
    winRate,
    tradeCount,
    maxDrawdown,
    recentRoi7d,
    recentRoi30d,
    updatedAt,
    recommendationScore,
    roi: totalReturnPct,
    trades: tradeCount,
    mdd: maxDrawdown,
    trustBadges,
    backtest_meta: bt,
    monthlyPriceKrw,
    monthly_price: monthlyPriceKrw,
    riskLevelMarket,
    typeKey: classification.typeKey,
    typeLabel: methodTypeLabel ?? classification.typeLabel,
    profileKey: classification.profileKey,
    profileLabel: classification.profileLabel,
    profileSummary: classification.profileSummary,
    strategyTypeLabel: styleTypeLabel,
    summary,
    trustScore,
  }
}

/**
 * 마켓 신뢰·출처 배지 (남발 방지 — 소수만)
 */
export function buildTrustBadges(raw, perf = {}) {
  const badges = []
  const st = String(raw?.status ?? '')

  if (raw?.isOperator) {
    badges.push({ key: 'operator', label: '운영자 전략', variant: 'success' })
  }
  if (raw?.isMock || raw?.isTestStrategy) {
    badges.push({ key: 'test', label: '테스트 전략', variant: 'default' })
  }
  if (raw?.isDbStrategy && !raw?.isOperator) {
    badges.push({ key: 'seller', label: '판매자 전략', variant: 'info' })
  }
  if (raw?.isDbStrategy && !raw?.isOperator && (st === 'approved' || st === 'published')) {
    badges.push({ key: 'review_ok', label: '검수 통과', variant: 'success' })
  }
  const mdd = Math.abs(safeNum(perf.maxDrawdown ?? raw?.mdd, 0))
  if (mdd >= 35 && !raw?.isOperator) {
    badges.push({ key: 'caution', label: '주의', variant: 'warning' })
  }
  return badges
}

/** 상대 랭킹 없이 임계값 기반 배지 */
function deriveThresholdBadges(s) {
  const badges = []
  const now = Date.now()
  if (now - s.updatedAt <= NEW_MS) {
    badges.push({ key: 'new', label: '신규', variant: 'warning' })
  }
  if (s.totalReturnPct >= 22) {
    badges.push({ key: 'high_return', label: '고수익', variant: 'success' })
  }
  if (s.maxDrawdown <= 14 && s.winRate >= 54 && s.tradeCount >= 5) {
    badges.push({ key: 'stable', label: '안정형', variant: 'default' })
  }
  return badges
}

/**
 * 동일 목록에서 상위 점수군에 `추천` 배지
 */
export function assignMarketBadges(strategies) {
  if (!Array.isArray(strategies) || strategies.length === 0) return strategies

  const avgRoi = strategies.reduce((acc, s) => acc + safeNum(s.totalReturnPct, 0), 0) / Math.max(strategies.length, 1)
  const scores = strategies.map((s) => safeNum(s.recommendationScore, -1e9))
  const sorted = [...scores].sort((a, b) => b - a)
  const k = Math.max(1, Math.ceil(sorted.length * 0.35))
  const threshold = sorted.length ? sorted[Math.min(k - 1, sorted.length - 1)] : 0

  return strategies.map((s) => {
    const base = deriveThresholdBadges(s)
    const list = [...base]
    if (s.recommendationScore >= threshold && s.recommendationScore > -1e8) {
      if (!list.some((b) => b.key === 'recommended')) {
        list.unshift({ key: 'recommended', label: '추천', variant: 'info' })
      }
    }
    const sortedRoi = [...strategies]
      .map((x) => safeNum(x.totalReturnPct, 0))
      .sort((a, b) => b - a)
    const idx = sortedRoi.findIndex((r) => r <= safeNum(s.totalReturnPct, 0))
    const rankPct = idx < 0 ? 100 : Math.max(1, Math.round(((idx + 1) / Math.max(sortedRoi.length, 1)) * 100))
    const roiVsAveragePct = +(safeNum(s.totalReturnPct, 0) - avgRoi).toFixed(1)
    const comparisonLine = rankPct <= 10
      ? `상위 10% 전략 · 평균 대비 ${roiVsAveragePct >= 0 ? '+' : ''}${roiVsAveragePct}% 성과`
      : `평균 대비 ${roiVsAveragePct >= 0 ? '+' : ''}${roiVsAveragePct}% 성과`
    return {
      ...s,
      marketBadges: list,
      rankPercentile: rankPct,
      roiVsAveragePct,
      comparisonLine,
    }
  })
}

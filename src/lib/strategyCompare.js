/**
 * 전략 비교 패널용 — 요약 문장, 강조 인덱스, 라이브 상태 표시 톤
 */

import { getStrategyLiveState } from './strategyLiveState'
import { getVerificationBadgeConfig } from './verificationBadge'

function indicesWhereBest(arr, mode = 'max') {
  const entries = arr
    .map((v, i) => ({ v: Number(v), i }))
    .filter((x) => Number.isFinite(x.v))
  if (!entries.length) return new Set()
  const target = mode === 'max'
    ? Math.max(...entries.map((x) => x.v))
    : Math.min(...entries.map((x) => x.v))
  return new Set(entries.filter((x) => x.v === target).map((x) => x.i))
}

/**
 * @param {object[]} strategies
 * @returns {{
 *   bestRoi: Set<number>,
 *   bestWin: Set<number>,
 *   lowestMdd: Set<number>,
 *   bestMatch: Set<number>,
 *   worstMdd: Set<number>,
 * }}
 */
export function compareMetricIndices(strategies) {
  const rois = strategies.map((s) => Number(s.totalReturnPct ?? s.roi))
  const wins = strategies.map((s) => Number(s.winRate))
  const mdds = strategies.map((s) => {
    const v = Number(s.maxDrawdown ?? s.mdd)
    return Number.isFinite(v) ? Math.abs(v) : NaN
  })
  const matches = strategies.map((s) => {
    const m = Number(s.matchRate ?? s.match_rate)
    return Number.isFinite(m) ? m : NaN
  })
  const lowestMdd = indicesWhereBest(mdds, 'min')
  const worstMdd = indicesWhereBest(mdds, 'max')
  return {
    bestRoi: indicesWhereBest(rois, 'max'),
    bestWin: indicesWhereBest(wins, 'max'),
    lowestMdd,
    bestMatch: indicesWhereBest(matches, 'max'),
    worstMdd,
  }
}

export function formatCompareRoiText(s) {
  const n = Number(s.totalReturnPct ?? s.roi)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function formatCompareMddText(s) {
  const v = Number(s.maxDrawdown ?? s.mdd)
  if (!Number.isFinite(v)) return '—'
  return `-${Math.abs(v).toFixed(1)}%`
}

export function formatCompareWinText(s) {
  const w = Number(s.winRate)
  if (!Number.isFinite(w)) return '—'
  return `${w.toFixed(1)}%`
}

export function formatCompareMatchText(s) {
  const m = Number(s.matchRate ?? s.match_rate)
  if (!Number.isFinite(m)) return '—'
  return `${Math.round(m)}%`
}

export function formatCompareTradesText(s) {
  const t = Number(s.tradeCount ?? s.trades)
  if (!Number.isFinite(t)) return '—'
  return `${Math.round(t)}회`
}

export function formatRecentPerformanceText(s) {
  const r = Number(s.recentRoi7d ?? s.roi7d)
  if (!Number.isFinite(r)) return '—'
  return `${r >= 0 ? '+' : ''}${r.toFixed(1)}% (7일)`
}

/** 리스크·적합 한 줄 (표시용) */
export function formatRiskSummaryLine(s) {
  const fit = String(s.fitSummary ?? s.market_condition ?? '').trim()
  const risk = String(s.risk_description ?? '').trim()
  if (fit && risk) {
    const combined = `${fit} · ${risk}`
    return combined.length > 72 ? `${combined.slice(0, 71)}…` : combined
  }
  return fit || risk || '—'
}

export function verificationCompareMeta(level) {
  const cfg = getVerificationBadgeConfig(level)
  const rank = cfg.rank ?? 0
  let tone = 'muted'
  if (rank >= 2) tone = 'verified'
  else if (rank === 1) tone = 'live'
  return { label: cfg.label, shortLabel: cfg.shortLabel, tone }
}

/**
 * @param {object[]} strategies
 * @returns {string[]}
 */
export function buildPerStrategyCompareLines(strategies) {
  return strategies.map((s) => {
    const live = getStrategyLiveState(s)
    const prof = String(s.profileLabel ?? '—').trim()
    const typ = String(s.typeLabel ?? '—').trim()
    const ret = Number(s.totalReturnPct ?? s.roi)
    const retHint = Number.isFinite(ret) && ret >= 25
      ? '누적 수익률이 높은 편입니다.'
      : Number.isFinite(ret) && ret < 8
        ? '누적 수익은 상대적으로 낮을 수 있습니다.'
        : '성과는 중간대입니다.'
    return `${s.name}: ${typ}·${prof} 성향, 현재 ${live.shortLabel ?? live.label}. ${retHint}`
  })
}

/**
 * @param {object[]} strategies
 * @returns {{ headline: string, sub: string }}
 */
export function buildCompareSummaryCard(strategies) {
  if (!strategies.length) {
    return { headline: '비교할 전략을 선택해 주세요.', sub: '최대 3개까지 고를 수 있습니다.' }
  }
  const byRoi = [...strategies].sort(
    (a, b) => Number(b.totalReturnPct ?? b.roi) - Number(a.totalReturnPct ?? a.roi),
  )
  const byMdd = [...strategies].sort((a, b) => {
    const am = Math.abs(Number(a.maxDrawdown ?? a.mdd ?? NaN))
    const bm = Math.abs(Number(b.maxDrawdown ?? b.mdd ?? NaN))
    return am - bm
  })
  const topRoi = byRoi[0]
  const bestMdd = byMdd[0]
  let headline = ''
  if (strategies.length === 1) {
    headline = `${topRoi.name}의 성격·리스크·신뢰 지표를 한데 모았습니다.`
  } else if (topRoi && bestMdd && topRoi.id !== bestMdd.id) {
    headline = `${topRoi.name}은(는) 누적 수익률이 가장 높고, ${bestMdd.name}은(는) 낙폭(MDD)이 가장 작습니다.`
  } else if (topRoi) {
    headline = `${topRoi.name}이(가) 비교군에서 누적 수익·흐름이 가장 두드러집니다.`
  } else {
    headline = '선택한 전략의 차이를 성격·성과·리스크·신뢰 순으로 확인하세요.'
  }

  const liveFits = strategies.filter((s) => {
    const st = getStrategyLiveState(s)
    return st.suitabilityTone === 'emerald' && String(st.suitabilityLabel ?? '').includes('사용')
  })
  let sub = '아래 표는 같은 순서로 근거를 보여 줍니다.'
  if (liveFits.length === 1) {
    sub = `현재 적합도 메시지상으로는 ${liveFits[0].name}이(가) 운용 가능성이 높게 읽힐 수 있습니다. (참고용)`
  } else if (liveFits.length >= 2) {
    sub = `${liveFits.map((s) => s.name).join(', ')}은(는) 적합도 신호가 비교적 유리해 보입니다. 시장은 변동하므로 MDD·검증 배지를 함께 보세요.`
  }
  return { headline, sub }
}

/**
 * @param {object[]} strategies
 * @returns {string[]}
 */
export function buildCompareActionHints(strategies) {
  const out = []
  if (!strategies.length) return out

  const byMdd = [...strategies].sort((a, b) => {
    const am = Math.abs(Number(a.maxDrawdown ?? a.mdd ?? NaN))
    const bm = Math.abs(Number(b.maxDrawdown ?? b.mdd ?? NaN))
    return am - bm
  })
  const byRoi = [...strategies].sort(
    (a, b) => Number(b.totalReturnPct ?? b.roi) - Number(a.totalReturnPct ?? a.roi),
  )
  const beginners = strategies.filter((s) => {
    const p = String(s.profileLabel ?? s.profileKey ?? '')
    return /초보|보수|안정/i.test(p)
  })

  if (byMdd[0]) {
    out.push(`낙폭을 작게 가져가려면 ${byMdd[0].name}을(를) 우선 참고할 수 있습니다.`)
  }
  if (byRoi[0]) {
    out.push(`누적 수익률을 우선하면 ${byRoi[0].name}이(가) 상대적으로 유리해 보입니다.`)
  }
  if (beginners.length) {
    out.push(`보수·안정 쪽 성향을 원하면 ${beginners.map((s) => s.name).join(' 또는 ')}을(를) 살펴보세요.`)
  }
  return out.slice(0, 3)
}

export function liveStateCellClassName(strategy) {
  const st = getStrategyLiveState(strategy)
  if (st.kind === 'long_open') return 'text-emerald-600 dark:text-emerald-400'
  if (st.kind === 'short_open') return 'text-red-600 dark:text-red-400'
  if (st.kind === 'recent_exit') return 'text-amber-600 dark:text-amber-400'
  if (st.kind === 'wait') return 'text-slate-600 dark:text-slate-300'
  return 'text-slate-500 dark:text-slate-400'
}

/**
 * ValidationPage용: 기간 필터 · 누적 곡선 · 월별 손익 · 확장 지표
 */

/** @param {{ time: number }[]} candles */
export function filterCandlesByPeriod(candles, periodKey, referenceTime) {
  if (!Array.isArray(candles) || candles.length === 0) return []
  const last = referenceTime ?? candles[candles.length - 1].time
  const y = new Date(last).getFullYear()

  const startOfYear = new Date(y, 0, 1).getTime()

  const ms = {
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000,
    'YTD': null,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    '3Y': 3 * 365 * 24 * 60 * 60 * 1000,
    'ALL': 0,
  }

  let start = 0
  if (periodKey === 'YTD') {
    start = startOfYear
  } else if (ms[periodKey] != null) {
    start = last - ms[periodKey]
  }

  return candles.filter((c) => c.time >= start)
}

/** strategyEngine 거래 → 누적 수익률(%) 곡선 (시작 0%) */
export function buildEquitySeriesFromTrades(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return [0, 0]
  let equity = 100
  const pts = [0]
  for (const t of trades) {
    const p = Number(t.pnl)
    if (!Number.isFinite(p)) continue
    equity *= 1 + p / 100
    pts.push(+(equity - 100).toFixed(4))
  }
  return pts
}

export function buildEquityXLabels(length) {
  if (length < 2) return []
  const n = length - 1
  const idxs = [
    0,
    Math.floor(n * 0.25),
    Math.floor(n * 0.5),
    Math.floor(n * 0.75),
    n,
  ]
  const unique = [...new Set(idxs)].sort((a, b) => a - b)
  const labels = ['시작', '25%', '50%', '75%', '끝']
  return unique.map((idx, i) => ({ idx, label: labels[Math.min(i, labels.length - 1)] }))
}

/** 거래 청산 시각 기준 누적 손익% 타임라인 */
export function buildEquityTimelineFromTrades(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return []
  let equity = 100
  const firstT = trades[0].entryTime ?? trades[0].exitTime ?? Date.now()
  const pts = [{ t: firstT, eq: 0 }]
  for (const tr of trades) {
    const p = Number(tr.pnl)
    if (!Number.isFinite(p)) continue
    equity *= 1 + p / 100
    pts.push({ t: tr.exitTime, eq: +(equity - 100).toFixed(4) })
  }
  return pts
}

const PRESET_MS = {
  week: 7 * 86400000,
  month: 30 * 86400000,
  year: 365 * 86400000,
}

/**
 * 기준 시각 기준 구간 필터 (주/월/년) — 포인트가 너무 적으면 전체 유지
 * @param {'week'|'month'|'year'|'all'} preset
 */
export function filterEquityTimelineByPreset(pts, preset, refTime) {
  if (!pts.length || preset === 'all') return pts
  const end = refTime ?? pts[pts.length - 1].t
  const win = PRESET_MS[preset]
  if (win == null) return pts
  const start = end - win
  const filtered = pts.filter((p) => p.t >= start)
  return filtered.length >= 2 ? filtered : pts
}

function fmtAxisLabel(ms) {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 타임라인에 맞춘 x축 라벨 (인덱스 정렬) */
export function buildEquityXLabelsFromTimeline(eqValues, timelinePts) {
  const n = eqValues.length
  if (n < 2 || !timelinePts?.length) return buildEquityXLabels(n)
  const last = Math.min(n, timelinePts.length) - 1
  if (last < 1) return buildEquityXLabels(n)
  const idxs = [
    0,
    Math.floor(last * 0.25),
    Math.floor(last * 0.5),
    Math.floor(last * 0.75),
    last,
  ]
  const unique = [...new Set(idxs)].filter((i) => i >= 0 && i <= last).sort((a, b) => a - b)
  return unique.map((idx) => ({
    idx,
    label: timelinePts[idx] ? fmtAxisLabel(timelinePts[idx].t) : String(idx),
  }))
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** exit 시각 기준 월별 합산 PnL% (최근 12개 월 버킷) */
export function monthlyPnLFromTrades(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return [{ label: '—', value: 0 }]
  }
  const map = new Map()
  for (const t of trades) {
    const d = new Date(t.exitTime)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + Number(t.pnl))
  }
  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  const last12 = sorted.slice(-12)
  return last12.map(([key, v]) => {
    const month = Number(key.split('-')[1])
    return {
      label: MONTH_SHORT[month] ?? key,
      value: +v.toFixed(2),
    }
  })
}

export function extendedPerf(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpe: 0,
    }
  }
  const pnls = trades.map((t) => Number(t.pnl)).filter((p) => Number.isFinite(p))
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0
  const gp = wins.reduce((a, b) => a + b, 0)
  const gl = Math.abs(losses.reduce((a, b) => a + b, 0))
  let profitFactor = 0
  if (gl > 1e-9) profitFactor = +(gp / gl).toFixed(2)
  else if (gp > 0) profitFactor = 99

  const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length
  const variance =
    pnls.length > 1
      ? pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnls.length - 1)
      : 0
  const sd = Math.sqrt(variance) || 1e-9
  const sharpe = +(mean / sd * Math.sqrt(Math.min(pnls.length, 252))).toFixed(2)

  return {
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    profitFactor,
    sharpe,
  }
}

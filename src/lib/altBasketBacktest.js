/**
 * 복수 USDT 심볼 백테스트 — 성과 지표 단순 평균 (ALT 바스켓 검증용)
 */
import { getCachedKlines } from './priceCache'
import { runStrategy } from './runStrategy'
import { filterCandlesByPeriod } from './validationMetrics'
import { computeRecentRoiPct } from './marketStrategy'
import { formatDispersionLabel } from './assetValidationUniverse'
import { buildAltValidationResult } from './altValidationPresentation'

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/**
 * @param {Array<{ pair: string, perf?: object }>} perSymbol
 */
function buildBasketDetail(perSymbol) {
  if (!Array.isArray(perSymbol) || !perSymbol.length) return null

  const rows = perSymbol.map((x) => ({
    pair: x.pair,
    roi: safeNum(x.perf?.roi),
    mdd: safeNum(x.perf?.mdd),
    winRate: safeNum(x.perf?.winRate),
    totalTrades: Math.round(safeNum(x.perf?.totalTrades)),
  }))

  const rois = rows.map((r) => r.roi)
  const meanRoi = rois.reduce((s, r) => s + r, 0) / rois.length
  let roiStd = 0
  if (rois.length >= 2) {
    const v = rois.reduce((s, r) => s + (r - meanRoi) ** 2, 0) / rois.length
    roiStd = Math.sqrt(v)
  }

  let dispersion = 'medium'
  if (rois.length < 2) dispersion = 'low'
  else if (roiStd < 8) dispersion = 'low'
  else if (roiStd < 20) dispersion = 'medium'
  else dispersion = 'high'

  const byRoi = [...rows].sort((a, b) => b.roi - a.roi)
  const best = byRoi[0]
  const worst = byRoi[byRoi.length - 1]

  return {
    pairs: rows.map((r) => r.pair),
    perCoin: rows,
    meanRoi,
    best,
    worst,
    roiStd: +roiStd.toFixed(4),
    dispersion,
    dispersionLabel: formatDispersionLabel(dispersion),
  }
}

/**
 * @param {object} opts
 * @param {string[]} opts.pairs
 * @param {string} opts.interval
 * @param {number} opts.limit
 * @param {string|null} opts.period 검증 페이지 기간 키; null이면 캔들 전체 구간
 * @param {(aligned: object[], pairSymbol: string) => [strategyLike: object|null, options: object]} opts.makeRunStrategyArgs
 */
export async function runAggregatedValidationForPairs({
  pairs,
  interval,
  limit,
  period,
  makeRunStrategyArgs,
}) {
  if (!Array.isArray(pairs) || pairs.length === 0 || typeof makeRunStrategyArgs !== 'function') {
    return {
      primaryCandles: [],
      primaryPipe: null,
      averagedPerf: { roi: 0, winRate: 0, mdd: 0, totalTrades: 0 },
      recent7dAvg: 0,
      recent30dAvg: 0,
      perSymbol: [],
      basketDetail: null,
      validationResult: null,
    }
  }

  const perSymbol = []
  let primaryCandles = []
  let primaryPipe = null

  for (let i = 0; i < pairs.length; i += 1) {
    const sym = pairs[i]
    const candles = await getCachedKlines(sym, interval, limit)
    if (i === 0) primaryCandles = candles

    const ref = candles.length ? candles[candles.length - 1].time : Date.now()
    const aligned =
      period == null ? candles : filterCandlesByPeriod(candles, period, ref)

    const [strategyLike, options] = makeRunStrategyArgs(aligned, sym)
    let pipe = null
    try {
      if (aligned.length > 0) {
        pipe = runStrategy(aligned, strategyLike ?? null, options ?? {})
      }
    } catch {
      pipe = null
    }
    if (!pipe) continue

    const perf = pipe.performance ?? {}
    const trades = Array.isArray(pipe.trades) ? pipe.trades : []
    const endT = aligned.length ? aligned[aligned.length - 1].time : ref
    const recent7d = computeRecentRoiPct(trades, { endTime: endT }, 7)
    const recent30d = computeRecentRoiPct(trades, { endTime: endT }, 30)

    perSymbol.push({
      pair: sym,
      perf,
      trades,
      recent7d: recent7d ?? 0,
      recent30d: recent30d ?? 0,
      pipe,
      aligned,
    })

    if (i === 0) primaryPipe = pipe
  }

  if (!perSymbol.length) {
    return {
      primaryCandles,
      primaryPipe: null,
      averagedPerf: { roi: 0, winRate: 0, mdd: 0, totalTrades: 0 },
      recent7dAvg: 0,
      recent30dAvg: 0,
      perSymbol: [],
      basketDetail: null,
      validationResult: null,
    }
  }

  const n = perSymbol.length
  const averagedPerf = {
    roi: perSymbol.reduce((s, x) => s + safeNum(x.perf?.roi), 0) / n,
    winRate: perSymbol.reduce((s, x) => s + safeNum(x.perf?.winRate), 0) / n,
    mdd: perSymbol.reduce((s, x) => s + safeNum(x.perf?.mdd), 0) / n,
    totalTrades: Math.round(
      perSymbol.reduce((s, x) => s + safeNum(x.perf?.totalTrades), 0) / n,
    ),
  }
  const recent7dAvg =
    perSymbol.reduce((s, x) => s + safeNum(x.recent7d), 0) / n
  const recent30dAvg =
    perSymbol.reduce((s, x) => s + safeNum(x.recent30d), 0) / n

  const basketDetail = buildBasketDetail(perSymbol)
  const validationResult = buildAltValidationResult(averagedPerf, basketDetail)

  return {
    primaryCandles,
    primaryPipe,
    averagedPerf,
    recent7dAvg,
    recent30dAvg,
    perSymbol,
    basketDetail,
    validationResult,
  }
}

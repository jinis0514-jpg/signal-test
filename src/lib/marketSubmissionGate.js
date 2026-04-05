/**
 * 마켓 제출 1차: 캔들 조회 + 엔진 백테스트 + validateStrategyForSubmission
 */
import { getCachedKlines } from './priceCache'
import { normalizeStrategyPayload } from './strategyPayload'
import { runStrategy } from './runStrategy'
import { validateStrategyForSubmission } from './strategySubmissionValidation'

export {
  MIN_MARKET_TRADES,
  MIN_MARKET_PERIOD_DAYS,
  MAX_MARKET_MDD_BLOCK,
  WARN_MARKET_MDD_PCT,
} from './strategySubmissionValidation'

const MIN_CANDLES_FETCH = 80

function klineBaseFromAsset(raw) {
  const a = String(raw || '').trim().toUpperCase()
  if (a === 'ALT') return 'ETH'
  return a || 'BTC'
}

function intervalFromTimeframe(tf) {
  const t = String(tf || '').trim().toLowerCase()
  if (['1m', '5m', '15m', '1h', '4h', '1d'].includes(t)) return t
  return '1h'
}

/**
 * @returns {Promise<{
 *   isValid: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   performance?: object,
 * }>}
 */
export async function runMarketSubmissionCheck(strategyPayload) {
  const p = normalizeStrategyPayload(strategyPayload ?? {})
  if (String(p.type ?? 'signal') === 'method') {
    const v = validateStrategyForSubmission(p, { hasBacktest: true })
    return {
      isValid: v.isValid,
      errors: v.errors,
      warnings: v.warnings,
      performance: undefined,
      backtestMeta: null,
    }
  }
  const base = klineBaseFromAsset(p.asset)
  const interval = intervalFromTimeframe(p.timeframe)
  const limit = 1000

  let candles
  try {
    candles = await getCachedKlines(base, interval, limit)
  } catch (e) {
    return {
      isValid: false,
      errors: [`가격 데이터를 불러올 수 없습니다. ${e?.message ? String(e.message) : ''}`.trim()],
      warnings: [],
    }
  }

  if (!Array.isArray(candles) || candles.length < MIN_CANDLES_FETCH) {
    return {
      isValid: false,
      errors: [`캔들 데이터가 부족합니다. (최소 ${MIN_CANDLES_FETCH}봉 필요)`],
      warnings: [],
    }
  }

  const first = candles[0]?.time
  const last = candles[candles.length - 1]?.time
  const periodDays = Number.isFinite(first) && Number.isFinite(last)
    ? (last - first) / 86400000
    : 0
  const backtestMeta = {
    startTime: Number.isFinite(first) ? first : null,
    endTime: Number.isFinite(last) ? last : null,
    timeframe: interval,
    candleCount: candles.length,
    periodDays,
    dataSource: 'binance_klines',
  }

  let pipe
  try {
    pipe = runStrategy(candles, p, {})
  } catch (e) {
    return {
      isValid: false,
      errors: [`전략 평가 실패: ${e?.message ? String(e.message) : '알 수 없는 오류'}`],
      warnings: [],
    }
  }

  const perf = pipe.performance
  const backtestResult = {
    totalTrades: perf.totalTrades,
    mdd: perf.mdd,
    winRate: perf.winRate,
    roi: perf.roi,
    periodDays,
    candleCount: candles.length,
    hasBacktest: true,
  }

  const v = validateStrategyForSubmission(p, backtestResult)
  return {
    isValid: v.isValid,
    errors: v.errors,
    warnings: v.warnings,
    performance: perf,
    trades: pipe.trades,
    backtestMeta,
  }
}

/** @deprecated runMarketSubmissionCheck 사용 */
export async function runMarketSubmissionGate(strategyPayload) {
  const r = await runMarketSubmissionCheck(strategyPayload)
  if (r.isValid) {
    return { ok: true, performance: r.performance }
  }
  return {
    ok: false,
    reason: r.errors[0] ?? '제출 조건을 불만족합니다.',
    detail: r.errors.length > 1 ? r.errors.slice(1).join('; ') : undefined,
  }
}

/**
 * 마켓 제출 1차: 캔들 조회 + 엔진 백테스트 + validateStrategyForSubmission
 */
import { getCachedKlines } from './priceCache'
import { normalizeStrategyPayload } from './strategyPayload'
import { runStrategy } from './runStrategy'
import { validateStrategyForSubmission } from './strategySubmissionValidation'
import { resolveAltValidationPairs, getAssetClassFromStrategy } from './assetValidationUniverse'
import { runAggregatedValidationForPairs } from './altBasketBacktest'
import { buildAltValidationResult } from './altValidationPresentation'

export {
  MIN_MARKET_TRADES,
  MIN_MARKET_PERIOD_DAYS,
  MAX_MARKET_MDD_BLOCK,
  WARN_MARKET_MDD_PCT,
} from './strategySubmissionValidation'

const MIN_CANDLES_FETCH = 80

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
  const assetClass = getAssetClassFromStrategy(p)
  const { pairs: validationPairs, error: pairsError } = resolveAltValidationPairs(p)
  if (pairsError) {
    return {
      isValid: false,
      errors: [pairsError],
      warnings: [],
      performance: undefined,
      backtestMeta: null,
      altBasketAggregated: false,
      basketDetail: null,
      validationResult: null,
    }
  }
  if (!Array.isArray(validationPairs) || validationPairs.length === 0) {
    return {
      isValid: false,
      errors: ['검증용 심볼을 확인할 수 없습니다.'],
      warnings: [],
      performance: undefined,
      backtestMeta: null,
      altBasketAggregated: false,
      basketDetail: null,
      validationResult: null,
    }
  }

  const interval = intervalFromTimeframe(p.timeframe)
  const limit = 1000

  const isAltBasket = validationPairs.length > 1

  let candles
  let pipe
  let perf
  let recentRoi7dOverride = null
  let recentRoi30dOverride = null
  let basketDetail = null
  let validationResult = null

  try {
    if (isAltBasket) {
      const agg = await runAggregatedValidationForPairs({
        pairs: validationPairs,
        interval,
        limit,
        period: null,
        makeRunStrategyArgs: () => [p, {}], // pair 무관 동일 페이로드
      })
      basketDetail = agg.basketDetail ?? null
      validationResult = agg.validationResult ?? buildAltValidationResult(agg.averagedPerf, basketDetail)
      candles = agg.primaryCandles
      if (!Array.isArray(candles) || candles.length < MIN_CANDLES_FETCH) {
        return {
          isValid: false,
          errors: [`ALT 바스켓 캔들 데이터가 부족합니다. (최소 ${MIN_CANDLES_FETCH}봉 필요)`],
          warnings: [],
        }
      }
      pipe = agg.primaryPipe
      perf = {
        ...agg.averagedPerf,
        totalTrades: agg.averagedPerf.totalTrades,
      }
      recentRoi7dOverride = agg.recent7dAvg
      recentRoi30dOverride = agg.recent30dAvg
      if (!agg.perSymbol.length) {
        return {
          isValid: false,
          errors: ['ALT 바스켓 전략 평가에 실패했습니다.'],
          warnings: [],
        }
      }
    } else {
      candles = await getCachedKlines(validationPairs[0], interval, limit)
      if (!Array.isArray(candles) || candles.length < MIN_CANDLES_FETCH) {
        return {
          isValid: false,
          errors: [`캔들 데이터가 부족합니다. (최소 ${MIN_CANDLES_FETCH}봉 필요)`],
          warnings: [],
        }
      }
      pipe = runStrategy(candles, p, {})
      perf = pipe.performance
    }
  } catch (e) {
    return {
      isValid: false,
      errors: [`가격 데이터 또는 전략 평가 오류. ${e?.message ? String(e.message) : ''}`.trim()],
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
    dataSource: isAltBasket ? 'binance_klines_alt_basket_avg' : 'binance_klines',
    validationPairs: isAltBasket ? validationPairs : undefined,
    basketDetail: isAltBasket ? basketDetail : undefined,
    validationResult: isAltBasket ? validationResult : undefined,
  }

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
    altBasketAggregated: isAltBasket,
    recentRoi7d: recentRoi7dOverride,
    recentRoi30d: recentRoi30dOverride,
    basketDetail: isAltBasket ? basketDetail : null,
    validationResult: isAltBasket ? validationResult : null,
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

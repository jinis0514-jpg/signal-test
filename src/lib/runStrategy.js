/**
 * 캔들 → 시그널 → 거래 → 성과 (단일 파이프라인)
 * 내부적으로 strategyEngine.runEnginePipeline 사용
 */

import {
  runEnginePipeline,
  normalizePrices,
} from './strategyEngine'

export function candlesToPriceSeries(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return []
  return normalizePrices(
    candles.map((c) => ({
      time: c.time,
      price: Number(c.close ?? c.open ?? 0),
    })),
  )
}

const EMPTY_PERF = {
  roi: 0,
  winRate: 0,
  totalTrades: 0,
  mdd: 0,
  tradeCount: 0,
}

/**
 * @param {Array<{time:number, open:number, high:number, low:number, close:number}>} candles
 * @param {object} strategyLike 전략 페이로드 또는 null
 * @param {object} [options] strategyEngine.runEnginePipeline 와 동일
 */
export function runStrategy(candles = [], strategyLike = {}, options = {}) {
  const prices = candlesToPriceSeries(candles)
  if (prices.length === 0) {
    return {
      signals: [],
      trades: [],
      performance: { ...EMPTY_PERF },
      strategyConfig: null,
    }
  }

  const out = runEnginePipeline(prices, strategyLike, {
    ...options,
    candles,
  })

  const p = out.performance ?? EMPTY_PERF
  return {
    signals: out.signals,
    trades: out.trades,
    performance: {
      ...p,
      tradeCount: p.totalTrades ?? 0,
    },
    strategyConfig: out.strategyConfig,
  }
}

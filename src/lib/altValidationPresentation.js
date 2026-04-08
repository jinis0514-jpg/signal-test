/**
 * ALT 바스켓 검증 결과 — UI/전달용 단일 형식
 * (내부 엔진은 basketDetail·averagedPerf 유지, 이 객체는 "확정" 스키마)
 */
import { safeNumber } from './safeValues'

/**
 * @param {{ roi?: number, winRate?: number, mdd?: number, totalTrades?: number }|null} averagedPerf
 * @param {object|null} basketDetail — `altBasketBacktest` 내부 buildBasketDetail 결과
 * @returns {{
 *   average: { roi: number, mdd: number, winRate: number, tradeCount: number },
 *   best: { symbol: string, roi: number, mdd: number, winRate: number },
 *   worst: { symbol: string, roi: number, mdd: number, winRate: number },
 *   perSymbol: Array<{ symbol: string, roi: number, mdd: number, winRate: number, tradeCount: number }>,
 *   varianceLabel: string,
 *   roiStd: number,
 * } | null}
 */
export function buildAltValidationResult(averagedPerf, basketDetail) {
  if (!averagedPerf || !basketDetail || !Array.isArray(basketDetail.perCoin)) return null

  const average = {
    roi: safeNumber(averagedPerf.roi),
    mdd: safeNumber(averagedPerf.mdd),
    winRate: safeNumber(averagedPerf.winRate),
    tradeCount: Math.round(safeNumber(averagedPerf.totalTrades)),
  }

  const perSymbol = basketDetail.perCoin.map((r) => ({
    symbol: safeStringPair(r.pair),
    roi: safeNumber(r.roi),
    mdd: safeNumber(r.mdd),
    winRate: safeNumber(r.winRate),
    tradeCount: Math.round(safeNumber(r.totalTrades)),
  }))

  const bestRow = basketDetail.best ?? {}
  const worstRow = basketDetail.worst ?? {}

  return {
    average,
    best: {
      symbol: safeStringPair(bestRow.pair),
      roi: safeNumber(bestRow.roi),
      mdd: safeNumber(bestRow.mdd),
      winRate: safeNumber(bestRow.winRate),
    },
    worst: {
      symbol: safeStringPair(worstRow.pair),
      roi: safeNumber(worstRow.roi),
      mdd: safeNumber(worstRow.mdd),
      winRate: safeNumber(worstRow.winRate),
    },
    perSymbol,
    varianceLabel: typeof basketDetail.dispersionLabel === 'string'
      ? basketDetail.dispersionLabel
      : '보통',
    roiStd: safeNumber(basketDetail.roiStd),
  }
}

function safeStringPair(v) {
  return typeof v === 'string' ? v : ''
}

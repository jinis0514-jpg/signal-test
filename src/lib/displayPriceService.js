import { get24hrTicker } from './binanceService'
import { getKrwPrice as getUpbitKrwPrice } from './upbitService'
import { getKrwPrice as getBithumbKrwPrice } from './bithumbService'

/**
 * 통합 표시용 가격 (USD: Binance USDT, KRW: Upbit 우선 → 없으면 Bithumb)
 * @param {string} symbol 기준 자산 심볼 (예: BTC, ETH, ARB)
 * @returns {Promise<{ symbol: string, usdPrice: number, krwPrice: number|null, krwSource: 'upbit'|'bithumb'|null, changePercent: number }>}
 */
export async function getDisplayPrice(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) {
    throw new Error('symbol 값이 필요합니다.')
  }

  const ticker = await get24hrTicker(sym)
  const usdPrice = ticker.price
  const changePercent = Number.isFinite(ticker.changePercent) ? ticker.changePercent : 0

  let krwPrice = null
  let krwSource = null

  const up = await getUpbitKrwPrice(sym)
  if (up != null) {
    krwPrice = up
    krwSource = 'upbit'
  } else {
    const bi = await getBithumbKrwPrice(sym)
    if (bi != null) {
      krwPrice = bi
      krwSource = 'bithumb'
    }
  }

  return {
    symbol: sym,
    usdPrice,
    krwPrice,
    krwSource,
    changePercent,
  }
}

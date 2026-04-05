const BASE_URL = 'https://api.binance.com'

/** @param {string} base 예: BTC → BTCUSDT */
export function toUsdtSymbol(base) {
  const b = String(base).trim().toUpperCase()
  if (!b) throw new Error('symbol 값이 필요합니다.')
  if (b.endsWith('USDT')) return b
  return `${b}USDT`
}

export async function getTickerPrice(baseOrPair = 'BTC') {
  const symbol = toUsdtSymbol(baseOrPair)
  const res = await fetch(`${BASE_URL}/api/v3/ticker/price?symbol=${symbol}`)
  if (!res.ok) throw new Error('가격 조회 실패')
  const data = await res.json()
  const price = Number(data?.price)
  if (!Number.isFinite(price)) throw new Error('가격 조회 실패')
  return { symbol: data.symbol ?? symbol, price }
}

export async function get24hrTicker(baseOrPair = 'BTC') {
  const symbol = toUsdtSymbol(baseOrPair)
  const res = await fetch(`${BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`)
  if (!res.ok) throw new Error('24시간 데이터 조회 실패')
  const data = await res.json()
  return {
    symbol: data.symbol,
    price: Number(data.lastPrice),
    changePercent: Number(data.priceChangePercent),
    volume: Number(data.volume),
    quoteVolume: data.quoteVolume != null ? Number(data.quoteVolume) : null,
  }
}

import { fetchBinanceCandles, fetchBinanceCandlesWithFallback } from './marketCandles'

/**
 * Binance REST klines — time은 ms epoch (레거시 호출부 호환).
 * 신규 코드는 marketCandles.fetchBinanceCandles (초 단위) 또는 priceCache.getCachedKlines 사용.
 */
export async function getKlines(baseOrPair = 'BTC', interval = '1h', limit = 100) {
  return fetchBinanceCandlesWithFallback(baseOrPair, interval, limit)
}

/**
 * lightweight-charts 전용: time UTC seconds (기존과 동일).
 */
export async function fetchKlines(symbol = 'BTCUSDT', interval = '1h', limit = 500) {
  return fetchBinanceCandles(symbol, interval, limit)
}

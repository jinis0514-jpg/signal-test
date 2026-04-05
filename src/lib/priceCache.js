/**
 * 가격·캔들 API 전역 캐시 — 페이지 간 중복 fetch 감소
 * 캔들: Binance REST (실패 시 합성 캔들) — time은 Unix ms
 */
import { getDisplayPrice } from './displayPriceService'
import { fetchBinanceCandlesWithFallback } from './marketCandles'

const PRICE_TTL_MS = 3000
const KLINES_TTL_MS = 5000

let priceCache = {}
let lastFetchTime = {}

let klinesCache = {}
let klinesLastFetch = {}

function klinesKey(symbol, interval, limit) {
  return `${String(symbol ?? '').trim().toUpperCase()}|${interval}|${limit}`
}

export async function getCachedPrice(symbol) {
  const sym = String(symbol || 'BTC').trim() || 'BTC'
  const now = Date.now()
  if (
    priceCache[sym] &&
    lastFetchTime[sym] &&
    now - lastFetchTime[sym] < PRICE_TTL_MS
  ) {
    return priceCache[sym]
  }

  const data = await getDisplayPrice(sym)
  priceCache[sym] = data
  lastFetchTime[sym] = now
  return data
}

export async function getCachedKlines(baseOrPair, interval = '1h', limit = 100) {
  const key = klinesKey(baseOrPair, interval, limit)
  const now = Date.now()
  if (
    klinesCache[key] &&
    klinesLastFetch[key] &&
    now - klinesLastFetch[key] < KLINES_TTL_MS
  ) {
    return klinesCache[key]
  }

  const data = await fetchBinanceCandlesWithFallback(baseOrPair, interval, limit)
  klinesCache[key] = data
  klinesLastFetch[key] = now
  return data
}

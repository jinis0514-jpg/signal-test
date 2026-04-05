/**
 * Binance 공개 REST — 전 앱 단일 캔들 소스
 * time: Unix ms (UTC) — 엔진·차트·거래 exitTime과 동일 단위
 */

import { getFallbackCandles } from './marketFallbackCandles'

function toUsdtPair(baseOrPair) {
  const b = String(baseOrPair ?? '').trim().toUpperCase()
  if (!b) throw new Error('symbol 값이 필요합니다.')
  if (b.endsWith('USDT')) return b
  return `${b}USDT`
}

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines'

/** @param {unknown[]} row Binance kline 배열 */
export function parseBinanceKlineRow(row) {
  return {
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }
}

/**
 * @param {string} symbol BTC / BTCUSDT
 * @param {string} interval 1m, 5m, 15m, 1h, 4h, 1d …
 * @param {number} limit 최대 1000
 * @returns {Promise<Array<{ time:number, open:number, high:number, low:number, close:number, volume:number }>>}
 */
export async function fetchBinanceCandles(symbol = 'BTCUSDT', interval = '5m', limit = 500) {
  const sym = toUsdtPair(symbol)
  const lim = Math.max(1, Math.min(Number(limit) || 500, 1000))
  const url = `${BINANCE_KLINES}?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}&limit=${lim}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`캔들 API 오류 (${res.status})`)
  }
  const data = await res.json()
  if (!Array.isArray(data)) {
    throw new Error('캔들 응답 형식이 올바르지 않습니다.')
  }
  return data.map(parseBinanceKlineRow)
}

export function normalizeBinanceSymbol(symbol) {
  const s = String(symbol ?? 'BTCUSDT').trim().toUpperCase()
  if (!s) return 'BTCUSDT'
  if (s.endsWith('USDT')) return s
  return `${s}USDT`
}

/**
 * 실패 시 합성 캔들로 대체 (에러는 호출부에서 표시)
 */
export async function fetchBinanceCandlesWithFallback(symbol = 'BTCUSDT', interval = '5m', limit = 500) {
  try {
    return await fetchBinanceCandles(symbol, interval, limit)
  } catch {
    return getFallbackCandles(symbol, interval, limit)
  }
}

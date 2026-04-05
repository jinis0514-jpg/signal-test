/**
 * API 실패 시 — CHART_DATA 기반 합성 OHLC (동일 엔진·차트와 호환)
 */
import { CHART_DATA } from '../data/simulationMockData'

function intervalToSeconds(interval) {
  const s = String(interval ?? '1h').toLowerCase()
  const m = s.match(/^(\d+)(m|h|d)$/)
  if (!m) return 3600
  const n = Math.max(1, parseInt(m[1], 10))
  if (m[2] === 'm') return n * 60
  if (m[2] === 'h') return n * 3600
  return n * 86400
}

function chartKeyForSymbol(symbol) {
  const b = String(symbol ?? 'BTC').replace(/USDT$/i, '').trim().toUpperCase()
  if (b === 'ETH') return 'eth-range'
  if (b === 'SOL') return 'sol-momentum'
  if (b === 'BTC') return 'btc-trend'
  return 'btc-trend'
}

/**
 * @param {string} symbol BTCUSDT 등
 * @param {string} interval
 * @param {number} limit
 */
export function getFallbackCandles(symbol = 'BTCUSDT', interval = '5m', limit = 500) {
  const key = chartKeyForSymbol(symbol)
  const prices = CHART_DATA[key]?.prices ?? CHART_DATA['btc-trend'].prices
  if (!Array.isArray(prices) || prices.length === 0) return []

  const stepMs = intervalToSeconds(interval) * 1000
  const n = Math.max(10, Math.min(Number(limit) || 500, 1000))
  const nowMs = Date.now()
  const start = nowMs - n * stepMs
  const out = []

  for (let i = 0; i < n; i++) {
    const close = Number(prices[i % prices.length])
    const t = start + i * stepMs
    const w = Math.max(close * 0.0004, 0.01)
    out.push({
      time: t,
      open: close - w,
      high: close + w * 1.2,
      low: close - w * 1.2,
      close,
      volume: 800 + (i % 100),
    })
  }
  return out
}

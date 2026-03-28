const BASE_URL = 'https://api.binance.com'

/** @param {string} base 예: BTC → BTCUSDT */
export function toUsdtSymbol(base) {
  const b = String(base).trim().toUpperCase()
  if (!b) throw new Error('symbol 값이 필요합니다.')
  if (b.endsWith('USDT')) return b
  return `${b}USDT`
}

export async function getTickerPrice(baseOrPair = 'BTC') {
  try {
    const symbol = toUsdtSymbol(baseOrPair)
    const res = await fetch(`${BASE_URL}/api/v3/ticker/price?symbol=${symbol}`)
    if (!res.ok) {
      console.log('[binanceService] getTickerPrice HTTP error:', res.status, symbol)
      throw new Error('가격 조회 실패')
    }
    const data = await res.json()
    const price = Number(data?.price)
    if (!Number.isFinite(price)) {
      console.log('[binanceService] getTickerPrice invalid payload:', data)
      throw new Error('가격 조회 실패')
    }
    return {
      symbol: data.symbol ?? symbol,
      price,
    }
  } catch (e) {
    console.log('[binanceService] getTickerPrice:', e?.message ?? e)
    throw e
  }
}

export async function get24hrTicker(baseOrPair = 'BTC') {
  try {
    const symbol = toUsdtSymbol(baseOrPair)
    const res = await fetch(`${BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`)
    if (!res.ok) {
      console.log('[binanceService] get24hrTicker HTTP error:', res.status, symbol)
      throw new Error('24시간 데이터 조회 실패')
    }
    const data = await res.json()
    return {
      symbol: data.symbol,
      price: Number(data.lastPrice),
      changePercent: Number(data.priceChangePercent),
      volume: Number(data.volume),
    }
  } catch (e) {
    console.log('[binanceService] get24hrTicker:', e?.message ?? e)
    throw e
  }
}

export async function getKlines(baseOrPair = 'BTC', interval = '1h', limit = 100) {
  try {
    const symbol = toUsdtSymbol(baseOrPair)
    const res = await fetch(
      `${BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    )
    if (!res.ok) {
      console.log('[binanceService] getKlines HTTP error:', res.status, symbol, interval, limit)
      throw new Error('캔들 데이터 조회 실패')
    }
    const data = await res.json()
    return data.map((candle) => ({
      time: candle[0],
      open: Number(candle[1]),
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),
      volume: Number(candle[5]),
    }))
  } catch (e) {
    console.log('[binanceService] getKlines:', e?.message ?? e)
    throw e
  }
}

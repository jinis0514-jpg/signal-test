const BINANCE_BASE_URL = 'https://api.binance.com'

function toQuery(params) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  return qs.toString()
}

async function request(path, params = {}) {
  const query = toQuery(params)
  const url = `${BINANCE_BASE_URL}${path}${query ? `?${query}` : ''}`

  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error('가격 API 요청에 실패했습니다. 네트워크를 확인해주세요.')
  }

  if (!res.ok) {
    throw new Error(`가격 API 응답 오류 (${res.status})`)
  }

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('가격 API 응답 파싱에 실패했습니다.')
  }

  return data
}

function ensureSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('symbol 값이 필요합니다. (예: BTCUSDT)')
  }
}

export async function getTickerPrice(symbol) {
  ensureSymbol(symbol)
  const data = await request('/api/v3/ticker/price', { symbol: symbol.toUpperCase() })

  const price = Number(data?.price)
  if (!Number.isFinite(price)) {
    throw new Error('현재가 데이터 형식이 올바르지 않습니다.')
  }

  return {
    symbol: data.symbol ?? symbol.toUpperCase(),
    price,
  }
}

export async function get24hrTicker(symbol) {
  ensureSymbol(symbol)
  const data = await request('/api/v3/ticker/24hr', { symbol: symbol.toUpperCase() })

  const priceChangePercent = Number(data?.priceChangePercent)
  const quoteVolume = Number(data?.quoteVolume)
  const volume = Number(data?.volume)

  if (!Number.isFinite(priceChangePercent) || !Number.isFinite(volume)) {
    throw new Error('24시간 티커 데이터 형식이 올바르지 않습니다.')
  }

  return {
    symbol: data.symbol ?? symbol.toUpperCase(),
    priceChangePercent,
    volume,
    quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
  }
}

export async function getKlines(symbol, interval = '1h', limit = 100) {
  ensureSymbol(symbol)
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 100, 1000))
  const data = await request('/api/v3/klines', {
    symbol: symbol.toUpperCase(),
    interval,
    limit: parsedLimit,
  })

  if (!Array.isArray(data)) {
    throw new Error('캔들 데이터 형식이 올바르지 않습니다.')
  }

  return data.map((k) => ({
    openTime: Number(k?.[0]),
    open: Number(k?.[1]),
    high: Number(k?.[2]),
    low: Number(k?.[3]),
    close: Number(k?.[4]),
    volume: Number(k?.[5]),
    closeTime: Number(k?.[6]),
  }))
}

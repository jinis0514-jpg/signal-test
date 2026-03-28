const BASE_URL = 'https://api.upbit.com/v1'

/** @param {string} base 예: BTC → KRW-BTC */
export function toKrwMarket(base) {
  const b = String(base).trim().toUpperCase()
  if (!b) throw new Error('symbol 값이 필요합니다.')
  return `KRW-${b}`
}

/**
 * Upbit KRW 마켓 현재가 (해당 마켓이 없으면 null)
 * @returns {Promise<number|null>}
 */
export async function getKrwPrice(base) {
  try {
    const market = toKrwMarket(base)
    const url = `${BASE_URL}/ticker?markets=${encodeURIComponent(market)}`
    const res = await fetch(url)
    if (!res.ok) {
      console.log('[upbitService] getKrwPrice HTTP error:', res.status, market)
      return null
    }
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      return null
    }
    const p = Number(data[0]?.trade_price)
    return Number.isFinite(p) ? p : null
  } catch (e) {
    console.log('[upbitService] getKrwPrice:', e?.message ?? e)
    return null
  }
}

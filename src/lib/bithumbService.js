const BASE_URL = 'https://api.bithumb.com/public/ticker'

/** Bithumb 공개 API: {order}_{payment} 예: BTC_KRW */
function toBithumbPair(base) {
  const b = String(base).trim().toUpperCase()
  if (!b) throw new Error('symbol 값이 필요합니다.')
  return `${b}_KRW`
}

/**
 * Bithumb KRW 마켓 현재가 (해당 마켓이 없으면 null)
 * @returns {Promise<number|null>}
 */
export async function getKrwPrice(base) {
  try {
    const pair = toBithumbPair(base)
    const res = await fetch(`${BASE_URL}/${pair}`)
    if (!res.ok) {
      console.log('[bithumbService] getKrwPrice HTTP error:', res.status, pair)
      return null
    }
    const json = await res.json()
    if (json?.status !== '0000' || !json?.data) {
      return null
    }
    const raw = json.data?.closing_price
    const p = Number(raw)
    return Number.isFinite(p) ? p : null
  } catch (e) {
    console.log('[bithumbService] getKrwPrice:', e?.message ?? e)
    return null
  }
}

/**
 * Binance Spot 웹 거래 화면 링크 (직접 주문 · SAFE MODE)
 * @param {string} [pairSymbol] — 예: BTCUSDT, ETHUSDT, DOGEUSDT
 * @returns {string} https://www.binance.com/trade/BASE_USDT
 */
export function getBinanceSpotTradeUrl(pairSymbol = 'BTCUSDT') {
  const raw = String(pairSymbol ?? 'BTCUSDT').toUpperCase().replace(/[^A-Z]/g, '')
  let base = 'BTC'
  if (raw.endsWith('USDT') && raw.length > 4) {
    base = raw.slice(0, -4)
  } else if (raw && raw !== 'USDT') {
    const stripped = raw.replace(/USDT$/i, '')
    if (stripped.length >= 2) base = stripped
  }
  if (!base || base === 'USDT') base = 'BTC'
  return `https://www.binance.com/trade/${encodeURIComponent(base)}_USDT`
}

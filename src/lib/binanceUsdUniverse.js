/**
 * Binance 현물 USDT 마켓 메타 + 24시간 시세 일괄 반영 (exchangeInfo + ticker/24hr)
 */
const BASE = 'https://api.binance.com'
const LS_PAIR_META = 'bb_binance_usdt_pairs_meta_v1'
const META_TTL_MS = 60 * 60 * 1000

/** @param {string} symbol 예: BTCUSDT */
function isExcludedListingSymbol(symbol) {
  const s = String(symbol || '').toUpperCase()
  if (!s.endsWith('USDT')) return true
  if (s.endsWith('UPUSDT') || s.endsWith('DOWNUSDT')) return true
  if (/(BULL|BEAR)/.test(s)) return true
  if (/^1000/.test(s)) return true
  return false
}

/**
 * @returns {Promise<Array<{ symbol: string, baseAsset: string, quoteAsset: string }>>}
 */
export async function fetchBinanceUsdtSpotPairMeta() {
  const res = await fetch(`${BASE}/api/v3/exchangeInfo`)
  if (!res.ok) throw new Error(`exchangeInfo ${res.status}`)
  const data = await res.json()
  const symbols = Array.isArray(data?.symbols) ? data.symbols : []
  return symbols
    .filter(
      (x) => x
        && x.status === 'TRADING'
        && x.quoteAsset === 'USDT'
        && typeof x.symbol === 'string'
        && typeof x.baseAsset === 'string'
        && !isExcludedListingSymbol(x.symbol),
    )
    .map((x) => ({
      symbol: x.symbol,
      baseAsset: String(x.baseAsset).toUpperCase(),
      quoteAsset: String(x.quoteAsset).toUpperCase(),
    }))
}

/**
 * sessionStorage 캐시 (1시간)
 */
export async function fetchBinanceUsdtSpotPairMetaCached() {
  try {
    const raw = sessionStorage.getItem(LS_PAIR_META)
    if (raw) {
      const { at, list } = JSON.parse(raw)
      if (Array.isArray(list) && typeof at === 'number' && Date.now() - at < META_TTL_MS) {
        return list
      }
    }
  } catch { /* ignore */ }

  const list = await fetchBinanceUsdtSpotPairMeta()
  try {
    sessionStorage.setItem(LS_PAIR_META, JSON.stringify({ at: Date.now(), list }))
  } catch { /* quota / private mode */ }
  return list
}

/**
 * 홈 시세 테이블용 행 — symbol 은 **베이스** (BTC), displayPriceService와 동일
 * @returns {Promise<Array<{ symbol: string, usdPrice: number|null, changePercent: number|null, quoteVolume: number, krwPrice: null, krwSource: null, error: null }>>}
 */
export async function fetchBinanceUsdt24hrWatchRows() {
  const [meta, tickRes] = await Promise.all([
    fetchBinanceUsdtSpotPairMetaCached(),
    fetch(`${BASE}/api/v3/ticker/24hr`),
  ])
  if (!tickRes.ok) throw new Error(`ticker/24hr ${tickRes.status}`)
  const tickers = await tickRes.json()
  if (!Array.isArray(tickers)) return []

  const list = Array.isArray(meta) ? meta : []
  const allowed = new Set(list.map((m) => m.symbol))
  const metaByPair = new Map(list.map((m) => [m.symbol, m]))
  const rows = []
  for (const t of tickers) {
    const pair = t?.symbol
    if (typeof pair !== 'string' || !allowed.has(pair)) continue
    const m = metaByPair.get(pair)
    const base = m?.baseAsset ?? pair.replace(/USDT$/i, '')
    const usd = Number(t.lastPrice)
    const chg = Number(t.priceChangePercent)
    const qv = Number(t.quoteVolume)
    rows.push({
      symbol: base,
      usdPrice: Number.isFinite(usd) ? usd : null,
      changePercent: Number.isFinite(chg) ? chg : null,
      quoteVolume: Number.isFinite(qv) ? qv : 0,
      krwPrice: null,
      krwSource: null,
      error: null,
    })
  }
  return rows
}

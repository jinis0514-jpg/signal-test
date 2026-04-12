export const VIEWED_SIGNALS_LS_KEY = 'bb_viewed_signals_v1'

const LIMIT = 30

function normalizeRows(input) {
  if (!Array.isArray(input)) return []
  const seen = new Set()
  const out = []
  for (const row of input) {
    const id = String(row?.id ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      strategyId: row?.strategyId != null ? String(row.strategyId) : null,
      strategyName: String(row?.strategyName ?? '').trim() || '전략',
      symbol: String(row?.symbol ?? '').trim() || '—',
      type: String(row?.type ?? '').toUpperCase().trim() || '—',
      signalTs: Number.isFinite(Number(row?.signalTs)) ? Number(row.signalTs) : Date.now(),
      viewedAt: Number.isFinite(Number(row?.viewedAt)) ? Number(row.viewedAt) : Date.now(),
    })
  }
  return out
}

export function readViewedSignals() {
  try {
    const raw = localStorage.getItem(VIEWED_SIGNALS_LS_KEY)
    if (!raw) return []
    return normalizeRows(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeViewedSignals(rows) {
  const normalized = normalizeRows(rows).slice(0, LIMIT)
  try {
    localStorage.setItem(VIEWED_SIGNALS_LS_KEY, JSON.stringify(normalized))
  } catch {
    /* ignore */
  }
}

/**
 * 홈·시그널에서 시그널 행을 봤을 때 호출 — 최근 순으로 누적
 */
export function appendViewedSignal({
  strategyId = null,
  strategyName = '',
  symbol = '',
  type = '',
  signalTs = null,
  signalKey = null,
}) {
  const t = String(type ?? '').toUpperCase().trim() || '—'
  const sym = String(symbol ?? '').trim() || '—'
  const name = String(strategyName ?? '').trim() || '전략'
  const sid = strategyId != null && String(strategyId).trim() !== '' ? String(strategyId) : null
  const ts = Number(signalTs)
  const st = Number.isFinite(ts) ? ts : Date.now()
  const id = signalKey
    ? String(signalKey)
    : `${sid ?? 'na'}-${sym}-${t}-${st}`

  const row = {
    id,
    strategyId: sid,
    strategyName: name,
    symbol: sym,
    type: t,
    signalTs: st,
    viewedAt: Date.now(),
  }
  const prev = readViewedSignals()
  const merged = [row, ...prev.filter((x) => x.id !== id)].slice(0, LIMIT)
  writeViewedSignals(merged)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('bb-viewed-signals-changed'))
    } catch {
      /* ignore */
    }
  }
  return merged
}

export const RECENT_VIEWED_STRATEGIES_LS_KEY = 'bb_recent_viewed_strategies_v1'

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
      name: String(row?.name ?? '').trim() || id,
      updatedAt: Number(row?.updatedAt) || Date.now(),
    })
  }
  return out
}

export function readRecentViewedStrategies() {
  try {
    const raw = localStorage.getItem(RECENT_VIEWED_STRATEGIES_LS_KEY)
    if (!raw) return []
    return normalizeRows(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeRecentViewedStrategies(rows) {
  const normalized = normalizeRows(rows)
  try {
    localStorage.setItem(RECENT_VIEWED_STRATEGIES_LS_KEY, JSON.stringify(normalized))
  } catch {
    // ignore write failures
  }
}

export function trackRecentViewedStrategy(strategy, limit = 20) {
  const id = String(strategy?.id ?? '').trim()
  if (!id) return
  const name = String(strategy?.name ?? '').trim() || id
  const nextRow = { id, name, updatedAt: Date.now() }
  const prev = readRecentViewedStrategies()
  const merged = [nextRow, ...prev.filter((x) => x.id !== id)].slice(0, Math.max(1, Number(limit) || 20))
  writeRecentViewedStrategies(merged)
}


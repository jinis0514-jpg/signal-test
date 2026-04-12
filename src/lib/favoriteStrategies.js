export const FAVORITE_STRATEGIES_LS_KEY = 'bb_favorite_strategies_v1'

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

export function readFavoriteStrategies() {
  try {
    const raw = localStorage.getItem(FAVORITE_STRATEGIES_LS_KEY)
    if (!raw) return []
    return normalizeRows(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeFavoriteStrategies(rows) {
  const normalized = normalizeRows(rows)
  try {
    localStorage.setItem(FAVORITE_STRATEGIES_LS_KEY, JSON.stringify(normalized))
  } catch {
    // ignore write failures
  }
}


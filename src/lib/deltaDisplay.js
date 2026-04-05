/**
 * 제품 색상 규칙: 상승·양수 ▲ + emerald, 하락·음수 ▼ + red, 횡보·중립 gray
 */

export function deltaTextClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'text-slate-400 dark:text-slate-500'
  if (n > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (n < 0) return 'text-red-600 dark:text-red-400'
  return 'text-slate-400 dark:text-slate-500'
}

export function deltaArrow(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n > 0) return '▲'
  if (n < 0) return '▼'
  return '—'
}

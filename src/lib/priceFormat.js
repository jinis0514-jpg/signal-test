export function formatUsd(v, opts = {}) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const max = opts.maxFractionDigits ?? (n < 1 ? 6 : 2)
  const min = opts.minFractionDigits ?? (n >= 1 ? 2 : 0)
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: min, maximumFractionDigits: max })}`
}

export function formatKrw(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export function formatUsdKrwCombined(meta, fallbackUsd) {
  const usd = meta?.usdPrice != null ? meta.usdPrice : fallbackUsd
  const krw = meta?.krwPrice != null ? meta.krwPrice : null
  const usdStr = usd != null ? formatUsd(usd, { maxFractionDigits: 6, minFractionDigits: 2 }) : null
  const krwStr = krw != null ? formatKrw(krw) : null
  if (usdStr && krwStr) return `${usdStr} · ${krwStr}`
  if (usdStr) return usdStr
  if (krwStr) return krwStr
  return '—'
}


/**
 * 전략 시그널 중복 제거 (polling·재계산 시 동일 time+type 반복 방지)
 * signalId = strategyId + symbol + time + type (+ ENTRY 방향)
 */

export function normalizeSignalTimeKey(time) {
  const n = Number(time)
  if (!Number.isFinite(n)) return '0'
  if (n > 1e12) return String(Math.floor(n / 1000))
  if (n > 1e11) return String(Math.floor(n / 1000))
  return String(Math.floor(n))
}

export function normalizeDedupeSymbol(symbol) {
  return String(symbol ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/** 엔진 note → 진입 근거 태그 (| 구분) */
export function noteToReasonTags(note) {
  if (note == null || note === '') return []
  return String(note)
    .split('|')
    .map((n) => n.trim())
    .filter(Boolean)
}

/**
 * @param {string} strategyId
 * @param {{ time?: number, type?: string, direction?: string, symbol?: string }} signal
 * @param {string} [chartSymbol] 캔들/차트 심볼 (예: BTCUSDT). 없으면 signal.symbol 사용
 */
export function makeSignalDedupeKey(strategyId, signal, chartSymbol = '') {
  const sid = String(strategyId ?? 'default')
  const sym = normalizeDedupeSymbol(chartSymbol || signal?.symbol || '')
  const t = normalizeSignalTimeKey(signal?.time)
  const typ = String(signal?.type ?? '')
  const dir =
    typ === 'ENTRY'
      ? String(signal?.direction ?? '')
          .trim()
          .toUpperCase()
      : ''
  return `${sid}|${sym}|${t}|${typ}|${dir}`
}

/**
 * @param {string} strategyId
 * @param {object[]} signals
 * @param {string} [chartSymbol]
 * @returns {object[]} 첫 occurrence만 유지, 각 항목 `id`를 dedupe 키로 통일
 */
export function dedupeSignalsForStrategy(strategyId, signals, chartSymbol = '') {
  if (!Array.isArray(signals) || signals.length === 0) return []
  const seen = new Set()
  const out = []
  for (const s of signals) {
    if (!s || typeof s !== 'object') continue
    const key = makeSignalDedupeKey(strategyId, s, chartSymbol)
    if (seen.has(key)) continue
    seen.add(key)
    const reasons = noteToReasonTags(s.note)
    out.push({ ...s, id: key, reasons })
  }
  return out
}

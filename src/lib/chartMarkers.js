/**
 * lightweight-charts 시리즈 마커용 데이터 생성 (겹침 시 offset으로 모두 표시)
 */

function timeToSec(t) {
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n)
}

function shortLabel(name, max = 10) {
  const s = String(name ?? '?').trim()
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

/**
 * 동일 time 그룹에서 마커 position 분산 (겹쳐도 모두 표시)
 * @param {Array<{ time: number, position: string, color: string, shape: string, text: string }>} markers
 */
export function staggerOverlappingMarkers(markers) {
  if (!Array.isArray(markers) || markers.length === 0) return []

  const byTime = new Map()
  for (const m of markers) {
    const t = m.time
    if (!byTime.has(t)) byTime.set(t, [])
    byTime.get(t).push(m)
  }

  const out = []
  for (const [, group] of byTime) {
    const sorted = [...group].sort((a, b) => {
      const pa = a.shape === 'circle' ? 1 : 0
      const pb = b.shape === 'circle' ? 1 : 0
      if (pa !== pb) return pa - pb
      return String(a.text).localeCompare(String(b.text))
    })
    sorted.forEach((m, i) => {
      const preferBelow = m.shape === 'arrowUp' || m.text?.includes('↑')
      let position = m.position
      if (sorted.length > 1) {
        const stagger = i % 2 === 0
        position = stagger
          ? preferBelow
            ? 'belowBar'
            : 'aboveBar'
          : preferBelow
            ? 'aboveBar'
            : 'belowBar'
      }
      out.push({ ...m, position })
    })
  }
  return out.sort((a, b) => a.time - b.time)
}

/**
 * 엔진 시그널 묶음 → 마커 (전략별 색·이름)
 * @param {object} opts
 * @param {{ time:number, open:number, high:number, low:number, close:number }[]} opts.candles 정규화된 캔들 (time 초)
 * @param {{ id: string, name?: string, color: string, signals: object[] }[]} opts.strategies
 */
export function buildMarkersFromStrategySignals({ candles = [], strategies = [] }) {
  if (!Array.isArray(candles) || candles.length === 0) return []
  const timeSet = new Map(candles.map((c) => [timeToSec(c.time), c]))

  const raw = []
  for (const st of strategies) {
    if (!st || !Array.isArray(st.signals)) continue
    const color = st.color || '#6b7280'
    const label = shortLabel(st.name ?? st.id, 8)

    for (const sig of st.signals) {
      if (!sig || (sig.type !== 'ENTRY' && sig.type !== 'EXIT')) continue
      const ts = timeToSec(sig.time)
      if (ts == null || !timeSet.has(ts)) continue

      if (sig.type === 'ENTRY') {
        const dir = String(sig.direction || 'LONG').toUpperCase()
        const isLong = dir === 'LONG'
        raw.push({
          time: ts,
          position: isLong ? 'belowBar' : 'aboveBar',
          color,
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: `${label} ${isLong ? 'L' : 'S'}`,
        })
      } else {
        raw.push({
          time: ts,
          position: 'aboveBar',
          color,
          shape: 'circle',
          text: `${label} ×`,
        })
      }
    }
  }

  return staggerOverlappingMarkers(raw)
}

/**
 * 레거시: 인덱스 기반 진입/청산 + 단일 방향
 */
export function buildMarkersFromLegacyIndices({
  candles = [],
  entries = [],
  exits = [],
  openDir = 'LONG',
  entryColor = '#16c784',
  exitColor = '#f59e0b',
  entryLabel = '진입',
  exitLabel = '청산',
}) {
  if (!Array.isArray(candles) || candles.length === 0) return []
  const raw = []
  const isLong = String(openDir).toUpperCase() !== 'SHORT'

  for (const idx of entries) {
    const c = candles[idx]
    if (!c) continue
    const ts = timeToSec(c.time)
    raw.push({
      time: ts,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: entryColor,
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: entryLabel,
    })
  }
  for (const idx of exits) {
    const c = candles[idx]
    if (!c) continue
    const ts = timeToSec(c.time)
    raw.push({
      time: ts,
      position: 'aboveBar',
      color: exitColor,
      shape: 'circle',
      text: exitLabel,
    })
  }
  return staggerOverlappingMarkers(raw)
}

/**
 * strategyOverlays (entryIdxs / exitIdxs) — 방향 정보 없음 → 진입은 번갈아 배치, 텍스트에 이름
 */
export function buildMarkersFromStrategyOverlays({
  candles = [],
  overlays = [],
}) {
  if (!Array.isArray(candles) || !Array.isArray(overlays)) return []
  const raw = []

  for (const ov of overlays) {
    const color = ov.color || '#64748b'
    const label = shortLabel(ov.name ?? ov.id, 6)
    let ei = 0
    for (const idx of ov.entryIdxs || []) {
      const c = candles[idx]
      if (!c) continue
      const ts = timeToSec(c.time)
      const isLong = ei % 2 === 0
      ei += 1
      raw.push({
        time: ts,
        position: isLong ? 'belowBar' : 'aboveBar',
        color,
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: `${label}${isLong ? '↑' : '↓'}`,
      })
    }
    for (const idx of ov.exitIdxs || []) {
      const c = candles[idx]
      if (!c) continue
      const ts = timeToSec(c.time)
      raw.push({
        time: ts,
        position: 'aboveBar',
        color,
        shape: 'circle',
        text: `${label}×`,
      })
    }
  }
  return staggerOverlappingMarkers(raw)
}

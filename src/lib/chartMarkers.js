/**
 * lightweight-charts 시리즈 마커용 데이터 생성 (겹침 시 offset으로 모두 표시)
 */

import { makeSignalDedupeKey, normalizeDedupeSymbol } from './signalDedupe'

function timeToSec(t) {
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n)
}

function shortLabel(name, max = 10) {
  const s = String(name ?? '?').trim()
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

/** BTCUSDT → BTC (라벨용, 최대 6자) */
function baseTagFromChartSymbol(pair) {
  const norm = normalizeDedupeSymbol(pair)
  const base = norm.replace(/USDT$/i, '').replace(/PERP$/i, '')
  const tag = base.slice(0, 6)
  return tag || '?'
}

/**
 * 동일 time 그룹에서 마커 position 분산 (겹쳐도 모두 표시)
 * price 기준 마커는 캔들 밖으로 살짝 벌림 (LONG 아래 / SHORT 위)
 * @param {Array<{ time: number, position: string, color: string, shape: string, text: string, price?: number, _refClose?: number }>} markers
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
      const pr = m.price
      if (pr != null && Number.isFinite(Number(pr))) {
        const price = Number(pr)
        const ref = Number.isFinite(Number(m._refClose)) ? Number(m._refClose) : price
        const inc = Math.max(ref * 0.00014, Math.abs(price) * 0.0001)
        const isLong = m.shape === 'arrowUp'
        let nextPrice = price
        if (sorted.length > 1) {
          nextPrice = isLong ? price - i * inc : price + i * inc
        }
        const { _refClose: _r, ...rest } = m
        out.push({ ...rest, price: nextPrice })
        return
      }
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
 * @param {{ id: string, name?: string, color: string, signals: object[], chartSymbol?: string }[]} opts.strategies
 */
export function buildMarkersFromStrategySignals({ candles = [], strategies = [] }) {
  if (!Array.isArray(candles) || candles.length === 0) return []
  const timeSet = new Map(candles.map((c) => [timeToSec(c.time), c]))

  const raw = []
  for (const st of strategies) {
    if (!st || !Array.isArray(st.signals)) continue
    const color = st.color || '#6b7280'
    const stratKey = String(st.id ?? 's')
    const chartSym = st.chartSymbol ?? ''
    const baseTag = baseTagFromChartSymbol(chartSym)
    const seenSig = new Set()

    for (const sig of st.signals) {
      if (!sig || (sig.type !== 'ENTRY' && sig.type !== 'EXIT')) continue
      const dk = makeSignalDedupeKey(stratKey, { ...sig, symbol: chartSym }, chartSym)
      if (seenSig.has(dk)) continue
      seenSig.add(dk)
      const ts = timeToSec(sig.time)
      if (ts == null || !timeSet.has(ts)) continue

      const candle = timeSet.get(ts)
      const ref = Number(candle.close)
      const span = Math.max(Number(candle.high) - Number(candle.low), ref * 0.00025)
      const off = Math.max(span * 0.22, ref * 0.00018)

      if (sig.type === 'ENTRY') {
        const dir = String(sig.direction || 'LONG').toUpperCase()
        const isLong = dir === 'LONG'
        const markerPrice = isLong ? Number(candle.low) - off : Number(candle.high) + off
        raw.push({
          time: ts,
          position: isLong ? 'atPriceBottom' : 'atPriceTop',
          price: markerPrice,
          color,
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: `${baseTag}-${isLong ? 'L' : 'S'}`,
          _refClose: ref,
        })
      } else {
        const markerPrice = Number(candle.high) + off
        raw.push({
          time: ts,
          position: 'atPriceTop',
          price: markerPrice,
          color,
          shape: 'circle',
          text: `${baseTag}-×`,
          _refClose: ref,
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
    const seenEntryIdx = new Set()
    for (const idx of ov.entryIdxs || []) {
      if (seenEntryIdx.has(idx)) continue
      seenEntryIdx.add(idx)
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
    const seenExitIdx = new Set()
    for (const idx of ov.exitIdxs || []) {
      if (seenExitIdx.has(idx)) continue
      seenExitIdx.add(idx)
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

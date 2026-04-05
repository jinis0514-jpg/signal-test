import { useMemo, memo } from 'react'
import SignalChart from '../charts/SignalChart'
import {
  buildMarkersFromStrategySignals,
  buildMarkersFromStrategyOverlays,
  buildMarkersFromLegacyIndices,
  staggerOverlappingMarkers,
} from '../../lib/chartMarkers'
import { cn } from '../../lib/cn'

/**
 * 호환 래퍼: SignalChart + 마커 빌더
 *
 * @param {object} props
 * @param {{ id:string, name?:string, color:string, signals:object[] }[]} [props.strategySignalBundles] 멀티 전략 시 엔진 시그널 원본 (권장)
 * @param {{ time:number, position:string, color:string, shape:string, text:string }[]} [props.markers] 외부 마커 직접 전달
 */
function CandlestickChart({
  candles = [],
  entries = [],
  exits = [],
  openEntry = null,
  openDir = 'LONG',
  openPnlPct = null,
  emphasizeOpen = true,
  isDark = false,
  markers: externalMarkers = null,
  strategyOverlays = null,
  strategySignalBundles = null,
  priceLineOverlays = null,
  strategyName = '',
}) {
  void openPnlPct

  const normalizedCandles = useMemo(() => {
    if (!Array.isArray(candles) || candles.length === 0) return []
    return candles
      .filter(
        (c) =>
          c != null &&
          Number.isFinite(+c.open) &&
          Number.isFinite(+c.high) &&
          Number.isFinite(+c.low) &&
          Number.isFinite(+c.close),
      )
      .map((c) => {
        const t = +c.time
        const timeSec = t > 1e11 ? Math.floor(t / 1000) : t
        return {
          time: timeSec,
          open: +c.open,
          high: +c.high,
          low: +c.low,
          close: +c.close,
          volume: Number.isFinite(+c.volume) ? +c.volume : 0,
        }
      })
  }, [candles])

  const chartMarkers = useMemo(() => {
    if (externalMarkers && Array.isArray(externalMarkers) && externalMarkers.length > 0) {
      return staggerOverlappingMarkers(externalMarkers)
    }

    if (Array.isArray(strategySignalBundles) && strategySignalBundles.length > 0) {
      return buildMarkersFromStrategySignals({
        candles: normalizedCandles,
        strategies: strategySignalBundles,
      })
    }

    if (Array.isArray(strategyOverlays) && strategyOverlays.length > 0) {
      return buildMarkersFromStrategyOverlays({
        candles: normalizedCandles,
        overlays: strategyOverlays,
      })
    }

    return buildMarkersFromLegacyIndices({
      candles: normalizedCandles,
      entries: Array.isArray(entries) ? entries : [],
      exits: Array.isArray(exits) ? exits : [],
      openDir,
      entryColor: '#16c784',
      exitColor: '#94a3b8',
      entryLabel: openDir === 'SHORT' ? 'S' : 'L',
      exitLabel: '×',
    })
  }, [
    externalMarkers,
    strategySignalBundles,
    strategyOverlays,
    normalizedCandles,
    entries,
    exits,
    openDir,
  ])

  return (
    <div
      className={cn(
        'h-full w-full min-h-0 rounded-lg border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950/30',
      )}
    >
      <div className="h-full min-h-[220px] w-full">
        <SignalChart
          candles={candles}
          markers={chartMarkers}
          priceLineOverlays={priceLineOverlays}
          openEntry={strategySignalBundles?.length || strategyOverlays?.length ? null : openEntry}
          openDir={openDir}
          emphasizeOpen={emphasizeOpen && !strategySignalBundles?.length && !strategyOverlays?.length}
          watermark={strategyName ?? ''}
          showVolume
          isDark={isDark}
        />
      </div>
    </div>
  )
}

export default memo(CandlestickChart)

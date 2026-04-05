import { useEffect, useRef, memo, useMemo } from 'react'
import {
  createChart,
  AreaSeries,
  CrosshairMode,
  createSeriesMarkers,
} from 'lightweight-charts'

/**
 * lightweight-charts v5 기반 라인(Area) 차트 — 캔들 데이터가 없을 때 fallback.
 */
function MockChart({
  prices = [],
  entries = [],
  exits = [],
  openEntry = null,
  openDir = 'LONG',
  isDark = false,
}) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const lineSeriesRef = useRef(null)
  const markersRef = useRef(null)

  const normalizedPrices = useMemo(() => {
    if (!Array.isArray(prices) || prices.length === 0) return []
    return prices
      .map((p, i) => {
        const val = p != null && typeof p === 'object' ? Number(p.price ?? p.close ?? p.value) : Number(p)
        if (!Number.isFinite(val)) return null
        return { time: i, value: val }
      })
      .filter(Boolean)
  }, [prices])

  const chartMarkers = useMemo(() => {
    const m = []
    for (const idx of entries) {
      if (idx < 0 || idx >= normalizedPrices.length) continue
      m.push({
        time: normalizedPrices[idx].time,
        position: 'belowBar',
        color: '#059669',
        shape: 'arrowUp',
        text: 'E',
      })
    }
    for (const idx of exits) {
      if (idx < 0 || idx >= normalizedPrices.length) continue
      m.push({
        time: normalizedPrices[idx].time,
        position: 'aboveBar',
        color: '#d97706',
        shape: 'arrowDown',
        text: 'X',
      })
    }
    return m.sort((a, b) => a.time - b.time)
  }, [normalizedPrices, entries, exits])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const bgColor = isDark ? '#0f172a' : '#ffffff'
    const textColor = isDark ? '#94a3b8' : '#64748b'
    const gridColor = isDark ? 'rgba(51,65,85,0.25)' : 'rgba(226,232,240,0.6)'

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { color: bgColor },
        textColor,
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor, style: 1 },
        horzLines: { color: gridColor, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: isDark ? '#475569' : '#94a3b8', width: 1, style: 2 },
        horzLine: { color: isDark ? '#475569' : '#94a3b8', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: gridColor },
      timeScale: {
        borderColor: gridColor,
        visible: false,
        rightOffset: 3,
      },
    })

    const lineSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(59,130,246,0.3)',
      bottomColor: 'rgba(59,130,246,0.02)',
      lineColor: '#3b82f6',
      lineWidth: 2,
    })

    chartRef.current = chart
    lineSeriesRef.current = lineSeries

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) chart.resize(width, height)
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      lineSeriesRef.current = null
      markersRef.current = null
    }
  }, [isDark])

  useEffect(() => {
    const lineSeries = lineSeriesRef.current
    if (!lineSeries || normalizedPrices.length === 0) return

    lineSeries.setData(normalizedPrices)

    if (chartMarkers.length > 0) {
      if (markersRef.current) {
        markersRef.current.setMarkers(chartMarkers)
      } else {
        markersRef.current = createSeriesMarkers(lineSeries, chartMarkers)
      }
    } else if (markersRef.current) {
      markersRef.current.setMarkers([])
    }

    if (openEntry != null && Number.isFinite(openEntry)) {
      const dirColor = openDir === 'LONG' ? '#059669' : '#dc2626'
      lineSeries.createPriceLine({
        price: openEntry,
        color: dirColor,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'ENTRY',
      })
    }
  }, [normalizedPrices, chartMarkers, openEntry, openDir])

  if (normalizedPrices.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-slate-400">
        데이터가 부족합니다
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-full" />
}

export default memo(MockChart)

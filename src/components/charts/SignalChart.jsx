import { useEffect, useRef, memo, useMemo } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  createSeriesMarkers,
} from 'lightweight-charts'
import { cn } from '../../lib/cn'
import EmptyState from '../ui/EmptyState'

/**
 * TradingView 느낌의 캔들 + 마커 전용 차트 (lightweight-charts v5)
 *
 * @param {object} props
 * @param {Array} props.candles raw OHLC (time ms|sec)
 * @param {Array<{time:number,position:string,color:string,shape:string,text:string}>} props.markers
 * @param {Array<{price:number,color?:string,title?:string,lineWidth?:number}>} [props.priceLineOverlays]
 * @param {number|null} [props.openEntry] 단일 진입가 라인 (오버레이 없을 때)
 * @param {'LONG'|'SHORT'} [props.openDir]
 * @param {boolean} [props.emphasizeOpen]
 * @param {boolean} [props.showVolume]
 * @param {boolean} [props.isDark]
 * @param {string} [props.className] 래퍼 (차트 영역만)
 */
function SignalChart({
  candles = [],
  markers = [],
  priceLineOverlays = null,
  openEntry = null,
  openDir = 'LONG',
  emphasizeOpen = true,
  showVolume = true,
  isDark = false,
  className = '',
}) {
  const containerRef = useRef(null)
  /** 차트 인스턴스마다 1회만 fitContent — 이후 setData만 하고 뷰(줌/스크롤) 유지 */
  const initialFitDoneRef = useRef(false)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const markersApiRef = useRef(null)
  const priceLineApiRef = useRef([])

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

  const safeMarkers = useMemo(() => (Array.isArray(markers) ? markers : []), [markers])
  const emphasizedMarkers = useMemo(() => {
    if (!Array.isArray(safeMarkers) || safeMarkers.length === 0) return []
    const sorted = [...safeMarkers].sort((a, b) => Number(a?.time ?? 0) - Number(b?.time ?? 0))
    const recentCut = Math.max(0, sorted.length - 3)
    const byTime = new Map()
    for (let i = 0; i < sorted.length; i += 1) {
      const t = Number(sorted[i]?.time ?? 0)
      const list = byTime.get(t) ?? []
      list.push(i)
      byTime.set(t, list)
    }
    return sorted.map((m, idx) => {
      const isRecent = idx >= recentCut
      const sameTimeIdxs = byTime.get(Number(m?.time ?? 0)) ?? []
      const keepByTime = sameTimeIdxs.length <= 2 || idx === sameTimeIdxs[sameTimeIdxs.length - 1]
      return {
        ...m,
        text: isRecent && keepByTime ? String(m?.text ?? '') : '',
      }
    })
  }, [safeMarkers])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const bg = isDark ? '#0b1220' : '#ffffff'
    const text = isDark ? '#94a3b8' : '#475569'
    const grid = isDark ? 'rgba(51,65,85,0.22)' : '#f3f4f6'

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { color: bg },
        textColor: text,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: grid, visible: true },
        horzLines: { color: grid, visible: true },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? '#475569' : '#cbd5e1',
          width: 1,
          style: 2,
          labelBackgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        },
        horzLine: {
          color: isDark ? '#475569' : '#cbd5e1',
          width: 1,
          style: 2,
          labelBackgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        },
      },
      rightPriceScale: {
        borderColor: isDark ? '#1e293b' : '#e5e7eb',
        scaleMargins: showVolume ? { top: 0.08, bottom: 0.22 } : { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#e5e7eb',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 7,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ea3943',
      borderVisible: false,
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
    })

    let volumeSeries = null
    if (showVolume) {
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
        color: 'rgba(100,116,139,0.35)',
      })
      chart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      })
    }

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) chart.resize(width, height)
      }
    })
    ro.observe(el)

    return () => {
      initialFitDoneRef.current = false
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      markersApiRef.current = null
      priceLineApiRef.current = []
    }
  }, [isDark, showVolume])

  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    const chart = chartRef.current
    if (!candleSeries || normalizedCandles.length === 0) return

    candleSeries.setData(
      normalizedCandles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )

    if (showVolume && volumeSeries) {
      const volColor = (c) =>
        c.close >= c.open ? 'rgba(22,199,132,0.28)' : 'rgba(234,57,67,0.28)'
      volumeSeries.setData(
        normalizedCandles.map((c) => ({
          time: c.time,
          value: c.volume,
          color: volColor(c),
        })),
      )
    }

    const sortedMarkers = [...emphasizedMarkers].sort((a, b) => a.time - b.time)
    if (sortedMarkers.length > 0) {
      if (markersApiRef.current) {
        markersApiRef.current.setMarkers(sortedMarkers)
      } else {
        markersApiRef.current = createSeriesMarkers(candleSeries, sortedMarkers, {
          autoScale: true,
        })
      }
    } else if (markersApiRef.current) {
      markersApiRef.current.setMarkers([])
    }

    priceLineApiRef.current.forEach((l) => {
      try {
        l.remove()
      } catch {
        /* noop */
      }
    })
    priceLineApiRef.current = []

    if (Array.isArray(priceLineOverlays) && priceLineOverlays.length > 0) {
      for (const pl of priceLineOverlays) {
        const pr = pl.price
        if (pr == null || !Number.isFinite(Number(pr))) continue
        const line = candleSeries.createPriceLine({
          price: Number(pr),
          color: pl.color || '#64748b',
          lineWidth: pl.lineWidth ?? 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: String(pl.title ?? '').slice(0, 28),
        })
        priceLineApiRef.current.push(line)
      }
    } else if (openEntry != null && Number.isFinite(Number(openEntry)) && emphasizeOpen) {
      const dirColor = openDir === 'LONG' ? '#16c784' : '#ea3943'
      const line = candleSeries.createPriceLine({
        price: Number(openEntry),
        color: dirColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: openDir === 'LONG' ? '현재 진입가 (LONG)' : '현재 진입가 (SHORT)',
      })
      priceLineApiRef.current.push(line)
    }

    if (chart && !initialFitDoneRef.current) {
      chart.timeScale().fitContent()
      initialFitDoneRef.current = true
    }
  }, [
    normalizedCandles,
    emphasizedMarkers,
    priceLineOverlays,
    openEntry,
    openDir,
    emphasizeOpen,
    showVolume,
  ])

  if (normalizedCandles.length === 0) {
    return (
      <div className={cn('flex h-full min-h-[200px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30', className)}>
        <EmptyState title="아직 표시할 시그널/캔들 데이터가 없습니다" description="데이터가 들어오면 이 영역에 자동으로 표시됩니다." bordered={false} />
      </div>
    )
  }

  return <div ref={containerRef} className={cn('h-full w-full min-h-[200px]', className)} />
}

export default memo(SignalChart)

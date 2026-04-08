import { useMemo } from 'react'

export default function LivePerformanceChart({ dailyData = [], className = '' }) {
  const chartData = useMemo(() => {
    if (!dailyData.length) return null
    const maxRoi = Math.max(...dailyData.map((d) => d.cumulative_roi), 0.01)
    const minRoi = Math.min(...dailyData.map((d) => d.cumulative_roi), 0)
    const range = maxRoi - minRoi || 1
    return { maxRoi, minRoi, range }
  }, [dailyData])

  if (!dailyData.length || !chartData) {
    return (
      <div className={`flex items-center justify-center h-48 text-slate-400 dark:text-slate-500 text-sm ${className}`}>
        라이브 성과 데이터가 없습니다
      </div>
    )
  }

  const { minRoi, range } = chartData
  const W = 100
  const H = 40
  const step = dailyData.length > 1 ? W / (dailyData.length - 1) : W
  const zeroY = ((0 - minRoi) / range) * H

  const points = dailyData.map((d, i) => {
    const x = i * step
    const y = H - ((d.cumulative_roi - minRoi) / range) * H
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const areaPoints = [
    `0,${H}`,
    ...points,
    `${((dailyData.length - 1) * step).toFixed(2)},${H}`,
  ]

  const lastRoi = dailyData[dailyData.length - 1].cumulative_roi
  const isPositive = lastRoi >= 0

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">누적 ROI</span>
        <span className={`text-lg font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{lastRoi.toFixed(2)}%
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" preserveAspectRatio="none">
        {/* zero line */}
        <line
          x1="0" y1={H - zeroY} x2={W} y2={H - zeroY}
          stroke="currentColor" className="text-slate-300 dark:text-slate-600"
          strokeWidth="0.3" strokeDasharray="1,1"
        />

        {/* area */}
        <polygon
          points={areaPoints.join(' ')}
          className={isPositive ? 'fill-emerald-500/10' : 'fill-red-500/10'}
        />

        {/* line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          className={isPositive ? 'stroke-emerald-500' : 'stroke-red-500'}
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
        <span>{dailyData[0]?.as_of}</span>
        <span>{dailyData[dailyData.length - 1]?.as_of}</span>
      </div>
    </div>
  )
}

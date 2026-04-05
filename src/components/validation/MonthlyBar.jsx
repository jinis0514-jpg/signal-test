import { useMemo } from 'react'

const W   = 280
const H   = 96
const PAD = { top: 18, right: 4, bottom: 20, left: 4 }

const sign = (v) => (v >= 0 ? '+' : '')

export default function MonthlyBar({ months }) {
  const { bars, zeroY, iH } = useMemo(() => {
    const values = months.map((m) => m.value)
    const absMax = Math.max(...values.map(Math.abs), 1)
    const iH_    = H - PAD.top - PAD.bottom
    const yMin   = -absMax * 1.1
    const yMax   =  absMax * 1.1
    const ySpan  = yMax - yMin
    const zY     = PAD.top + (1 - (0 - yMin) / ySpan) * iH_
    const iW     = W - PAD.left - PAD.right
    const slot   = iW / months.length
    const barW   = Math.max(slot - 2, 2)

    const bars_ = months.map((m, i) => {
      const isPos = m.value >= 0
      const barH  = (Math.abs(m.value) / ySpan) * iH_
      const x     = PAD.left + i * slot + (slot - barW) / 2
      const y     = isPos ? zY - barH : zY
      return { ...m, x, y, barW, barH, isPos }
    })

    return { bars: bars_, zeroY: zY, iH: iH_ }
  }, [months])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ display: 'block' }}
    >
      {/* 제로 라인 */}
      <line
        x1={PAD.left} y1={zeroY.toFixed(1)}
        x2={W - PAD.right} y2={zeroY.toFixed(1)}
        strokeWidth="0.5"
        className="stroke-slate-300 dark:stroke-gray-600"
      />

      {bars.map((b) => (
        <g key={b.label}>
          {/* 바 */}
          <rect
            x={b.x.toFixed(1)} y={b.y.toFixed(1)}
            width={b.barW.toFixed(1)} height={Math.max(b.barH, 1).toFixed(1)}
            rx="0.5"
            className={b.isPos ? 'fill-blue-500' : 'fill-red-500'}
          />

          {/* 값 레이블 */}
          <text
            x={(b.x + b.barW / 2).toFixed(1)}
            y={(b.isPos ? b.y - 3 : b.y + b.barH + 9).toFixed(1)}
            textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace"
            className={b.isPos ? 'fill-blue-600 dark:fill-blue-500' : 'fill-red-500'}
          >
            {sign(b.value)}{b.value.toFixed(1)}
          </text>

          {/* 월 레이블 */}
          <text
            x={(b.x + b.barW / 2).toFixed(1)}
            y={(H - 4).toFixed(1)}
            textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace"
            className="fill-slate-400 dark:fill-slate-600"
          >
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

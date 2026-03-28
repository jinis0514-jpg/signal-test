import { useMemo } from 'react'

const W   = 560
const H   = 200
const PAD = { top: 22, right: 64, bottom: 30, left: 44 }

const sign = (v) => (v >= 0 ? '+' : '')

function buildLayout(equity) {
  const iW    = W - PAD.left - PAD.right
  const iH    = H - PAD.top  - PAD.bottom
  const eMin  = Math.min(...equity)
  const eMax  = Math.max(...equity)

  const yMin  = Math.floor(Math.min(eMin, 0) / 10) * 10 - 1
  const yMax  = Math.ceil(eMax / 10) * 10 + 1
  const ySpan = yMax - yMin

  const toY = (v) => PAD.top + (1 - (v - yMin) / ySpan) * iH
  const toX = (i) => PAD.left + (i / Math.max(equity.length - 1, 1)) * iW

  const pts = equity.map((v, i) => ({ x: toX(i), y: toY(v), v }))

  /* Y 눈금 — 10% 단위 */
  const yTicks = []
  for (let t = Math.ceil(yMin / 10) * 10; t <= yMax; t += 10) {
    yTicks.push({ value: t, y: toY(t) })
  }

  /* MDD 구간 자동 탐지 */
  let peakIdx = 0, mddStart = 0, mddEnd = 0, maxDD = 0
  for (let i = 1; i < equity.length; i++) {
    if (equity[i] > equity[peakIdx]) peakIdx = i
    const dd = equity[peakIdx] - equity[i]
    if (dd > maxDD) { maxDD = dd; mddStart = peakIdx; mddEnd = i }
  }

  return { pts, yTicks, mddStart, mddEnd, maxDD, zeroY: toY(0), iH }
}

export default function EquityCurve({ equity, xLabels = [] }) {
  const { pts, yTicks, mddStart, mddEnd, maxDD, zeroY, iH } =
    useMemo(() => buildLayout(equity), [equity])

  if (pts.length < 2) return null

  const botY  = H - PAD.bottom
  const first = pts[0]
  const last  = pts[pts.length - 1]

  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')
  const polyPts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillBase = Math.min(botY, zeroY).toFixed(1)
  const areaD    = `M ${first.x.toFixed(1)},${fillBase} L ${linePts} L ${last.x.toFixed(1)},${fillBase} Z`

  const mddX1    = pts[mddStart]?.x ?? 0
  const mddX2    = pts[mddEnd]?.x   ?? 0
  const mddMidX  = ((mddX1 + mddX2) / 2).toFixed(1)
  const mddBotY  = (pts[mddEnd]?.y ?? 0) + 14

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full overflow-visible"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Y 그리드 + 레이블 */}
      {yTicks.map(({ value, y }) => (
        <g key={value}>
          <line
            x1={PAD.left} y1={y.toFixed(1)} x2={W - PAD.right} y2={y.toFixed(1)}
            strokeWidth={value === 0 ? '1' : '0.5'}
            className={value === 0
              ? 'stroke-slate-300 dark:stroke-gray-600'
              : 'stroke-slate-100 dark:stroke-gray-800'}
          />
          <text
            x={PAD.left - 5} y={(y + 3.5).toFixed(1)}
            textAnchor="end" fontSize="8" fontFamily="ui-monospace, monospace"
            className="fill-slate-400 dark:fill-slate-600"
          >
            {value === 0 ? '0%' : `${sign(value)}${value}%`}
          </text>
        </g>
      ))}

      {/* X 축 */}
      <line x1={PAD.left} y1={botY} x2={W - PAD.right} y2={botY}
        strokeWidth="0.5" className="stroke-slate-200 dark:stroke-gray-700" />

      {/* MDD 구간 음영 */}
      {mddStart < mddEnd && (mddX2 - mddX1) > 0 && (
        <rect
          x={mddX1.toFixed(1)} y={PAD.top}
          width={(mddX2 - mddX1).toFixed(1)} height={iH}
          fill="#ef4444" opacity="0.06"
        />
      )}

      {/* 면적 채우기 */}
      <path d={areaD} fill="url(#eqFill)" />

      {/* 수익 곡선 */}
      <polyline
        points={polyPts}
        fill="none" stroke="#3b82f6"
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
      />

      {/* X 레이블 */}
      {xLabels.map(({ idx, label }) => {
        const pt = pts[idx]
        if (!pt) return null
        return (
          <text key={label}
            x={pt.x.toFixed(1)} y={(botY + 12).toFixed(1)}
            textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace"
            className="fill-slate-400 dark:fill-slate-600"
          >
            {label}
          </text>
        )
      })}

      {/* 시작 점 */}
      <circle cx={first.x.toFixed(1)} cy={first.y.toFixed(1)} r="2.5" fill="#94a3b8" />

      {/* 최신 점 강조 */}
      <circle
        cx={last.x.toFixed(1)} cy={last.y.toFixed(1)}
        r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5"
      />

      {/* 최종값 라벨 */}
      <rect
        x={W - PAD.right + 3} y={(last.y - 9).toFixed(1)}
        width={PAD.right - 5} height={16} rx="1" fill="#1d4ed8"
      />
      <text
        x={(W - PAD.right + 3 + (PAD.right - 5) / 2).toFixed(1)}
        y={(last.y + 4).toFixed(1)}
        textAnchor="middle" fontSize="8.5" fill="white"
        fontFamily="ui-monospace, monospace" fontWeight="700"
      >
        {sign(last.v)}{last.v.toFixed(1)}%
      </text>

      {/* MDD 레이블 */}
      {mddStart < mddEnd && maxDD > 0.5 && (
        <text
          x={mddMidX} y={mddBotY.toFixed(1)}
          textAnchor="middle" fontSize="7.5" fill="#dc2626"
          fontFamily="ui-monospace, monospace" fontWeight="600" opacity="0.75"
        >
          MDD ▼{maxDD.toFixed(1)}pp
        </text>
      )}
    </svg>
  )
}

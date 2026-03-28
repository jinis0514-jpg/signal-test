import { useMemo } from 'react'

const W   = 560
const H   = 160
const PAD = { top: 16, right: 60, bottom: 22, left: 10 }

function buildPoints(prices) {
  const min  = Math.min(...prices)
  const max  = Math.max(...prices)
  const span = (max - min) || 1
  const iW   = W - PAD.left - PAD.right
  const iH   = H - PAD.top  - PAD.bottom
  return { pts: prices.map((p, i) => ({
    x: PAD.left + (i / Math.max(prices.length - 1, 1)) * iW,
    y: PAD.top  + (1 - (p - min) / span) * iH,
    p,
  })), min, max, span }
}

const fmt = (n) => n >= 1000 ? n.toLocaleString() : String(n)

/**
 * openEntry: 진입 가격 (숫자). 지정 시 오픈 포지션 밴드를 그림.
 * openDir:   'LONG' | 'SHORT'
 */
export default function MockChart({ prices, entries = [], exits = [], openEntry = null, openDir = 'LONG' }) {
  const { pts, min: minP, max: maxP, span } = useMemo(() => buildPoints(prices), [prices])

  if (pts.length < 2) return null

  const iH      = H - PAD.top - PAD.bottom
  const botY    = H - PAD.bottom
  const first   = pts[0]
  const last    = pts[pts.length - 1]
  const polyPts = pts.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
  const linePts = pts.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L ')
  const areaD   = `M ${first.x.toFixed(1)},${botY} L ${linePts} L ${last.x.toFixed(1)},${botY} Z`
  const midP    = Math.round((minP + maxP) / 2)

  /* 오픈 포지션 밴드 계산 */
  const entryY = openEntry !== null
    ? PAD.top + (1 - (openEntry - minP) / span) * iH
    : null
  const isProfit = openEntry !== null
    ? (openDir === 'LONG' ? last.p > openEntry : last.p < openEntry)
    : false
  const bandColor  = isProfit ? '#10b981' : '#ef4444'
  const bandTop    = entryY !== null ? Math.min(entryY, last.y) : 0
  const bandHeight = entryY !== null ? Math.abs(entryY - last.y) : 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full overflow-visible"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="simAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* 수평 그리드 */}
      {[0.25, 0.5, 0.75].map((f) => {
        const y = PAD.top + f * (H - PAD.top - PAD.bottom)
        return (
          <line
            key={f}
            x1={PAD.left} y1={y.toFixed(1)}
            x2={W - PAD.right} y2={y.toFixed(1)}
            strokeWidth="1"
            className="stroke-slate-100 dark:stroke-gray-800"
          />
        )
      })}

      {/* X축 */}
      <line
        x1={PAD.left} y1={botY}
        x2={W - PAD.right} y2={botY}
        strokeWidth="0.5"
        className="stroke-slate-200 dark:stroke-gray-700"
      />

      {/* 오픈 포지션 밴드 */}
      {entryY !== null && bandHeight > 0 && (
        <rect
          x={PAD.left} y={bandTop.toFixed(1)}
          width={W - PAD.left - PAD.right} height={bandHeight.toFixed(1)}
          fill={bandColor} opacity="0.09"
        />
      )}

      {/* 오픈 포지션 진입선 */}
      {entryY !== null && (
        <line
          x1={PAD.left} y1={entryY.toFixed(1)}
          x2={W - PAD.right} y2={entryY.toFixed(1)}
          stroke={bandColor} strokeWidth="0.9" strokeDasharray="2.5,2.5"
          opacity="0.7"
        />
      )}

      {/* 영역 채우기 */}
      <path d={areaD} fill="url(#simAreaFill)" />

      {/* 가격 선 */}
      <polyline
        points={polyPts}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 현재가 점선 */}
      <line
        x1={PAD.left} y1={last.y.toFixed(1)}
        x2={W - PAD.right} y2={last.y.toFixed(1)}
        stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,3"
      />

      {/* 현재가 라벨 */}
      <rect
        x={W - PAD.right + 3} y={last.y - 8}
        width={PAD.right - 5} height={14}
        rx="1" fill="#475569"
      />
      <text
        x={W - PAD.right + 3 + (PAD.right - 5) / 2}
        y={last.y + 3.5}
        textAnchor="middle"
        fontSize="8.5"
        fill="white"
        fontFamily="ui-monospace, 'Cascadia Code', monospace"
        fontWeight="600"
      >
        {fmt(last.p)}
      </text>

      {/* 오픈 진입 가격 라벨 */}
      {entryY !== null && (
        <>
          <rect
            x={W - PAD.right + 3} y={entryY - 7}
            width={PAD.right - 5} height={12}
            rx="1" fill={bandColor} opacity="0.85"
          />
          <text
            x={W - PAD.right + 3 + (PAD.right - 5) / 2}
            y={entryY + 2.5}
            textAnchor="middle"
            fontSize="7.5"
            fill="white"
            fontFamily="ui-monospace, monospace"
            fontWeight="600"
          >
            {fmt(openEntry)}
          </text>
        </>
      )}

      {/* Y축 레이블 */}
      <text x={PAD.left} y={PAD.top - 3} fontSize="7.5" fontFamily="ui-monospace, monospace"
        className="fill-slate-400 dark:fill-slate-600">{fmt(maxP)}</text>
      <text x={PAD.left} y={botY + 12} fontSize="7.5" fontFamily="ui-monospace, monospace"
        className="fill-slate-400 dark:fill-slate-600">{fmt(minP)}</text>
      <text x={PAD.left} y={(PAD.top + botY) / 2 + 3} fontSize="7.5" fontFamily="ui-monospace, monospace"
        className="fill-slate-300 dark:fill-slate-700">{fmt(midP)}</text>

      {/* 진입 마커 ▲ */}
      {entries.map((idx) => {
        const pt = pts[idx]
        if (!pt) return null
        const tx = pt.x
        const ty = pt.y - 3
        return (
          <g key={`e${idx}`}>
            <polygon points={`${tx},${ty} ${tx - 4.5},${ty + 8} ${tx + 4.5},${ty + 8}`} fill="#10b981" />
          </g>
        )
      })}

      {/* 청산 마커 ■ */}
      {exits.map((idx) => {
        const pt = pts[idx]
        if (!pt) return null
        return (
          <rect
            key={`x${idx}`}
            x={pt.x - 3.5} y={pt.y - 8.5}
            width={7} height={7}
            rx="0.5" fill="#f59e0b"
          />
        )
      })}

      {/* 최신 포인트 강조 (현재 위치) */}
      <circle
        cx={last.x.toFixed(1)} cy={last.y.toFixed(1)}
        r="3.5" fill="#3b82f6" stroke="white" strokeWidth="1.5"
      />
    </svg>
  )
}

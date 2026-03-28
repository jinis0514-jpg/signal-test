import { useMemo } from 'react'

const W = 560
const H = 160
const PAD = { top: 16, right: 60, bottom: 22, left: 10 }

function fmt(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  if (Math.abs(x) >= 1000) return x.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

/**
 * @param {object} props
 * @param {{ time:number, open:number, high:number, low:number, close:number, volume?:number }[]} props.candles
 * @param {number[]} props.entries   봉 인덱스 (0-based)
 * @param {number[]} props.exits      봉 인덱스
 * @param {number|null} props.openEntry
 * @param {'LONG'|'SHORT'} props.openDir
 */
export default function CandlestickChart({
  candles = [],
  entries = [],
  exits = [],
  openEntry = null,
  openDir = 'LONG',
}) {
  const layout = useMemo(() => {
    if (!Array.isArray(candles) || candles.length === 0) return null

    let minP = Infinity
    let maxP = -Infinity
    for (const c of candles) {
      minP = Math.min(minP, c.low, c.high)
      maxP = Math.max(maxP, c.low, c.high)
    }
    const span = maxP - minP || 1
    const iW = W - PAD.left - PAD.right
    const iH = H - PAD.top - PAD.bottom
    const n = candles.length
    const slot = iW / n
    const bodyW = Math.max(2, Math.min(slot * 0.62, 11))

    const yAt = (price) => PAD.top + (1 - (price - minP) / span) * iH
    const botY = H - PAD.bottom

    const items = candles.map((c, i) => {
      const cx = PAD.left + (i + 0.5) * slot
      const yOpen = yAt(c.open)
      const yClose = yAt(c.close)
      const yHigh = yAt(c.high)
      const yLow = yAt(c.low)
      const bull = c.close >= c.open
      const top = Math.min(yOpen, yClose)
      const bot = Math.max(yOpen, yClose)
      const bodyH = Math.max(bot - top, 0.75)
      return { cx, yOpen, yClose, yHigh, yLow, bull, top, bot, bodyH, c }
    })

    const last = items[items.length - 1]
    const midP = (minP + maxP) / 2

    return {
      minP,
      maxP,
      span,
      iW,
      iH,
      slot,
      bodyW,
      yAt,
      botY,
      items,
      last,
      midP,
    }
  }, [candles])

  if (!layout) return null

  const { minP, maxP, bodyW, yAt, botY, items, last, midP } = layout

  const lastClose = last.c.close
  const entryY = openEntry != null && Number.isFinite(openEntry) ? yAt(openEntry) : null
  const isProfit =
    openEntry != null && Number.isFinite(openEntry)
      ? openDir === 'LONG'
        ? lastClose > openEntry
        : lastClose < openEntry
      : false
  const bandColor = isProfit ? '#10b981' : '#ef4444'
  const bandTop = entryY != null ? Math.min(entryY, last.yClose) : 0
  const bandHeight = entryY != null ? Math.abs(entryY - last.yClose) : 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full overflow-visible"
      style={{ display: 'block' }}
    >
      {/* 수평 그리드 */}
      {[0.25, 0.5, 0.75].map((f) => {
        const y = PAD.top + f * (H - PAD.top - PAD.bottom)
        return (
          <line
            key={f}
            x1={PAD.left}
            y1={y.toFixed(1)}
            x2={W - PAD.right}
            y2={y.toFixed(1)}
            strokeWidth="1"
            className="stroke-slate-100 dark:stroke-gray-800"
          />
        )
      })}

      <line
        x1={PAD.left}
        y1={botY}
        x2={W - PAD.right}
        y2={botY}
        strokeWidth="0.5"
        className="stroke-slate-200 dark:stroke-gray-700"
      />

      {entryY != null && bandHeight > 0 && (
        <rect
          x={PAD.left}
          y={bandTop.toFixed(1)}
          width={W - PAD.left - PAD.right}
          height={bandHeight.toFixed(1)}
          fill={bandColor}
          opacity="0.08"
        />
      )}

      {entryY != null && (
        <line
          x1={PAD.left}
          y1={entryY.toFixed(1)}
          x2={W - PAD.right}
          y2={entryY.toFixed(1)}
          stroke={bandColor}
          strokeWidth="0.9"
          strokeDasharray="2.5,2.5"
          opacity="0.75"
        />
      )}

      {/* 캔들: 심지 + 몸통 */}
      {items.map((it, i) => {
        const wickStroke = it.bull ? '#059669' : '#dc2626'
        const bodyFill = it.bull ? '#10b981' : '#ef4444'
        const bodyStroke = it.bull ? '#059669' : '#b91c1c'
        const xBody = it.cx - bodyW / 2
        return (
          <g key={`${it.c.time}-${i}`}>
            <line
              x1={it.cx.toFixed(2)}
              y1={it.yHigh.toFixed(2)}
              x2={it.cx.toFixed(2)}
              y2={it.yLow.toFixed(2)}
              stroke={wickStroke}
              strokeWidth="1"
            />
            <rect
              x={xBody.toFixed(2)}
              y={it.top.toFixed(2)}
              width={bodyW.toFixed(2)}
              height={it.bodyH.toFixed(2)}
              fill={bodyFill}
              stroke={bodyStroke}
              strokeWidth="0.6"
              rx="0.5"
            />
          </g>
        )
      })}

      {/* 현재가 점선 (종가) */}
      <line
        x1={PAD.left}
        y1={last.yClose.toFixed(1)}
        x2={W - PAD.right}
        y2={last.yClose.toFixed(1)}
        stroke="#94a3b8"
        strokeWidth="0.8"
        strokeDasharray="3,3"
      />

      <rect
        x={W - PAD.right + 3}
        y={last.yClose - 8}
        width={PAD.right - 5}
        height={14}
        rx="1"
        fill="#475569"
      />
      <text
        x={W - PAD.right + 3 + (PAD.right - 5) / 2}
        y={last.yClose + 3.5}
        textAnchor="middle"
        fontSize="8.5"
        fill="white"
        fontFamily="ui-monospace, 'Cascadia Code', monospace"
        fontWeight="600"
      >
        {fmt(lastClose)}
      </text>

      {entryY != null && (
        <>
          <rect
            x={W - PAD.right + 3}
            y={entryY - 7}
            width={PAD.right - 5}
            height={12}
            rx="1"
            fill={bandColor}
            opacity="0.88"
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

      <text
        x={PAD.left}
        y={PAD.top - 3}
        fontSize="7.5"
        fontFamily="ui-monospace, monospace"
        className="fill-slate-400 dark:fill-slate-600"
      >
        {fmt(maxP)}
      </text>
      <text
        x={PAD.left}
        y={botY + 12}
        fontSize="7.5"
        fontFamily="ui-monospace, monospace"
        className="fill-slate-400 dark:fill-slate-600"
      >
        {fmt(minP)}
      </text>
      <text
        x={PAD.left}
        y={(PAD.top + botY) / 2 + 3}
        fontSize="7.5"
        fontFamily="ui-monospace, monospace"
        className="fill-slate-300 dark:fill-slate-700"
      >
        {fmt(midP)}
      </text>

      {entries.map((idx) => {
        const it = items[idx]
        if (!it) return null
        const ty = it.yClose - 10
        const tx = it.cx
        return (
          <g key={`e${idx}`}>
            <polygon
              points={`${tx},${ty} ${tx - 4.5},${ty + 8} ${tx + 4.5},${ty + 8}`}
              fill="#10b981"
            />
          </g>
        )
      })}

      {exits.map((idx) => {
        const it = items[idx]
        if (!it) return null
        return (
          <rect
            key={`x${idx}`}
            x={it.cx - 3.5}
            y={it.yClose - 8.5}
            width={7}
            height={7}
            rx="0.5"
            fill="#f59e0b"
          />
        )
      })}

      <circle
        cx={last.cx.toFixed(1)}
        cy={last.yClose.toFixed(1)}
        r="3.5"
        fill="#3b82f6"
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  )
}

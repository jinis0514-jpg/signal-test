import { useMemo } from 'react'

function fmtTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function fmtPrice(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function fmtDiff(sec) {
  if (sec == null) return '-'
  const s = Math.abs(Number(sec))
  if (s < 60) return `${s.toFixed(0)}초`
  return `${(s / 60).toFixed(1)}분`
}

export default function TradeComparisonTable({ matches = [], className = '' }) {
  const sorted = useMemo(
    () => [...matches].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [matches],
  )

  if (!sorted.length) {
    return (
      <div className={`text-center py-8 text-slate-400 dark:text-slate-500 text-sm ${className}`}>
        매칭된 거래 데이터가 없습니다
      </div>
    )
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
            <th className="text-left py-2 px-2 font-medium">시그널 시간</th>
            <th className="text-left py-2 px-2 font-medium">실거래 시간</th>
            <th className="text-right py-2 px-2 font-medium">시간차</th>
            <th className="text-center py-2 px-2 font-medium">방향</th>
            <th className="text-right py-2 px-2 font-medium">시그널 가격</th>
            <th className="text-right py-2 px-2 font-medium">체결 가격</th>
            <th className="text-right py-2 px-2 font-medium">가격차(%)</th>
            <th className="text-center py-2 px-2 font-medium">매칭</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const matched = m.is_verified_match
            return (
              <tr
                key={m.id}
                className={`
                  border-b border-slate-100 dark:border-slate-800
                  ${matched
                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 opacity-70'}
                `}
              >
                <td className="py-2 px-2">{fmtTime(m.signal_time)}</td>
                <td className="py-2 px-2">{fmtTime(m.trade_time)}</td>
                <td className="py-2 px-2 text-right">{fmtDiff(m.time_diff_sec)}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`
                    inline-block px-1.5 py-0.5 rounded text-[10px] font-medium
                    ${m.signal_direction === 'LONG'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}
                  `}>
                    {m.signal_direction ?? '-'}
                  </span>
                  {m.side_matched === false && (
                    <span className="ml-1 text-red-400 text-[10px]" title="방향 불일치">✕</span>
                  )}
                </td>
                <td className="py-2 px-2 text-right font-mono">{fmtPrice(m.signal_price)}</td>
                <td className="py-2 px-2 text-right font-mono">{fmtPrice(m.trade_price)}</td>
                <td className={`py-2 px-2 text-right font-mono ${
                  m.price_diff_pct != null && m.price_diff_pct > 0.5
                    ? 'text-amber-600 dark:text-amber-400'
                    : ''
                }`}>
                  {m.price_diff_pct != null ? `${m.price_diff_pct.toFixed(2)}%` : '-'}
                </td>
                <td className="py-2 px-2 text-center">
                  {matched ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">●</span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">○</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { memo } from 'react'
import { cn } from '../../lib/cn'
import { deltaArrow, deltaTextClass } from '../../lib/deltaDisplay'

const Item = memo(function Item({ label, value, change }) {
  const n = Number(change)
  const has = Number.isFinite(n)
  return (
    <div className="rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value ?? '—'}</p>
        <p className={cn('text-[12px] font-mono font-bold tabular-nums', has ? deltaTextClass(n) : 'text-slate-400')}>
          {has && <span className="mr-0.5">{deltaArrow(n)}</span>}
          {has ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—'}
        </p>
      </div>
    </div>
  )
}, (a, b) => a.label === b.label && a.value === b.value && a.change === b.change)

export default memo(function LiveTickerStrip({ items = [], lastUpdatedText = '' }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
        <p className="text-[10px] text-slate-400">{lastUpdatedText ? `업데이트 ${lastUpdatedText}` : ''}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {list.map((it) => (
          <Item key={it.label} label={it.label} value={it.value} change={it.change} />
        ))}
      </div>
    </div>
  )
})

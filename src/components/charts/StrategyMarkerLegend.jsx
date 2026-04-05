import { cn } from '../../lib/cn'

/**
 * 전략별 색상 범례
 * @param {{ strategyKey: string, strategyLabel: string, color: string }[]} props.items
 */
export default function StrategyMarkerLegend({ items = [], className = '' }) {
  const list = Array.isArray(items) ? items.filter((x) => x && x.strategyKey) : []

  if (list.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-slate-400',
          className,
        )}
      >
        표시할 전략이 없습니다
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40',
        className,
      )}
      role="list"
      aria-label="전략 범례"
    >
      {list.map((it) => (
        <div key={String(it.strategyKey)} className="flex items-center gap-2" role="listitem">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-slate-200/80 dark:ring-gray-600"
            style={{ backgroundColor: it.color || '#64748b' }}
            aria-hidden
          />
          <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100">
            {it.strategyLabel || it.strategyKey}
          </span>
        </div>
      ))}
    </div>
  )
}

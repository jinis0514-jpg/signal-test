import { cn } from '../../lib/cn'
import { deltaTextClass, deltaArrow } from '../../lib/deltaDisplay'

export default function StatCard({
  label,
  value,
  sub,
  trend,
  /** 있으면 ▲/▼ + 수치% (색: blue/red/gray) */
  deltaPct,
  className,
  valueClassName,
  labelClassName,
}) {
  const dp = deltaPct != null ? Number(deltaPct) : null
  const showDelta = Number.isFinite(dp)
  const up = trend === 'up'
  const down = trend === 'down'

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-[8px] px-4 py-3',
        'dark:bg-gray-900 dark:border-gray-800',
        'shadow-none',
        className,
      )}
    >
      <p className={cn(
        'text-[10px] font-semibold text-slate-500 dark:text-slate-500 tracking-[0.06em] uppercase mb-1.5',
        labelClassName,
      )}>
        {label}
      </p>

      <div className="flex items-end gap-2 flex-wrap">
        <span className={cn(
          'text-[20px] font-bold text-slate-900 dark:text-slate-100 leading-none tabular-nums',
          valueClassName,
        )}>
          {value}
        </span>
        {trend && showDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[13px] font-bold leading-none tabular-nums',
              deltaTextClass(dp),
            )}
          >
            <span className="select-none" aria-hidden>{deltaArrow(dp)}</span>
            <span>
              {dp > 0 ? '+' : ''}{dp.toFixed(2)}%
            </span>
          </span>
        )}
        {trend && !showDelta && (
          <span
            className={cn(
              'text-[13px] font-bold leading-none',
              up && 'text-emerald-600 dark:text-emerald-400',
              down && 'text-red-600 dark:text-red-400',
              !up && !down && 'text-slate-400',
            )}
            aria-hidden
          >
            {up ? '▲' : down ? '▼' : '—'}
          </span>
        )}
      </div>

      {sub && (
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-500 leading-snug">
          {sub}
        </p>
      )}
    </div>
  )
}

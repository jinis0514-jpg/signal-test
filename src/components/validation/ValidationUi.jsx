import { cn } from '../../lib/cn'

/** 검증·모달 공용 KPI 타일 */
export function KPI({ label, value, type, sub }) {
  const pos = type === 'positive'
  const neg = type === 'negative'
  return (
    <div className="bb-card flex flex-col justify-between min-h-[72px] gap-0.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={cn(
          'text-[15px] sm:text-[16px] font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-100',
          pos && 'text-emerald-600 dark:text-emerald-400',
          neg && 'text-red-600 dark:text-red-400',
        )}
      >
        {value ?? '—'}
      </p>
      {sub ? (
        <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-snug mt-1">{sub}</p>
      ) : null}
    </div>
  )
}

export function InfoBox({ label, value, className = '' }) {
  return (
    <div className={cn('bb-card py-3', className)}>
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{value ?? '—'}</p>
    </div>
  )
}

export function InfoCard({ label, value, className = '' }) {
  return <InfoBox label={label} value={value} className={className} />
}

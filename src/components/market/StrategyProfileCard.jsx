import { cn } from '../../lib/cn'

export default function StrategyProfileCard({
  typeLabel,
  profileLabel,
  summary,
  className,
}) {
  const t = String(typeLabel ?? '—').trim() || '—'
  const p = String(profileLabel ?? '—').trim() || '—'
  const s = String(summary ?? '').trim()

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        Strategy Profile
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-gray-800 dark:text-slate-300">
          {t}
        </span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
          {p}
        </span>
      </div>

      {s && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {s}
        </p>
      )}
    </div>
  )
}

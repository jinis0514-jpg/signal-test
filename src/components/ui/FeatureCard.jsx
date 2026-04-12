import { cn } from '../../lib/cn'

const TONE_STYLES = {
  default: 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/55',
  blue: 'border-blue-300/90 dark:border-blue-700/60 bg-gradient-to-br from-blue-50/95 to-sky-50/70 dark:from-blue-950/45 dark:to-sky-950/25',
  emerald: 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20',
  amber: 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20',
}

const TONE_HOVER = {
  default: 'hover:border-slate-400 dark:hover:border-slate-500 hover:ring-sky-400/35 dark:hover:ring-sky-500/25',
  blue: 'hover:border-blue-400 dark:hover:border-blue-500 hover:ring-blue-400/35 dark:hover:ring-blue-500/25',
  emerald: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:ring-emerald-400/30',
  amber: 'hover:border-amber-400 dark:hover:border-amber-600 hover:ring-amber-400/30',
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = 'default',
  interactive = false,
  className = '',
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3',
        'transition-all duration-200 ease-out shadow-sm',
        TONE_STYLES[tone] ?? TONE_STYLES.default,
        interactive && [
          'hover:-translate-y-1 hover:shadow-lg hover:scale-[1.02]',
          'hover:ring-2',
          TONE_HOVER[tone] ?? TONE_HOVER.default,
        ],
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className="mt-0.5 rounded-lg bg-white/70 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-700/70 p-1.5">
            <Icon size={13} className="text-slate-600 dark:text-slate-300" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">{title}</p>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{description}</p>
        </div>
      </div>
    </div>
  )
}


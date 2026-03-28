import { cn } from '../../lib/cn'

export default function SectionHeader({ title, sub, action, className }) {
  return (
    <div className={cn('flex items-center justify-between mb-1.5', className)}>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight">
          {title}
        </span>
        {sub && (
          <span className="text-[10px] text-slate-400 dark:text-slate-600">{sub}</span>
        )}
      </div>
      {action && <div className="flex items-center gap-1">{action}</div>}
    </div>
  )
}

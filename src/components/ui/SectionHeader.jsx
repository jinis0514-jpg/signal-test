import { cn } from '../../lib/cn'

export default function SectionHeader({ title, sub, action, className }) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          {title}
        </span>
        {sub && (
          <span className="text-[12px] text-slate-500 dark:text-slate-500">{sub}</span>
        )}
      </div>
      {action && <div className="flex items-center gap-1">{action}</div>}
    </div>
  )
}

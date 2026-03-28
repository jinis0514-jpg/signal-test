import { cn } from '../../lib/cn'

export default function PageHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between mb-3 pb-2.5 border-b border-slate-100 dark:border-gray-800',
        className,
      )}
    >
      <div>
        <h1 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-600 leading-snug">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">{action}</div>}
    </div>
  )
}

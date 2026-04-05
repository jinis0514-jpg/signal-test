import { Inbox } from 'lucide-react'
import { cn } from '../../lib/cn'

export default function EmptyState({
  icon,
  title,
  description,
  action,
  bordered = true,
  className,
}) {
  const showIcon = icon ?? <Inbox size={28} strokeWidth={1.2} className="text-slate-300 dark:text-slate-700" />

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[200px] py-10 px-5 text-center rounded-[8px] bg-slate-50/50 dark:bg-gray-900/30',
        bordered &&
          'border border-dashed border-slate-200 dark:border-gray-700',
        className,
      )}
    >
      <span className="text-slate-300 dark:text-slate-700 mb-3 flex items-center justify-center [&>svg]:text-slate-400 dark:[&>svg]:text-slate-600">
        {showIcon}
      </span>
      {title && (
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
          {title}
        </p>
      )}
      {description && (
        <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-500 max-w-[280px] leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-3 [&_button]:min-h-[24px] [&_button]:px-2.5 [&_button]:text-[11px] [&_button]:font-semibold">
          {action}
        </div>
      )}
    </div>
  )
}

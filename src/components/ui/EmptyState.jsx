import { cn } from '../../lib/cn'

export default function EmptyState({
  icon,
  title,
  description,
  action,
  bordered = true,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 px-4 text-center',
        bordered &&
          'border border-dashed border-slate-200 rounded-[2px] dark:border-gray-700',
        className,
      )}
    >
      {icon && (
        <span className="text-slate-300 dark:text-slate-700 mb-2 flex items-center justify-center">
          {icon}
        </span>
      )}
      {title && (
        <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-500">
          {title}
        </p>
      )}
      {description && (
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-600 max-w-[260px]">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

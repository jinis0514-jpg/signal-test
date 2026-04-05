import { cn } from '../../lib/cn'

export default function PageHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between mb-8 pb-5 border-b border-slate-200 dark:border-gray-800',
        className,
      )}
    >
      <div>
        <h1 className="text-xl sm:text-[22px] font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0 ml-4">{action}</div>}
    </div>
  )
}

import { cn } from '../../lib/cn'

export default function Input({ className, icon, ...props }) {
  const base =
    'h-6 w-full bg-white text-[11px] text-slate-700 placeholder:text-slate-350 ' +
    'border border-slate-200 rounded-[1px] ' +
    'focus:outline-none focus:border-slate-400 focus:ring-0 ' +
    'dark:bg-gray-900 dark:text-slate-300 dark:border-gray-700 dark:focus:border-gray-500 ' +
    'transition-colors duration-100'

  if (icon) {
    return (
      <div className="relative flex items-center">
        <span className="absolute left-2 text-slate-400 pointer-events-none flex items-center">
          {icon}
        </span>
        <input className={cn(base, 'pl-6 pr-2', className)} {...props} />
      </div>
    )
  }

  return <input className={cn(base, 'px-2', className)} {...props} />
}

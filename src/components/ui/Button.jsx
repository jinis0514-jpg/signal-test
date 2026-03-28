import { cn } from '../../lib/cn'

/* primary는 near-black으로 — Bloomberg/CryptoQuant 계열 정석 */
const VARIANTS = {
  primary:
    'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 hover:border-slate-800 ' +
    'dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 dark:hover:bg-white',
  secondary:
    'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 ' +
    'dark:bg-gray-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-gray-800',
  ghost:
    'bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700 ' +
    'dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300',
  danger:
    'bg-red-700 text-white border-red-700 hover:bg-red-800 hover:border-red-800 ' +
    'dark:bg-red-800 dark:border-red-800',
}

const SIZES = {
  sm: 'h-5  px-2    text-[10px] gap-1',
  md: 'h-6  px-2.5  text-[11px] gap-1',
  lg: 'h-7  px-3    text-[12px] gap-1.5',
}

const BASE =
  'inline-flex items-center justify-center font-semibold ' +
  'border rounded-[1px] ' +
  'transition-colors duration-100 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ' +
  'focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:ring-offset-1'

export default function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </button>
  )
}

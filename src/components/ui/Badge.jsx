import { cn } from '../../lib/cn'

/* 채도 낮춤 — 경계선 기반, 배경 거의 흰색 */
const VARIANTS = {
  default: 'bg-slate-50    text-slate-500   border-slate-200',
  success: 'bg-emerald-50/60 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50/60  text-amber-700   border-amber-100',
  danger:  'bg-red-50/60    text-red-700     border-red-100',
  info:    'bg-blue-50/60   text-blue-700    border-blue-100',
}

const BASE =
  'inline-flex items-center h-[16px] px-1.5 ' +
  'text-[10px] font-semibold tracking-wide ' +
  'border rounded-[1px] whitespace-nowrap'

export default function Badge({ variant = 'default', className, children }) {
  return (
    <span className={cn(BASE, VARIANTS[variant], className)}>
      {children}
    </span>
  )
}

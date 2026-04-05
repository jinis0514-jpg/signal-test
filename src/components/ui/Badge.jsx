import { cn } from '../../lib/cn'

/*
 * 역할 분리: primary=blue(행동·정보), positive=green(긍정·수익 관련 라벨),
 * long=blue(LONG), short=red(SHORT), stable=green(안정), risk=red(위험)
 */
const VARIANTS = {
  default: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-gray-800/80 dark:text-slate-400 dark:border-gray-700',
  /** 긍정·추천·성공 상태 (초록) */
  success:
    'bg-emerald-50/95 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
  warning: 'bg-amber-50/80 text-amber-800 border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40',
  danger:  'bg-red-50/90 text-red-700 border-red-100 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/50',
  info:    'bg-blue-50/90 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
  long:    'bg-blue-50/90 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
  short:   'bg-red-50/90 text-red-700 border-red-100 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/50',
  wait:    'bg-slate-100 text-slate-500 border-slate-200 dark:bg-gray-800 dark:text-slate-400 dark:border-gray-700',
  /** 안정 (초록) */
  stable:  'bg-emerald-50/90 text-emerald-800 border-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-300 dark:border-emerald-900/45',
  caution: 'bg-amber-50/80 text-amber-800 border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40',
  risk:    'bg-red-50/90 text-red-700 border-red-100 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/50',
}

const BASE =
  'inline-flex items-center min-h-[24px] px-2.5 ' +
  'text-[11px] font-semibold tracking-wide ' +
  'border rounded-full whitespace-nowrap'

export default function Badge({ variant = 'default', className, children }) {
  return (
    <span className={cn(BASE, VARIANTS[variant] ?? VARIANTS.default, className)}>
      {children}
    </span>
  )
}

export function dirVariant(dir) {
  const d = typeof dir === 'string' ? dir.toUpperCase() : ''
  if (d === 'LONG' || d === 'BUY')   return 'long'
  if (d === 'SHORT' || d === 'SELL') return 'short'
  return 'wait'
}

export function riskVariant(status) {
  if (status === '위험') return 'risk'
  if (status === '주의') return 'caution'
  if (status === '안정') return 'stable'
  return 'default'
}

/** 마켓 리스크 라벨: 안정 / 보통 / 위험 */
export function riskMarketVariant(label) {
  if (label === '위험') return 'risk'
  if (label === '보통') return 'caution'
  if (label === '안정') return 'stable'
  return 'default'
}

/** 양수 PnL → 초록, 음수 → 빨강 */
export function pnlClass(value) {
  if (!Number.isFinite(Number(value))) return 'text-slate-400 dark:text-slate-500'
  return Number(value) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

export function dirTextClass(dir) {
  const d = typeof dir === 'string' ? dir.toUpperCase() : ''
  if (d === 'LONG' || d === 'BUY')   return 'text-blue-600 dark:text-blue-400'
  if (d === 'SHORT' || d === 'SELL') return 'text-red-600 dark:text-red-400'
  return 'text-slate-400 dark:text-slate-500'
}

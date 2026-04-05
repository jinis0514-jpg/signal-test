/**
 * PageShell — 페이지 공통 래퍼
 * - PC 최적화 기준 max-width + 중앙 집중형 레이아웃
 * - wide prop: 1400px (기본 1280px)
 */
import { cn } from '../../lib/cn'

export default function PageShell({ children, wide = false, className = '' }) {
  return (
    <div className={cn(
      'mx-auto w-full px-5 py-5 sm:px-6 sm:py-6',
      wide ? 'max-w-[1400px]' : 'max-w-[1280px]',
      className,
    )}>
      {children}
    </div>
  )
}

export function Placeholder({ label, height = 'h-24', className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-lg p-4 ${className}`}>
      <p className="text-[12px] font-bold tracking-[0.1em] text-slate-400 dark:text-gray-600 uppercase mb-2">
        {label}
      </p>
      <div className={`${height} bg-slate-50/50 dark:bg-gray-800/40 border border-dashed border-slate-200 dark:border-gray-700/60 rounded-[8px] flex items-center justify-center`}>
        <span className="text-[12px] text-slate-300 dark:text-gray-700">—</span>
      </div>
    </div>
  )
}

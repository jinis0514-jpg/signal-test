import { cn } from '../../lib/cn'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatCard({ label, value, sub, trend, className }) {
  const isUp   = trend === 'up'
  const isDown = trend === 'down'

  return (
    <div
      className={cn(
        'bg-white border border-slate-100 rounded-[2px] px-3 py-2',
        'dark:bg-gray-900 dark:border-gray-800',
        className,
      )}
    >
      {/* 라벨 */}
      <p className="text-[10px] font-medium text-slate-400 dark:text-slate-600 tracking-wide uppercase mb-1">
        {label}
      </p>

      {/* 메인 값 + 추세 */}
      <div className="flex items-end gap-1.5">
        <span className="text-[16px] font-bold text-slate-900 dark:text-slate-100 leading-none tabular-nums">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[10px] font-semibold leading-none mb-[1px]',
              isUp   && 'text-emerald-600',
              isDown && 'text-red-600',
              !isUp && !isDown && 'text-slate-400',
            )}
          >
            {isUp   && <TrendingUp   size={10} strokeWidth={2} />}
            {isDown && <TrendingDown size={10} strokeWidth={2} />}
          </span>
        )}
      </div>

      {/* 보조 설명 */}
      {sub && (
        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-600 leading-snug">
          {sub}
        </p>
      )}
    </div>
  )
}

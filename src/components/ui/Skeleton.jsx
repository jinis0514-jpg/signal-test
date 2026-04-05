import { cn } from '../../lib/cn'

/**
 * 미니멀 스켈레톤 — pulse만, 색은 기존 톤 유지
 */
export default function Skeleton({ className, rounded = 'rounded-[8px]' }) {
  return (
    <div
      className={cn(
        'bg-slate-100 dark:bg-gray-800 animate-pulse',
        'transition-opacity duration-[120ms]',
        rounded,
        className,
      )}
      aria-hidden
    />
  )
}

export function ChartSkeleton({ className }) {
  return (
    <div className={cn('flex flex-col gap-2 h-full min-h-[160px] p-2', className)}>
      <div className="flex justify-between gap-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-2 w-24" />
      </div>
      <Skeleton className="flex-1 min-h-[120px] w-full rounded-md" />
      <div className="flex gap-1 justify-end">
        <Skeleton className="h-1.5 w-8" />
        <Skeleton className="h-1.5 w-8" />
        <Skeleton className="h-1.5 w-8" />
      </div>
    </div>
  )
}

export function StrategyCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[8px] shadow-none flex flex-col overflow-hidden">
      <div className="p-4 space-y-3">
        {/* 상단: 이름 + 배지 */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-3/4 max-w-[240px]" />
            <Skeleton className="h-3 w-1/2 max-w-[140px] mt-2" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>

        {/* 핵심 수치 영역 */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-800 overflow-hidden">
          <div className="flex">
            <div className="flex-1 p-3">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-6 w-20 mt-2" />
            </div>
            <div className="w-px bg-slate-100 dark:bg-gray-800" />
            <div className="flex">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 w-[72px]">
                  <Skeleton className="h-2.5 w-10" />
                  <Skeleton className="h-4 w-12 mt-2" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 보조 정보 */}
        <Skeleton className="h-2.5 w-2/3 max-w-[260px]" />
        <Skeleton className="h-3 w-full" />
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100 dark:border-gray-800 flex justify-end gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-24" />
      </div>
    </div>
  )
}

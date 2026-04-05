import { AlertCircle } from 'lucide-react'
import { cn } from '../../lib/cn'
import Button from './Button'

/**
 * 제품형 에러 블록 — 페이지 전체 대신 섹션 단위로 사용
 */
export default function ErrorState({
  title = '문제가 발생했습니다',
  description,
  onRetry,
  retryLabel = '다시 시도',
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-[8px] border border-red-200 dark:border-red-900/40',
        'bg-red-50/80 dark:bg-red-950/20 px-5 py-8 min-h-[160px]',
        className,
      )}
    >
      <AlertCircle className="text-red-500 dark:text-red-400 mb-3 shrink-0" size={28} strokeWidth={1.5} aria-hidden />
      <p className="text-[13px] font-semibold text-red-900 dark:text-red-200">{title}</p>
      {description && (
        <p className="mt-1.5 text-[12px] text-red-800/90 dark:text-red-300/90 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {onRetry && (
        <div className="mt-4">
          <Button variant="secondary" size="md" type="button" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

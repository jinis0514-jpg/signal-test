import Button from '../ui/Button'
import { cn } from '../../lib/cn'

/**
 * 플랜 제한 구역 — 허용 시 children, 아니면 안내 + 업그레이드 CTA
 */
export default function LockedSection({
  isAllowed,
  title,
  description,
  onUpgrade,
  upgradeLabel = '구독 시작하기',
  children,
  className,
}) {
  if (isAllowed) return children

  return (
    <div
      className={cn(
        'rounded-[10px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center',
        'dark:border-gray-700 dark:bg-gray-900/40',
        className,
      )}
    >
      <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {typeof onUpgrade === 'function' && (
        <Button variant="primary" size="md" className="mt-4" type="button" onClick={onUpgrade}>
          {upgradeLabel}
        </Button>
      )}
    </div>
  )
}

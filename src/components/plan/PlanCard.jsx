import { Check } from 'lucide-react'
import Button from '../ui/Button'
import { cn } from '../../lib/cn'

export default function PlanCard({
  title,
  subtitle,
  priceLabel,
  periodLabel = '',
  features = [],
  recommended = false,
  ctaLabel = '선택',
  onCta,
  ctaDisabled = false,
  ctaLoading = false,
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-[10px] border bg-white p-5 shadow-none transition-colors',
        'dark:bg-gray-900/60',
        recommended
          ? 'border-[#2962ff]/50 ring-1 ring-[#2962ff]/25 dark:border-[#2962ff]/40'
          : 'border-slate-200 dark:border-gray-700',
      )}
    >
      {recommended && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#2962ff] px-2.5 py-0.5 text-[10px] font-bold text-white">
          추천
        </span>
      )}
      <div className="mb-4">
        <h3 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-baseline gap-1">
          <span className="text-[22px] font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {priceLabel}
          </span>
          {periodLabel ? (
            <span className="text-[13px] text-slate-500 dark:text-slate-400">{periodLabel}</span>
          ) : null}
        </p>
      </div>

      <ul className="mb-6 flex-1 space-y-2.5">
        {features.map((item, idx) => (
          <li key={idx} className="flex gap-2 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2962ff]" strokeWidth={2.2} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <Button
        variant="primary"
        size="md"
        className="w-full justify-center"
        onClick={onCta}
        disabled={ctaDisabled}
        loading={ctaLoading}
        type="button"
      >
        {ctaLabel}
      </Button>
    </div>
  )
}

import { cn } from '../lib/cn'

/** Lab 대신 쓸 수 있는 워드마크 접미어 */
export const LOGO_BRANDS = {
  lab: 'SignalLab',
  market: 'SignalMarket',
  signals: 'SignalSignals',
  core: 'SignalCore',
}

/**
 * Signal* 워드마크 — 미니멀 라인 + 포인트 (#2563eb)
 */
export default function Logo({
  className = '',
  size = 28,
  textClassName,
  brand = 'lab',
}) {
  const s = Number(size) || 28
  const label =
    typeof brand === 'string' && LOGO_BRANDS[brand] != null
      ? LOGO_BRANDS[brand]
      : LOGO_BRANDS.lab

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden
      >
        <path
          d="M4 16L10 10L14 14L20 6"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="6" r="2" fill="#2563eb" />
      </svg>
      <span
        className={cn(
          'font-medium tracking-wide text-slate-900 dark:text-slate-100',
          textClassName,
        )}
      >
        {label}
      </span>
    </div>
  )
}

import { cn } from '../../lib/cn'

/**
 * 1차 브랜드 심볼: 상승 라인 + 체크(검증) — 단순·데이터 톤, 금색 코인 느낌 지양
 */
export default function BrandLogo({ className = '', size = 28 }) {
  const s = Number(size) || 28
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" className="fill-slate-900 dark:fill-white" />
      <path
        d="M7 20 L12 15 L16 19 L25 10"
        stroke="white"
        className="dark:stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 10 h3 v3"
        stroke="white"
        className="dark:stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9 22 L11 24 L15 20"
        stroke="#38bdf8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

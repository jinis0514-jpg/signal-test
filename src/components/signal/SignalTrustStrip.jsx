import { cn } from '../../lib/cn'

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return `${Math.round(Number(v))}%`
}

/**
 * 시그널 판단용 한 줄 지표 — 신뢰도 / 최근 성공률 / 매칭률
 */
export default function SignalTrustStrip({
  trustPct,
  recentSuccessPct,
  matchPct,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-2.5 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20',
        className,
      )}
      role="status"
      aria-label="시그널 신뢰도 요약"
    >
      <span className="text-[11px] tabular-nums">
        <span className="text-slate-500 dark:text-slate-400">신뢰도</span>
        {' '}
        <span className="font-bold text-emerald-800 dark:text-emerald-300">{fmtPct(trustPct)}</span>
      </span>
      <span className="text-slate-300 dark:text-slate-600 select-none" aria-hidden>·</span>
      <span className="text-[11px] tabular-nums">
        <span className="text-slate-500 dark:text-slate-400">최근 성공률</span>
        {' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtPct(recentSuccessPct)}</span>
      </span>
      <span className="text-slate-300 dark:text-slate-600 select-none" aria-hidden>·</span>
      <span className="text-[11px] tabular-nums">
        <span className="text-slate-500 dark:text-slate-400">매칭률</span>
        {' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtPct(matchPct)}</span>
      </span>
    </div>
  )
}

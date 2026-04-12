import { cn } from '../../lib/cn'
import { panelBase, panelSoft } from '../../lib/panelStyles'

/**
 * 전략별 진입 근거 · 목표/손절 거리 (멀티 모니터용)
 * @param {Array<{
 *   strategyKey: string,
 *   strategyLabel?: string,
 *   color?: string,
 *   reasons?: string[],
 *   positionLabel?: string,
 *   currentPnl?: string | null,
 *   tpDistance?: string | null,
 *   slDistance?: string | null,
 *   confidenceScore?: number | null,
 * }>} props.items
 */
export default function SignalReasonPanel({ items = [], title = '진입 근거 · 현재 상태', className = '' }) {
  const list = Array.isArray(items) ? items.filter((x) => x && x.strategyKey != null) : []

  if (list.length === 0) {
    return (
      <div
        className={cn(
          panelSoft,
          'px-4 py-5 text-[13px] text-slate-500 dark:text-slate-400',
          className,
        )}
      >
        진입 근거 없음
      </div>
    )
  }

  return (
    <div
      className={cn(
        panelBase,
        'px-4 py-4',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
      {list.map((item) => {
        const reasons = Array.isArray(item.reasons) ? item.reasons.filter(Boolean) : []
        const hasMeta = item.positionLabel || item.currentPnl || item.tpDistance || item.slDistance
        return (
          <div key={String(item.strategyKey)} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b border-slate-100 last:border-0 dark:border-gray-800">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {item.color && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                )}
                <strong className="text-[13px] text-slate-900 dark:text-slate-100 truncate">
                  {item.strategyLabel ?? item.strategyKey}
                </strong>
              </div>
              {item.currentPnl != null && item.currentPnl !== '' && (
                <span
                  className={cn(
                    'text-[12px] font-bold tabular-nums shrink-0',
                    String(item.currentPnl).includes('-') ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {item.currentPnl}
                </span>
              )}
            </div>

            {hasMeta && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2 text-[11px]">
                {item.positionLabel && (
                  <div className="rounded-[6px] border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 dark:border-gray-800 dark:bg-gray-800/40">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">포지션</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{item.positionLabel}</p>
                  </div>
                )}
                {item.tpDistance != null && item.tpDistance !== '' && (
                  <div className="rounded-[6px] border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 dark:border-gray-800 dark:bg-gray-800/40">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">익절까지 (가격 대비)</p>
                    <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{item.tpDistance}</p>
                  </div>
                )}
                {item.slDistance != null && item.slDistance !== '' && (
                  <div className="rounded-[6px] border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 dark:border-gray-800 dark:bg-gray-800/40">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">손절까지 (가격 대비)</p>
                    <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">{item.slDistance}</p>
                  </div>
                )}
              </div>
            )}

            {reasons.length === 0 ? (
              <p className="text-[12px] text-slate-500 pl-1">이 전략은 아직 근거 태그가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {reasons.map((reason, idx) => (
                  <span
                    key={`${item.strategyKey}-${idx}`}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-slate-200"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
            {Number.isFinite(Number(item.confidenceScore)) && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                충족도 {Number(item.confidenceScore)}%
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

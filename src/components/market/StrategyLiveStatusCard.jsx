import { useMemo } from 'react'
import { cn } from '../../lib/cn'
import { panelEmphasis } from '../../lib/panelStyles'
import {
  getStrategyLiveState,
  strategyLiveToneClasses,
  suitabilityToneClasses,
} from '../../lib/strategyLiveState'

/** emphasis: 핵심 판단 카드(파란 틴트) — 상세 모달 상단에서만 사용 */
export default function StrategyLiveStatusCard({ strategy, live: liveProp, emphasis = false, className }) {
  const live = useMemo(
    () => liveProp ?? getStrategyLiveState(strategy),
    [liveProp, strategy],
  )
  const tc = strategyLiveToneClasses(live.tone)

  return (
    <div
      className={cn(
        emphasis
          ? cn(panelEmphasis, 'p-4')
          : cn('rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-900', tc.border),
        className,
      )}
    >
      <p className={cn('text-[11px] uppercase tracking-[0.18em]', emphasis ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400')}>
        Live Status
      </p>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-base font-semibold', tc.title)}>
            {live.label}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {live.detail}
          </p>
          {live.flags?.length > 0 && (
            <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              {live.flags.join(' · ')}
            </p>
          )}
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', tc.pill)}>
          {live.pill}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>
          최근 진입:
          {' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">{live.lastEntryText}</span>
        </span>
        <span>
          최근 종료:
          {' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">{live.lastExitText}</span>
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/40">
        <p className={cn('text-[11px] font-semibold', suitabilityToneClasses(live.suitabilityTone))}>
          {live.suitabilityLabel}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
          {live.suitabilityDetail}
        </p>
      </div>

      {live.historyHint && (
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          최근 흐름:
          {' '}
          {live.historyHint}
        </p>
      )}
    </div>
  )
}

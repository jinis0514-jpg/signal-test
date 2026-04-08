import { cn } from '../../lib/cn'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { CTA_CONFIG, RECOMMEND_CONFIG, STRATEGY_STATUS_CONFIG } from '../../lib/strategyStatus'
import {
  isMarketLocked,
  PLAN_MESSAGES,
  UPSELL_COPY,
  resolveSimIdForUnlock,
  getStrategyAccessUpsellMessage,
  isSubscriptionLimitExceeded,
} from '../../lib/userPlan'
import VerificationBadge from '../verification/VerificationBadge'

/* 열 너비 — 헤더·데이터 행 공유 */
const COL = {
  name:   'flex-1 min-w-0',
  roi:    'w-[56px] flex-shrink-0 text-right',
  win:    'w-[50px] flex-shrink-0 text-right',
  mdd:    'w-[50px] flex-shrink-0 text-right',
  trades: 'w-[44px] flex-shrink-0 text-right',
  verify: 'w-[64px] flex-shrink-0',
  status: 'w-[44px] flex-shrink-0',
  rec:    'w-[40px] flex-shrink-0',
  action: 'w-[80px] flex-shrink-0 text-right',
}

const H = 'text-[11px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest'

function fmtRet(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function TableRow({ strategy, onDetail, user, onStartTrial, onSimulate, onGoSubscription, onSubscribe }) {
  const cta       = CTA_CONFIG[strategy.ctaStatus]          ?? CTA_CONFIG.not_started
  const recCfg    = RECOMMEND_CONFIG[strategy.recommendBadge]
  const statusCfg = STRATEGY_STATUS_CONFIG[strategy.status]
  const ret = strategy.totalReturnPct ?? strategy.roi
  const mdd = strategy.maxDrawdown ?? Math.abs(strategy.mdd ?? 0)
  const tc = strategy.tradeCount ?? strategy.trades ?? 0
  const locked = isMarketLocked(strategy.id, user)
  const lockHint = locked
    ? (getStrategyAccessUpsellMessage(strategy.id, user) ?? PLAN_MESSAGES.marketMoreStrategies)
    : ''
  const subscribeLimitReached = isSubscriptionLimitExceeded(user?.unlockedStrategyIds, user)
  const isMethod = String(strategy?.type ?? 'signal') === 'method'

  return (
    <div
      className="
        flex items-center gap-3 px-3 py-2.5
        border-b last:border-b-0 border-slate-50 dark:border-gray-800/50
        hover:bg-slate-50/40 dark:hover:bg-gray-800/20
        cursor-pointer transition-colors
      "
      onClick={() => onDetail(strategy)}
      role="row"
    >
      {/* 전략명 + 유형 */}
      <div className={cn(COL.name, 'flex items-baseline gap-1.5 min-w-0')}>
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">
          {strategy.name}
        </span>
        <span className="text-[12px] text-slate-400 whitespace-nowrap hidden xl:block">
          {strategy.typeLabel}{!isMethod && strategy.strategyTypeLabel ? ` · ${strategy.strategyTypeLabel}` : ''}
        </span>
      </div>

      {/* 수익률 */}
      <div className={COL.roi}>
        <span
          className={cn(
            'text-[13px] font-semibold tabular-nums',
            ret >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
          )}
        >
          {fmtRet(ret)}
        </span>
      </div>

      {/* Win% */}
      <div className={COL.win}>
        <span className="text-[13px] text-slate-600 dark:text-slate-400 tabular-nums">
          {Number(strategy.winRate ?? 0).toFixed(1)}%
        </span>
      </div>

      {/* 낙폭 */}
      <div className={COL.mdd}>
        <span className="text-[13px] text-red-600 tabular-nums">{mdd.toFixed(1)}%</span>
      </div>

      {/* 거래 수 */}
      <div className={COL.trades}>
        <span className="text-[12px] text-slate-400 tabular-nums">{tc}</span>
      </div>

      {/* 인증 */}
      <div className={COL.verify}>
        <VerificationBadge
          level={strategy.verified_badge_level ?? 'backtest_only'}
          size="xs"
          showLabel={false}
        />
      </div>

      {/* 상태 */}
      <div className={COL.status}>
        {statusCfg
          ? <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </div>

      {/* 추천 */}
      <div className={COL.rec}>
        {recCfg
          ? <Badge variant={recCfg.variant}>{recCfg.label}</Badge>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </div>

      {/* 액션 */}
      <div className={COL.action} onClick={(e) => e.stopPropagation()}>
        {locked ? (
          <div className="flex flex-col items-end gap-1" title={lockHint}>
            <Button
              variant="primary"
              size="sm"
              disabled={subscribeLimitReached}
              onClick={() => (onSubscribe ?? onGoSubscription)?.()}
            >
              {UPSELL_COPY.ctaSubscribe}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onStartTrial?.(resolveSimIdForUnlock(strategy) || strategy.id)}
            >
              {UPSELL_COPY.ctaTrialShort}
            </Button>
          </div>
        ) : typeof onSimulate === 'function' ? (
          <Button variant={cta.variant} size="sm" onClick={() => onSimulate(strategy)}>
            {isMethod ? '실행' : '시그널'}
          </Button>
        ) : (
          <span className="text-[10px] text-slate-400 tabular-nums">—</span>
        )}
      </div>
    </div>
  )
}

export default function StrategyTable({ strategies, onDetail, user, onStartTrial, onSimulate, onGoSubscription, onSubscribe }) {
  return (
    <div className="border border-slate-100 dark:border-gray-800 rounded-md overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50/40 dark:bg-gray-800/20">
        <span className={cn(COL.name,   H)}>전략명</span>
        <span className={cn(COL.roi,    H)}>수익</span>
        <span className={cn(COL.win,    H)}>Win%</span>
        <span className={cn(COL.mdd,    H)}>MDD</span>
        <span className={cn(COL.trades, H)}>거래</span>
        <span className={cn(COL.verify, H)}>인증</span>
        <span className={cn(COL.status, H)}>상태</span>
        <span className={cn(COL.rec,    H)}>추천</span>
        <span className={cn(COL.action, H)}>액션</span>
      </div>

      {strategies.map((s) => (
        <TableRow
          key={s.id}
          strategy={s}
          onDetail={onDetail}
          user={user}
          onStartTrial={onStartTrial}
          onSimulate={onSimulate}
          onGoSubscription={onGoSubscription}
          onSubscribe={onSubscribe}
        />
      ))}
    </div>
  )
}

import { cn } from '../../lib/cn'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { CTA_CONFIG, RECOMMEND_CONFIG, STRATEGY_STATUS_CONFIG } from '../../lib/strategyStatus'

/* 열 너비 — 헤더·데이터 행 공유 */
const COL = {
  name:   'flex-1 min-w-0',
  roi:    'w-[56px] flex-shrink-0 text-right',
  win:    'w-[50px] flex-shrink-0 text-right',
  mdd:    'w-[50px] flex-shrink-0 text-right',
  trades: 'w-[44px] flex-shrink-0 text-right',
  status: 'w-[44px] flex-shrink-0',
  rec:    'w-[40px] flex-shrink-0',
  action: 'w-[68px] flex-shrink-0 text-right',
}

const H = 'text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest'

function TableRow({ strategy, onDetail }) {
  const cta       = CTA_CONFIG[strategy.ctaStatus]          ?? CTA_CONFIG.not_started
  const recCfg    = RECOMMEND_CONFIG[strategy.recommendBadge]
  const statusCfg = STRATEGY_STATUS_CONFIG[strategy.status]

  return (
    <div
      className="
        flex items-center gap-2 px-3 py-1.5
        border-b last:border-b-0 border-slate-50 dark:border-gray-800/50
        hover:bg-slate-50/40 dark:hover:bg-gray-800/20
        cursor-pointer transition-colors
      "
      onClick={() => onDetail(strategy)}
      role="row"
    >
      {/* 전략명 + 유형 */}
      <div className={cn(COL.name, 'flex items-baseline gap-1.5 min-w-0')}>
        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
          {strategy.name}
        </span>
        <span className="text-[10px] text-slate-400 whitespace-nowrap hidden xl:block">
          {strategy.typeLabel}
        </span>
      </div>

      {/* ROI */}
      <div className={COL.roi}>
        <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">
          +{strategy.roi}%
        </span>
      </div>

      {/* Win% */}
      <div className={COL.win}>
        <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
          {strategy.winRate}%
        </span>
      </div>

      {/* MDD */}
      <div className={COL.mdd}>
        <span className="text-[11px] text-red-600 tabular-nums">{strategy.mdd}%</span>
      </div>

      {/* 거래 수 */}
      <div className={COL.trades}>
        <span className="text-[10px] text-slate-400 tabular-nums">{strategy.trades}</span>
      </div>

      {/* 상태 */}
      <div className={COL.status}>
        {statusCfg
          ? <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          : <span className="text-[10px] text-slate-300">—</span>
        }
      </div>

      {/* 추천 */}
      <div className={COL.rec}>
        {recCfg
          ? <Badge variant={recCfg.variant}>{recCfg.label}</Badge>
          : <span className="text-[10px] text-slate-300">—</span>
        }
      </div>

      {/* 액션 — 버튼 1개만 */}
      <div className={COL.action} onClick={(e) => e.stopPropagation()}>
        <Button variant={cta.variant} size="sm">
          {cta.label}
        </Button>
      </div>
    </div>
  )
}

export default function StrategyTable({ strategies, onDetail }) {
  return (
    <div className="border border-slate-100 dark:border-gray-800 rounded-[1px] overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-slate-100 dark:border-gray-800 bg-slate-50/40 dark:bg-gray-800/20">
        <span className={cn(COL.name,   H)}>전략명</span>
        <span className={cn(COL.roi,    H)}>ROI</span>
        <span className={cn(COL.win,    H)}>Win%</span>
        <span className={cn(COL.mdd,    H)}>MDD</span>
        <span className={cn(COL.trades, H)}>거래</span>
        <span className={cn(COL.status, H)}>상태</span>
        <span className={cn(COL.rec,    H)}>추천</span>
        <span className={cn(COL.action, H)}>액션</span>
      </div>

      {strategies.map((s) => (
        <TableRow key={s.id} strategy={s} onDetail={onDetail} />
      ))}
    </div>
  )
}

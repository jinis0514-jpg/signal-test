import { useState } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '../../lib/cn'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { CTA_CONFIG, RECOMMEND_CONFIG, STRATEGY_STATUS_CONFIG } from '../../lib/strategyStatus'

/* 수치 셀 — 레이블 위, 값 아래 */
function StatCell({ label, value, positive, negative }) {
  return (
    <div className="flex flex-col items-center py-1">
      <span className="text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-wide mb-[2px]">
        {label}
      </span>
      <span
        className={cn(
          'text-[11px] font-bold tabular-nums leading-none',
          positive && 'text-emerald-600',
          negative && 'text-red-600',
          !positive && !negative && 'text-slate-700 dark:text-slate-300',
        )}
      >
        {value}
      </span>
    </div>
  )
}

export default function StrategyCard({ strategy, onDetail, onSimulate, isLocked, onStartTrial, isUserStrategy = false }) {
  const [lockedHint, setLockedHint] = useState(false)

  const cta       = CTA_CONFIG[strategy.ctaStatus]          ?? CTA_CONFIG.not_started
  const recCfg    = RECOMMEND_CONFIG[strategy.recommendBadge]
  const statusCfg = STRATEGY_STATUS_CONFIG[strategy.status]

  function handleCardClick() {
    if (isLocked) { setLockedHint(true); return }
    onDetail?.()
  }

  return (
    <Card className="flex flex-col">

      {/* 클릭 가능한 상단 콘텐츠 */}
      <div
        className="flex-1 cursor-pointer hover:bg-slate-50/40 dark:hover:bg-gray-800/20 transition-colors"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      >
        <div className="p-2.5">
          {/* 배지 행 */}
          <div className="flex items-center gap-1 mb-1 flex-wrap">
              {strategy.isMock && <Badge variant="default">MOCK</Badge>}
              {strategy.isDbStrategy && <Badge variant="info">DB</Badge>}
            {isUserStrategy && <Badge variant="info">내 전략</Badge>}
            {!isUserStrategy && recCfg && <Badge variant={recCfg.variant}>{recCfg.label}</Badge>}
            <Badge variant="default">{strategy.typeLabel}</Badge>
            {!isUserStrategy && statusCfg && <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>}
            {/* 최근 7일 수익률 배지 */}
            {strategy.roi7d != null && (
              <Badge variant={strategy.roi7d >= 0 ? 'success' : 'danger'}>
                7일 {strategy.roi7d >= 0 ? '+' : ''}{strategy.roi7d}%
              </Badge>
            )}
            {isLocked && (
              <Badge variant="default">
                <Lock size={8} className="mr-0.5 inline-block" />
                잠금
              </Badge>
            )}
          </div>

          {/* 전략명 + 저자 */}
          <p className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            {strategy.name}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-600 mb-2">
            {strategy.author}
          </p>

          {/* 통계 3분할 — locked 시 블러 오버레이 */}
          <div className="relative grid grid-cols-3 divide-x divide-slate-100 dark:divide-gray-800 border border-slate-100 dark:border-gray-800 rounded-[1px] mb-1.5">
            {isLocked && (
              <div className="absolute inset-0 z-10 rounded-[1px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-[3px] flex items-center justify-center gap-1.5">
                <Lock size={9} className="text-slate-400 flex-shrink-0" />
                <span className="text-[9px] text-slate-500 font-medium">구독 시 이용 가능</span>
              </div>
            )}
            <StatCell label="ROI"  value={`+${strategy.roi}%`}    positive />
            <StatCell label="Win%" value={`${strategy.winRate}%`}            />
            <StatCell label="MDD"  value={`${strategy.mdd}%`}     negative  />
          </div>

          {/* 시장 적합도 한 줄 */}
          <p className={cn(
            'text-[10px] text-slate-400 dark:text-slate-600 leading-snug',
            isLocked && 'blur-[2.5px] select-none',
          )}>
            {strategy.fitSummary}
          </p>
        </div>
      </div>

      {/* locked 클릭 힌트 */}
      {lockedHint && (
        <div className="px-2.5 pb-1">
          <p className="text-[9px] text-center text-amber-700 bg-amber-50 border border-amber-100 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400 rounded-[2px] px-2 py-1 leading-snug">
            체험을 시작하면 이 전략을 바로 사용할 수 있습니다
          </p>
        </div>
      )}

      {/* CTA 버튼 영역 */}
      <div className="px-2.5 py-1.5 border-t border-slate-100 dark:border-gray-800 flex items-center gap-1.5 justify-end">
        {isLocked ? (
          /* 잠긴 전략 — 체험 시작 CTA */
          <Button
            variant="primary" size="sm" onClick={onStartTrial}
            className="hover:scale-[1.03] active:scale-[0.98] transition-transform"
          >
            7일 무료 체험하기
          </Button>
        ) : isUserStrategy ? (
          /* 내 전략 — 모의투자 바로가기 */
          <Button
            variant="secondary" size="sm"
            onClick={(e) => { e.stopPropagation(); onSimulate?.() }}
          >
            모의투자 바로가기
          </Button>
        ) : (
          <>
            {onSimulate && (
              <button
                onClick={(e) => { e.stopPropagation(); onSimulate() }}
                className="
                  h-6 px-2 text-[10px] font-medium rounded-[2px]
                  text-slate-500 hover:text-slate-700 hover:bg-slate-100
                  dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-gray-800
                  transition-colors
                "
              >
                모의투자 →
              </button>
            )}
            <Button variant={cta.variant} size="sm">
              {cta.label}
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}

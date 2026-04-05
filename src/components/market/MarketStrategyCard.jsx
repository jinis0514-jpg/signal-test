import { useMemo, useState, memo } from 'react'
import { FileText } from 'lucide-react'
import { cn } from '../../lib/cn'
import Badge, { dirVariant, riskMarketVariant } from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { CTA_CONFIG } from '../../lib/strategyStatus'
import {
  UPSELL_COPY,
  resolveSimIdForUnlock,
  getStrategyAccessUpsellMessage,
  PLAN_MESSAGES,
} from '../../lib/userPlan'

function fmtReturn(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function fmtSmallPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function fmtKrw(n) {
  if (!Number.isFinite(Number(n)) || Number(n) <= 0) return '—'
  return `₩${Math.round(Number(n)).toLocaleString()}`
}

function pnlTone(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 'text-slate-400 dark:text-slate-500'
  return n >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'
}

/**
 * 마켓 전용 — 비교·구매 판단용 카드 (과거 수익 + 최근 흐름 + 가격 + 상태)
 */
function MarketStrategyCard({
  strategy,
  onDetail,
  onSimulate,
  isLocked,
  onStartTrial,
  onGoSubscription,
  onSubscribe,
  isUserStrategy = false,
  user = null,
  onToggleCompare,
  compared = false,
  className = '',
}) {
  const [pressed, setPressed] = useState(false)
  const cta = CTA_CONFIG[strategy.ctaStatus] ?? CTA_CONFIG.not_started
  const ctaVariantResolved = onSimulate && cta.variant === 'primary' ? 'secondary' : cta.variant
  const isMethod = String(strategy?.type ?? 'signal') === 'method'

  const ret = Number(strategy.totalReturnPct ?? strategy.roi)
  const mdd = Number(strategy.maxDrawdown ?? Math.abs(strategy.mdd ?? 0))
  const winRate = Number(strategy.winRate ?? 0)
  const tc = Number(strategy.tradeCount ?? strategy.trades ?? 0)
  const recent7d = Number(strategy.recentRoi7d ?? strategy.roi7d)
  const recent30d = Number(strategy.recentRoi30d ?? strategy.roi30d)
  const price = Number(strategy.monthlyPriceKrw ?? strategy.monthly_price ?? 0)
  const riskLabel = strategy.riskLevelMarket ?? '보통'

  const currentDir = useMemo(() => {
    const d = strategy.recentSignals?.[0]?.dir ?? strategy.currentDir ?? null
    if (!d) return null
    const s = String(d).toUpperCase()
    if (s === 'LONG' || s === 'BUY') return 'LONG'
    if (s === 'SHORT' || s === 'SELL') return 'SHORT'
    return null
  }, [strategy.recentSignals, strategy.currentDir])

  const oneLine = String(
    strategy.fitSummary || strategy.strategy_summary || strategy.description || '',
  ).trim()

  const accessLockMessage = useMemo(() => {
    if (!isLocked || !strategy?.id) return PLAN_MESSAGES.marketMoreStrategies
    return getStrategyAccessUpsellMessage(strategy.id, user) ?? PLAN_MESSAGES.marketMoreStrategies
  }, [isLocked, strategy?.id, user])

  function pressFeedback() {
    setPressed(true)
    window.setTimeout(() => setPressed(false), 100)
  }

  function handleMainClick() {
    pressFeedback()
    onDetail?.()
  }

  return (
    <Card
      interactive
      className={cn(
        'market-card flex flex-col overflow-hidden rounded-[8px] border-slate-200/90',
        compared && 'ring-2 ring-blue-500/35 border-blue-200 dark:border-blue-900/50',
        className,
      )}
    >
      {/* 월 구독가 — 카드 최상단 */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-gray-800',
          'bg-gradient-to-r from-slate-50/90 to-white dark:from-gray-800/40 dark:to-gray-900',
        )}
      >
        <div className="min-w-0">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">월 구독</p>
          <p className="text-[16px] font-bold text-slate-900 dark:text-slate-50 tabular-nums leading-tight">
            {fmtKrw(price)}
            <span className="text-[11px] font-semibold text-slate-400 ml-1">/월</span>
          </p>
        </div>
        {isMethod ? (
          <Badge variant="default" className="shrink-0">매매법</Badge>
        ) : (
          <Badge variant={riskMarketVariant(riskLabel)} className="shrink-0">
            리스크 {riskLabel}
          </Badge>
        )}
      </div>

      <div
        className={cn(
          'flex-1 cursor-pointer transition-[background-color] duration-[120ms]',
          pressed ? 'bg-slate-100/70 dark:bg-gray-800/45' : 'bg-transparent',
        )}
        onClick={handleMainClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleMainClick()
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                {strategy.name}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-600 truncate">
                {strategy.author}
              </p>
            </div>
            {isUserStrategy && <Badge variant="info">내 전략</Badge>}
          </div>

          {isMethod && (
            <div className="mb-3 rounded-[8px] border border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/25 px-2.5 py-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <FileText size={11} />
                PDF 매매법
              </p>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">
                {strategy.description || strategy.desc || '설명이 없습니다.'}
              </p>
            </div>
          )}

          {!isMethod && (
            <>
              {/* 누적 수익률 강조 + 4대 지표 */}
              <div className="rounded-[8px] border border-slate-200 dark:border-gray-800 overflow-hidden mb-2">
                <div className="flex items-stretch">
                  <div className="flex-1 min-w-0 px-3 py-2.5 bg-white dark:bg-gray-900">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                      누적 수익률
                    </p>
                    <p className={cn('text-[22px] font-bold tabular-nums leading-none', pnlTone(ret))}>
                      {fmtReturn(ret)}
                    </p>
                  </div>
                  <div className="w-px bg-slate-100 dark:bg-gray-800" />
                  <div className="flex flex-1 min-w-0">
                    <div className="flex-1 px-2 py-2 text-right border-r border-slate-100 dark:border-gray-800">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">MDD</p>
                      <p className="text-[13px] font-bold tabular-nums text-red-600 dark:text-red-400 leading-none">
                        {Number.isFinite(mdd) ? `−${mdd.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="flex-1 px-2 py-2 text-right border-r border-slate-100 dark:border-gray-800">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">승률</p>
                      <p className={cn(
                        'text-[13px] font-bold tabular-nums leading-none',
                        Number.isFinite(winRate) && winRate >= 55
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-300',
                      )}>
                        {Number.isFinite(winRate) ? `${winRate.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="flex-1 px-2 py-2 text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">거래</p>
                      <p className="text-[13px] font-bold tabular-nums text-slate-700 dark:text-slate-300 leading-none">
                        {Number.isFinite(tc) ? tc : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 최근 성과 + 현재 포지션 */}
              <div className="rounded-[8px] border border-slate-100 dark:border-gray-800 bg-slate-50/40 dark:bg-gray-800/20 px-3 py-2.5 mb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-wide">최근 7일</span>
                      <p className={cn('text-[14px] font-bold tabular-nums leading-none mt-0.5', pnlTone(recent7d))}>
                        {Number.isFinite(recent7d) ? fmtSmallPct(recent7d) : '—'}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-gray-700" />
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-wide">최근 30일</span>
                      <p className={cn('text-[14px] font-bold tabular-nums leading-none mt-0.5', pnlTone(recent30d))}>
                        {Number.isFinite(recent30d) ? fmtSmallPct(recent30d) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wide">현재 상태</span>
                    <Badge variant={dirVariant(currentDir)} className="h-[20px] px-2.5 text-[11px]">
                      {currentDir ?? '대기'}
                    </Badge>
                  </div>
                </div>
              </div>

              {oneLine && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                  {oneLine}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* 잠금: 지표는 그대로 두고 하단에만 안내 (무료도 판단 가능) */}
      {isLocked && !isUserStrategy && (
        <div className="px-4 py-2 bg-amber-50/80 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/30">
          <p className="text-[10px] text-amber-900 dark:text-amber-200/90 leading-snug">
            {accessLockMessage}
          </p>
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-slate-100 dark:border-gray-800 flex flex-wrap items-center gap-2 justify-end bg-white/80 dark:bg-gray-900/80">
        {typeof onToggleCompare === 'function' && !isUserStrategy && (
          <Button
            variant={compared ? 'primary' : 'secondary'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCompare(strategy)
            }}
          >
            {compared ? '비교 중' : '비교'}
          </Button>
        )}
        {isLocked && !isUserStrategy ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDetail?.()
              }}
            >
              상세 보기
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                ;(onSubscribe ?? onGoSubscription)?.()
              }}
            >
              {UPSELL_COPY.ctaSubscribe}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                const sid = resolveSimIdForUnlock(strategy) || strategy.id
                onStartTrial?.(sid)
              }}
            >
              {UPSELL_COPY.ctaTrial}
            </Button>
          </>
        ) : isUserStrategy ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onSimulate?.()
            }}
          >
            {isMethod ? '연결 전략 실행' : '시그널 보기'}
          </Button>
        ) : (
          <>
            {onDetail && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDetail()
                }}
              >
                상세 보기
              </Button>
            )}
            {onSimulate && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onSimulate()
                }}
              >
                {isMethod ? '연결 전략 실행' : '시그널 보기'}
              </Button>
            )}
            <span
              role="status"
              className={cn(
                'inline-flex items-center h-7 px-2.5 rounded-md text-[11px] font-semibold border select-none',
                ctaVariantResolved === 'primary' && 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-200',
                ctaVariantResolved === 'secondary' && 'border-slate-200 bg-white text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-200',
                (ctaVariantResolved === 'ghost' || !ctaVariantResolved) && 'border-transparent bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-slate-400',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {cta.label}
            </span>
          </>
        )}
      </div>
    </Card>
  )
}

function marketStrategyCardEqual(a, b) {
  if (a.isLocked !== b.isLocked || a.isUserStrategy !== b.isUserStrategy) return false
  if (a.compared !== b.compared || a.className !== b.className) return false
  if (a.user?.plan !== b.user?.plan || a.user?.trialDaysLeft !== b.user?.trialDaysLeft) return false
  const sa = a.strategy
  const sb = b.strategy
  if (!sa || !sb) return sa === sb
  return sa.id === sb.id
    && sa.name === sb.name
    && sa.totalReturnPct === sb.totalReturnPct
    && sa.roi === sb.roi
    && sa.recentRoi7d === sb.recentRoi7d
    && sa.roi7d === sb.roi7d
    && sa.recentRoi30d === sb.recentRoi30d
    && sa.roi30d === sb.roi30d
    && sa.winRate === sb.winRate
    && sa.maxDrawdown === sb.maxDrawdown
    && sa.tradeCount === sb.tradeCount
    && sa.monthlyPriceKrw === sb.monthlyPriceKrw
    && sa.ctaStatus === sb.ctaStatus
}

export default memo(MarketStrategyCard, marketStrategyCardEqual)

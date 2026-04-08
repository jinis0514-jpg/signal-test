import { useMemo, useState, memo } from 'react'
import { FileText, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import Badge, { dirVariant, riskMarketVariant } from '../ui/Badge'
import Button from '../ui/Button'
import { CTA_CONFIG } from '../../lib/strategyStatus'
import {
  UPSELL_COPY,
  resolveSimIdForUnlock,
  getStrategyAccessUpsellMessage,
  PLAN_MESSAGES,
  isSubscriptionLimitExceeded,
} from '../../lib/userPlan'
import VerificationBadge from '../verification/VerificationBadge'
import { computeTrustScore, getTrustGrade } from '../../lib/strategyTrustScore'

function fmtReturn(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtSmallPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtKrw(n) {
  if (!Number.isFinite(Number(n)) || Number(n) <= 0) return null
  return `₩${Math.round(Number(n)).toLocaleString()}`
}

function pnlTone(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 'text-slate-400 dark:text-slate-500'
  return n >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'
}

function clampOneLine(text, max = 20) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

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
  const isMethod = String(strategy?.type ?? 'signal') === 'method'

  const ret = Number(strategy.totalReturnPct ?? strategy.roi)
  const mdd = Number(strategy.maxDrawdown ?? Math.abs(strategy.mdd ?? 0))
  const winRate = Number(strategy.winRate ?? 0)
  const tc = Number(strategy.tradeCount ?? strategy.trades ?? 0)
  const recent7d = Number(strategy.recentRoi7d ?? strategy.roi7d)
  const price = Number(strategy.monthlyPriceKrw ?? strategy.monthly_price ?? 0)
  const priceFmt = fmtKrw(price)

  const isTopStrategy = (Number.isFinite(ret) && ret >= 30) || strategy.recommendBadge === 'BEST'

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
  const trustScore = useMemo(() => {
    return computeTrustScore({
      matchRate: strategy.matchRate,
      verifiedReturn: strategy.verifiedReturn,
      liveReturn30d: strategy.recentRoi30d,
      maxDrawdown: strategy.maxDrawdown ?? strategy.mdd,
      tradeCount: strategy.tradeCount ?? strategy.trades,
      hasRealVerification: strategy.hasRealVerification,
    })
  }, [strategy])

  const trustGrade = useMemo(() => {
    return getTrustGrade(trustScore)
  }, [trustScore])
  const statusText = currentDir ? `${currentDir} 진입 중` : '관망 중'
  const briefDesc = clampOneLine(strategy.summary || oneLine, 22)

  const subscribeLimitReached = isSubscriptionLimitExceeded(user?.unlockedStrategyIds, user)

  function pressFeedback() {
    setPressed(true)
    window.setTimeout(() => setPressed(false), 100)
  }

  function handleMainClick() {
    pressFeedback()
    onDetail?.()
  }

  return (
    <div
      className={cn(
        'market-card relative flex flex-col overflow-hidden rounded-lg border bg-white dark:bg-gray-900',
        'transition-all duration-200 ease-out cursor-pointer',
        'hover:scale-[1.02] hover:shadow-md',
        compared
          ? 'ring-2 ring-blue-500/40 border-2 border-blue-400 dark:border-blue-600'
          : isTopStrategy
            ? 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-sm shadow-emerald-100/40 dark:shadow-emerald-900/20'
            : 'border-slate-200/90 hover:border-slate-300 dark:border-gray-700 dark:hover:border-slate-600',
        pressed && 'scale-[0.99]',
        className,
      )}
      onClick={handleMainClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleMainClick() }}
    >
      {/* 비교 체크 표시 */}
      {compared && (
        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm">
          <Check size={12} strokeWidth={3} />
        </div>
      )}

      <div className="px-3.5 py-3 flex-1">
        {/* ── 1. 상단: 전략명 + 배지 (같은 라인) ── */}
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-tight truncate flex-1 min-w-0">
            {strategy.name}
          </h3>
          <VerificationBadge
            level={strategy.verified_badge_level ?? 'backtest_only'}
            size="xs"
            showLabel={false}
          />
          {isTopStrategy && !isUserStrategy && <Badge variant="success">추천</Badge>}
        </div>

        {!isMethod && (
          <>
            {/* ── 2. 수익률 — 카드에서 가장 크게 ── */}
            <div className="text-center mb-2.5">
              <p className={cn(
                'text-[28px] font-extrabold tabular-nums leading-none tracking-tight',
                pnlTone(ret),
              )}>
                {fmtReturn(ret)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 tabular-nums">
                승률 {Number.isFinite(winRate) ? `${winRate.toFixed(0)}%` : '—'}
                {' · MDD '}
                {Number.isFinite(mdd) ? `-${mdd.toFixed(0)}%` : '—'}
                {' · '}
                {Number.isFinite(tc) ? `${tc}회` : '—'}
              </p>
            </div>

            {/* ── 4. 한 줄 설명 ── */}
            {briefDesc && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-snug mb-2">
                {briefDesc}
              </p>
            )}

            {/* ── 5. 현재 상태 ── */}
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className={cn('text-[11px] font-medium', currentDir ? pnlTone(currentDir === 'LONG' ? 1 : -1) : 'text-slate-500 dark:text-slate-400')}>
                {statusText}
              </p>
              {priceFmt && (
                <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  {priceFmt}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">/월</span>
                </span>
              )}
            </div>
          </>
        )}

        {/* 매매법(Method) 카드 */}
        {isMethod && (
          <div className="rounded-lg border border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/25 px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <FileText size={11} />
              PDF 매매법
            </p>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed truncate">
              {strategy.description || strategy.desc || '설명이 없습니다.'}
            </p>
            {priceFmt && (
              <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 tabular-nums mt-2">
                {priceFmt}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">/월</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 6. 하단: 클릭 유도 + 비교 ── */}
      <div
        className="px-3.5 py-2 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between gap-2 bg-slate-50/40 dark:bg-gray-900/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 비교 토글 */}
        <div className="flex items-center gap-2">
          {typeof onToggleCompare === 'function' && !isUserStrategy && (
            <button
              type="button"
              className={cn(
                'text-[11px] font-medium px-2 py-1 rounded transition-colors',
                compared
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400',
              )}
              onClick={() => onToggleCompare(strategy)}
            >
              {compared ? '✓ 비교 중' : '비교'}
            </button>
          )}
        </div>

        {/* CTA 영역 */}
        <div className="flex items-center gap-2">
          {isLocked && !isUserStrategy ? (
            <>
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
                onClick={() => {
                  const sid = resolveSimIdForUnlock(strategy) || strategy.id
                  onStartTrial?.(sid)
                }}
              >
                무료 체험
              </Button>
            </>
          ) : isUserStrategy ? (
            <button
              type="button"
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => onSimulate?.()}
            >
              {isMethod ? '연결 전략 실행 →' : '시그널 보기 →'}
            </button>
          ) : (
            <button
              type="button"
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => onDetail?.()}
            >
              전략 확인 →
            </button>
          )}
        </div>
      </div>
    </div>
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

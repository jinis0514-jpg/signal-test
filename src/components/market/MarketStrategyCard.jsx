import { useMemo, useState, memo } from 'react'
import { FileText, Check, Star } from 'lucide-react'
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
import { getStrategyLiveState } from '../../lib/strategyLiveState'
import { evaluateStrategy } from '../../lib/strategyEvaluator'
import { getScenarioOneLiner } from '../../lib/strategyScenarioEngine'
import { SUBSCRIBE_STICKY } from '../../lib/conversionUx'

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

function formatSignedPct1(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
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
  onToggleFavorite,
  isFavorite = false,
  compared = false,
  /** classifyMarketState 결과 — 있으면 시나리오 한 줄 표시 */
  marketState = null,
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

  const liveState = useMemo(() => getStrategyLiveState(strategy), [strategy])
  const currentStateText = liveState.shortLabel
  const mddText = Number.isFinite(mdd) ? `-${mdd.toFixed(1)}%` : '—'
  const verificationSummary = String(
    strategy.verificationSummary
    ?? strategy.comparisonLine
    ?? '백테스트 + 라이브 검증 + 실거래 비교',
  ).trim()

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

  const scenarioOneLiner = useMemo(() => {
    if (!marketState || isMethod) return null
    return getScenarioOneLiner(
      { ...strategy, trustScore, recentRoi7d: recent7d },
      marketState,
    )
  }, [marketState, isMethod, strategy, trustScore, recent7d])

  const briefDesc = clampOneLine(strategy.summary || oneLine, 22)

  const evalVerdictLine = useMemo(() => evaluateStrategy(strategy).verdict, [strategy])

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
      title={!isMethod ? SUBSCRIBE_STICKY.hoverSubscribeHint : undefined}
      className={cn(
        'group relative w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:border-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500/70',
        compared
          ? 'ring-2 ring-blue-500/70 border-2 border-blue-500/70 shadow-md dark:ring-blue-400/50 dark:border-blue-500/80'
          : '',
        pressed && 'scale-[0.99]',
        className,
      )}
      onClick={handleMainClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleMainClick() }}
    >
      {compared && (
        <>
          <div className="absolute left-3 top-3 z-10 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
            비교중
          </div>
          <div className="absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm dark:bg-blue-500">
            <Check size={12} strokeWidth={2.8} />
          </div>
        </>
      )}

      <div className={cn('flex items-start justify-between gap-3', compared && 'pt-1 pl-1 sm:pl-0')}>
        <div className={cn('min-w-0 flex-1', compared && 'pl-14 sm:pl-[3.25rem]')}>
          {!isMethod ? (
            <>
              <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                {strategy.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-gray-800 dark:text-slate-300">
                  {strategy.typeLabel ?? '추세형'}
                </span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                  {strategy.profileLabel ?? '안정형'}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {SUBSCRIBE_STICKY.realtimeBadge}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    7일 수익률
                  </p>
                  <p className={cn(
                    'mt-0.5 text-2xl font-bold tabular-nums tracking-tight leading-none',
                    Number.isFinite(recent7d) && recent7d < 0
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                  >
                    {Number.isFinite(recent7d) ? formatSignedPct1(recent7d) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    누적 수익률
                  </p>
                  <p className={cn(
                    'mt-0.5 text-2xl font-bold tabular-nums tracking-tight leading-none',
                    Number.isFinite(ret) && ret < 0
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                  >
                    {formatSignedPct1(ret)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                승률
                {' '}
                {Number.isFinite(winRate) ? `${winRate.toFixed(1)}%` : '—'}
                {' · '}
                MDD
                {' '}
                {mddText}
                {' · '}
                신뢰
                {' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{trustScore}</span>
                {' · '}
                거래
                {' '}
                {Number.isFinite(tc) ? `${Math.round(tc)}회` : '—'}
              </p>
            </>
          ) : (
            <>
              <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                {strategy.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-gray-800 dark:text-slate-300">
                  {strategy.typeLabel ?? '추세형'}
                </span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                  {strategy.profileLabel ?? '안정형'}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {typeof onToggleFavorite === 'function' && (
            <button
              type="button"
              aria-label={isFavorite ? '전략 즐겨찾기 해제' : '전략 즐겨찾기'}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(strategy) }}
              className={cn(
                'rounded-md p-1 transition-colors',
                isFavorite
                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/25'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-gray-800',
              )}
            >
              <Star size={14} className={cn(isFavorite && 'fill-amber-400')} strokeWidth={2} />
            </button>
          )}
          <VerificationBadge level={strategy.verified_badge_level ?? 'backtest_only'} size="xs" showLabel={false} />
          {Number.isFinite(ret) && ret > 30 ? <Badge variant="danger">HOT</Badge> : null}
          {Boolean(strategy.isNew) ? <Badge variant="info">NEW</Badge> : null}
          {isTopStrategy && !isUserStrategy ? <Badge variant="success">추천</Badge> : null}
        </div>
      </div>

      {!isMethod && (
        <>
          <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-slate-200">
            <span className="shrink-0 text-slate-400">상태</span>
            <span className="font-medium truncate">{currentStateText}</span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
            {evalVerdictLine || scenarioOneLiner || strategy.summary || briefDesc || '전략 설명이 준비 중입니다.'}
          </p>

          <p className="mt-1 text-xs text-slate-400 line-clamp-2">
            {verificationSummary}
            {' '}
            <span className="text-slate-500 dark:text-slate-500">
              ({trustGrade.label})
            </span>
          </p>
        </>
      )}

      {/* 매매법(Method) 카드 */}
      {isMethod && (
        <div className="mt-4 rounded-xl border border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/25 px-3 py-3">
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

      {!isMethod && (
        <p className="mt-3 text-right text-[11px] font-medium text-slate-400 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
          클릭해서 상세 보기
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>→</span>
        </p>
      )}

      <div
        className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {typeof onToggleCompare === 'function' && !isUserStrategy && (
            <button
              type="button"
              className={cn(
                'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                compared
                  ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950/40'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:hover:text-slate-300 dark:hover:border-gray-600 dark:hover:bg-gray-800',
              )}
              onClick={() => onToggleCompare(strategy)}
            >
              {compared ? '✓ 비교 중' : '비교 추가'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLocked && !isUserStrategy ? (
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={subscribeLimitReached}
                className="!bg-blue-600 !border-blue-600 hover:!bg-blue-700 hover:!border-blue-700 hover:scale-[1.03] hover:shadow-lg shadow-sm font-semibold"
                onClick={() => (onSubscribe ?? onGoSubscription)?.()}
              >
                {UPSELL_COPY.ctaSubscribe}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-semibold"
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
              className="bb-strategy-cta"
              onClick={(e) => { e.stopPropagation(); onSimulate?.() }}
            >
              {isMethod ? '연결 전략 실행' : '시그널 보기'} <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </button>
          ) : null}
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
    && sa.typeKey === sb.typeKey
    && sa.profileKey === sb.profileKey
}

export default memo(MarketStrategyCard, marketStrategyCardEqual)

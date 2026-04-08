import { useMemo, useState, memo } from 'react'
import { Lock, FileText } from 'lucide-react'
import { cn } from '../../lib/cn'
import Badge, { dirVariant, riskVariant } from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { CTA_CONFIG, RECOMMEND_CONFIG, STRATEGY_STATUS_CONFIG } from '../../lib/strategyStatus'
import {
  PLAN_MESSAGES,
  UPSELL_COPY,
  resolveSimIdForUnlock,
  getStrategyAccessUpsellMessage,
  isSubscriptionLimitExceeded,
} from '../../lib/userPlan'
import { buildStrategyNarrative, CORE_TRUST_BADGE_KEYS } from '../../lib/strategyNarrative'
import { computeStrategyStatus } from '../../lib/strategyTrust'
import VerificationBadge from '../verification/VerificationBadge'
import { computeTrustScore, getTrustGrade } from '../../lib/strategyTrustScore'

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

/* 수치 셀 — 레이블 위, 값 아래 */
function StatCell({ label, value, positive, negative }) {
  return (
    <div className="flex flex-col items-center py-2">
      <span className="text-[12px] text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </span>
      <span
        className={cn(
          'text-[15px] font-bold tabular-nums leading-none',
          positive && 'text-emerald-600 dark:text-emerald-400',
          negative && 'text-red-500',
          !positive && !negative && 'text-slate-700 dark:text-slate-300',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function fmtYMD(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return null
  try {
    return new Date(n).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('. ', '.').replaceAll('.', '.').trim()
  } catch {
    return null
  }
}

function StrategyCard({
  strategy,
  onDetail,
  onSimulate,
  isLocked,
  onStartTrial,
  onGoSubscription,
  /** 잠금 카드 primary CTA — 미전달 시 onGoSubscription 사용 */
  onSubscribe,
  isUserStrategy = false,
  /** 홈 추천 등 — 모의투자를 주 버튼으로 */
  emphasizeSimulate = false,
  /** 카드에 요약 문단 표시 */
  showStrategyNarrative = false,
  className = '',
  /** 잠금 메시지(티어별) — 미전달 시 strategy.id + user로 계산 */
  user = null,
  onToggleCompare,
  compared = false,
}) {
  const [pressed, setPressed] = useState(false)

  const cta       = CTA_CONFIG[strategy.ctaStatus]          ?? CTA_CONFIG.not_started
  const recCfg    = RECOMMEND_CONFIG[strategy.recommendBadge]
  const statusCfg = STRATEGY_STATUS_CONFIG[strategy.status]

  const isMethod = String(strategy?.type ?? 'signal') === 'method'
  const narrative = buildStrategyNarrative(strategy)
  const coreTrustBadges = Array.isArray(strategy.trustBadges)
    ? strategy.trustBadges.filter((b) => CORE_TRUST_BADGE_KEYS.has(b.key))
    : []

  const ctaVariantResolved = onSimulate && cta.variant === 'primary' ? 'secondary' : cta.variant

  const bt = strategy?.backtest_meta && typeof strategy.backtest_meta === 'object' ? strategy.backtest_meta : null
  const periodLabel = useMemo(() => {
    if (!bt) return null
    const a = fmtYMD(bt.startTime)
    const b = fmtYMD(bt.endTime)
    const tf = bt.timeframe
    if (!a || !b || !tf) return null
    return `${a} ~ ${b} / ${tf}봉 기준`
  }, [bt])
  const riskStatus = useMemo(
    () => computeStrategyStatus({ performance: strategy?.performance ?? strategy, backtestMeta: bt ?? {} }),
    [strategy?.performance, strategy?.roi, strategy?.mdd, strategy?.trades, bt],
  )

  const ret = Number(strategy.totalReturnPct ?? strategy.roi)
  const mdd = Number(strategy.maxDrawdown ?? Math.abs(strategy.mdd ?? 0))
  const winRate = Number(strategy.winRate ?? 0)
  const tc = Number(strategy.tradeCount ?? strategy.trades ?? 0)
  const recent7d = Number(strategy.recentRoi7d ?? strategy.roi7d)
  const recent30d = Number(strategy.recentRoi30d ?? strategy.roi30d)
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

  /* 현재 포지션 방향 (LONG / SHORT / 대기) */
  const currentDir = (() => {
    const d = strategy.recentSignals?.[0]?.dir ?? strategy.currentDir ?? null
    if (!d) return null
    const s = String(d).toUpperCase()
    if (s === 'LONG' || s === 'BUY') return 'LONG'
    if (s === 'SHORT' || s === 'SELL') return 'SHORT'
    return null
  })()

  const accessLockMessage = useMemo(() => {
    if (!isLocked || !strategy?.id) return PLAN_MESSAGES.marketMoreStrategies
    return getStrategyAccessUpsellMessage(strategy.id, user) ?? PLAN_MESSAGES.marketMoreStrategies
  }, [isLocked, strategy?.id, user])
  const subscribeLimitReached = isSubscriptionLimitExceeded(user?.unlockedStrategyIds, user)

  const showAltBasketNote =
    String(strategy?.asset ?? '').toUpperCase() === 'ALT'
    || String(strategy?.assetType ?? '').toLowerCase() === 'alt'

  function handleCardClick() {
    onDetail?.()
  }

  function pressFeedback() {
    setPressed(true)
    window.setTimeout(() => setPressed(false), 100)
  }

  return (
    <Card interactive className={cn('flex flex-col', className)}>

      {/* 클릭 가능한 상단 콘텐츠 */}
      <div
        className={cn(
          'flex-1 cursor-pointer transition-[background-color,opacity] duration-[120ms]',
          pressed
            ? 'bg-slate-100/70 dark:bg-gray-800/45'
            : 'bg-transparent',
        )}
        onClick={() => { pressFeedback(); handleCardClick() }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { pressFeedback(); handleCardClick() }
        }}
      >
        <div className="p-4">
          {/* 1) 상단: 이름 + 핵심 배지 */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-500">
                  {trustGrade.grade}등급
                </span>
                <span className="text-xs text-slate-400">
                  신뢰도 {trustScore}점
                </span>
              </div>
              <p className="text-[16px] font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                {strategy.name}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-500 truncate">
                {strategy.author}
              </p>
              {!isUserStrategy && Number(strategy.monthlyPriceKrw ?? strategy.monthly_price ?? 0) > 0 && (
                <p className="mt-1 text-[13px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  월 {Number(strategy.monthlyPriceKrw ?? strategy.monthly_price).toLocaleString('ko-KR')}원
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
              {isUserStrategy && <Badge variant="info">내 전략</Badge>}
              {!isUserStrategy && recCfg && <Badge variant={recCfg.variant}>{recCfg.label}</Badge>}
              <VerificationBadge
                level={strategy.verified_badge_level ?? 'backtest_only'}
                size="xs"
              />
              {!isMethod && (
                <Badge variant={riskVariant(riskStatus)}>
                  {riskStatus}
                </Badge>
              )}
              {!isUserStrategy && statusCfg && <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>}
              {isLocked && (
                <Badge variant="default">
                  <Lock size={8} className="mr-0.5 inline-block" />
                  잠금
                </Badge>
              )}
            </div>
          </div>

          {showAltBasketNote && (
            <div className="mb-2 rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/55 dark:bg-indigo-950/20 px-2.5 py-1.5">
              <p className="text-[10px] text-indigo-900 dark:text-indigo-200 leading-snug">
                ALT 전략 성과는 Binance 대표 알트 5종 바스켓 백테스트 평균으로 표시됩니다. (단일 코인 조작 방지)
              </p>
            </div>
          )}

          {isMethod && (
            <div className={cn(
              'mb-3 rounded-lg border border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/25 px-2.5 py-2',
              isLocked && 'opacity-50 select-none',
            )}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <FileText size={11} />
                PDF 매매법
              </p>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                {strategy.description || strategy.desc || '설명이 없습니다.'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                연결 전략: {strategy.linkedSignalName || '—'}
              </p>
            </div>
          )}

          {/* 2) 핵심 수치 (판단 영역) */}
          <div className="relative mb-2">
            <div className="flex items-stretch rounded-[8px] border border-slate-200 dark:border-gray-800 overflow-hidden">
              {/* ROI (강조) */}
              <div className="flex-1 min-w-0 px-3 py-2.5 bg-white dark:bg-gray-900">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">
                  누적 수익률
                </p>
                <p className={cn(
                  'text-[22px] font-bold tabular-nums leading-none',
                  Number.isFinite(ret) ? (ret >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-slate-700 dark:text-slate-300',
                )}>
                  {fmtReturn(ret)}
                </p>
              </div>

              <div className="w-px bg-slate-100 dark:bg-gray-800" />

              {/* MDD / Win / Trades */}
              <div className="flex items-center gap-0">
                <div className="px-3 py-2.5 bg-white dark:bg-gray-900 text-right">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">
                    MDD
                  </p>
                  <p className="text-[13px] font-bold tabular-nums text-red-500 leading-none">
                    {Number.isFinite(mdd) ? `−${mdd.toFixed(1)}%` : '—'}
                  </p>
                </div>
                <div className="w-px bg-slate-100 dark:bg-gray-800" />
                <div className="px-3 py-2.5 bg-white dark:bg-gray-900 text-right">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">
                    승률
                  </p>
                  <p className={cn(
                    'text-[13px] font-bold tabular-nums leading-none',
                    Number.isFinite(winRate) ? (winRate >= 55 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300') : 'text-slate-700 dark:text-slate-300',
                  )}>
                    {Number.isFinite(winRate) ? `${winRate.toFixed(1)}%` : '—'}
                  </p>
                </div>
                <div className="w-px bg-slate-100 dark:bg-gray-800" />
                <div className="px-3 py-2.5 bg-white dark:bg-gray-900 text-right">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">
                    거래
                  </p>
                  <p className="text-[13px] font-bold tabular-nums text-slate-700 dark:text-slate-300 leading-none">
                    {Number.isFinite(tc) ? tc : '—'}
                  </p>
                </div>
              </div>
            </div>

            {isLocked && (
              <div className="absolute inset-0 z-10 rounded-lg bg-white/90 dark:bg-gray-900/90 flex flex-col items-center justify-center gap-1 px-3 text-center border border-slate-200/80 dark:border-gray-700/80">
                <Lock size={18} className="text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.8} aria-hidden />
                <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100">열람 제한</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
                  {accessLockMessage}
                </span>
              </div>
            )}
          </div>

          {/* 3) 보조 정보: 최근 성과 + 현재 상태 */}
          {!isMethod && (
            <div className={cn(
              'mt-2 flex items-center justify-between gap-2 flex-wrap',
              isLocked && 'opacity-60 select-none',
            )}>
              {/* 최근 7일 / 30일 */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide leading-none mb-0.5">최근 7일</span>
                  <span className={cn(
                    'text-[14px] font-bold tabular-nums leading-none',
                    Number.isFinite(recent7d) ? (recent7d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-slate-400',
                  )}>
                    {Number.isFinite(recent7d) ? fmtSmallPct(recent7d) : '—'}
                  </span>
                </div>
                <div className="w-px h-6 bg-slate-100 dark:bg-gray-800" />
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide leading-none mb-0.5">최근 30일</span>
                  <span className={cn(
                    'text-[14px] font-bold tabular-nums leading-none',
                    Number.isFinite(recent30d) ? (recent30d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-slate-400',
                  )}>
                    {Number.isFinite(recent30d) ? fmtSmallPct(recent30d) : '—'}
                  </span>
                </div>
              </div>

              {/* 현재 상태 */}
              <Badge variant={dirVariant(currentDir)}>
                {currentDir ?? '대기'}
              </Badge>
            </div>
          )}

          {/* 4) 백테스트 기간 + 한줄 설명 */}
          {!isMethod && periodLabel && (
            <p className={cn(
              'mt-1.5 text-[10px] text-slate-400 font-mono tabular-nums',
              isLocked && 'opacity-60 select-none',
            )}>
              {periodLabel}
            </p>
          )}
          {!isMethod && (
            <p className={cn(
              'mt-1 text-[11px] text-slate-500 dark:text-slate-500 leading-snug line-clamp-1',
              isLocked && 'opacity-60 select-none',
            )}>
              {String(strategy.summary || strategy.fitSummary || strategy.strategy_summary || strategy.description || '').trim() || '—'}
            </p>
          )}
          {!isMethod && (
            <p className={cn('mt-1 text-[10px] text-slate-500 dark:text-slate-400', isLocked && 'opacity-60 select-none')}>
              신뢰도 {Number.isFinite(Number(strategy.trustScore)) ? Number(strategy.trustScore) : 0}점 · 리스크 {strategy.riskLevelMarket ?? '보통'}
            </p>
          )}
          {!isMethod && strategy.comparisonLine && (
            <p className={cn('mt-0.5 text-[10px] text-blue-600 dark:text-blue-400 line-clamp-1', isLocked && 'opacity-60 select-none')}>
              {strategy.comparisonLine}
            </p>
          )}
          {showStrategyNarrative && narrative && (
            <p className={cn(
              'mt-1 text-[10px] text-slate-400 dark:text-slate-600 leading-snug line-clamp-1',
              isLocked && 'opacity-60 select-none',
            )}>
              {narrative}
            </p>
          )}
        </div>
      </div>

      {/* CTA 버튼 영역 */}
      <div className="px-4 py-2.5 border-t border-slate-100 dark:border-gray-800 flex flex-wrap items-center gap-2 justify-end">
        {typeof onToggleCompare === 'function' && !isLocked && !isUserStrategy && (
          <Button
            variant={compared ? 'primary' : 'secondary'}
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggleCompare(strategy) }}
          >
            {compared ? '비교 중' : '비교'}
          </Button>
        )}
        {isLocked ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              variant="primary" size="sm"
              disabled={subscribeLimitReached}
              onClick={(e) => {
                e.stopPropagation()
                ;(onSubscribe ?? onGoSubscription)?.()
              }}
            >
              {UPSELL_COPY.ctaSubscribe}
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={(e) => {
                e.stopPropagation()
                const sid = resolveSimIdForUnlock(strategy) || strategy.id
                onStartTrial?.(sid)
              }}
            >
              {UPSELL_COPY.ctaTrial}
            </Button>
          </div>
        ) : isUserStrategy ? (
          <Button
            variant="secondary" size="sm"
            onClick={(e) => { e.stopPropagation(); onSimulate?.() }}
          >
            {isMethod ? '연결 전략 실행' : '시그널 보기'}
          </Button>
        ) : (
          <>
            {onDetail && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDetail() }}
              >
                상세 보기
              </Button>
            )}
            {onSimulate && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onSimulate() }}
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

function strategyCardPropsEqual(a, b) {
  if (a.isLocked !== b.isLocked || a.isUserStrategy !== b.isUserStrategy) return false
  if (a.emphasizeSimulate !== b.emphasizeSimulate || a.showStrategyNarrative !== b.showStrategyNarrative) return false
  if (a.className !== b.className || a.compared !== b.compared) return false
  if (a.user?.plan !== b.user?.plan || a.user?.trialDaysLeft !== b.user?.trialDaysLeft) return false
  const sa = a.strategy
  const sb = b.strategy
  if (!sa || !sb) return sa === sb
  return sa.id === sb.id
    && sa.name === sb.name
    && sa.totalReturnPct === sb.totalReturnPct
    && sa.roi === sb.roi
    && sa.recommendBadge === sb.recommendBadge
    && sa.ctaStatus === sb.ctaStatus
    && sa.fitSummary === sb.fitSummary
    && sa.winRate === sb.winRate
    && sa.maxDrawdown === sb.maxDrawdown
    && sa.tradeCount === sb.tradeCount
}

export default memo(StrategyCard, strategyCardPropsEqual)

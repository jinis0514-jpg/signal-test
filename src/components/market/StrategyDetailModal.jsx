import { useEffect, useState, useCallback, useMemo } from 'react'
import { X, FileText, Lock } from 'lucide-react'
import { cn } from '../../lib/cn'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { CTA_CONFIG } from '../../lib/strategyStatus'
import { buildStrategyNarrative } from '../../lib/strategyNarrative'
import { buildStrategyAutoEvaluation } from '../../lib/strategyAutoEvaluation'
import { getMethodPdfSignedUrl } from '../../lib/methodPdfStorage'
import { getStrategyPdfSignedUrl } from '../../lib/strategyPdfStorage'
import { buildTrustWarnings, computeStrategyStatus } from '../../lib/strategyTrust'
import { normalizeStrategyPayload } from '../../lib/strategyPayload'
import { runMarketSubmissionCheck } from '../../lib/marketSubmissionGate'
import { computeRecentRoiPct, mapTrustToRiskLevelMarket } from '../../lib/marketStrategy'
import { dirVariant, riskMarketVariant } from '../ui/Badge'
import SectionErrorBoundary from '../ui/SectionErrorBoundary'
import VerificationBadge from '../verification/VerificationBadge'
import StrategyVerificationTabs from '../verification/StrategyVerificationTabs'
import { fetchVerificationSummary } from '../../lib/verificationService'
import { computeTrustScore, getTrustGrade } from '../../lib/strategyTrustScore'
import {
  UPSELL_COPY,
  hasPaidPlanFeatures,
  resolveSimIdForUnlock,
  getStrategyAccessUpsellMessage,
  PLAN_MESSAGES,
  resolvePlanAndRules,
} from '../../lib/userPlan'
import { copy as assetUniverseCopy } from '../../lib/assetValidationUniverse'
import { buildAltValidationResult } from '../../lib/altValidationPresentation'
import { safeArray } from '../../lib/safeValues'
import { formatDisplayMdd, formatDisplayWinRate } from '../../lib/strategyDisplayMetrics'
import { panelBase, panelSoft, panelEmphasis, panelPositive } from '../../lib/panelStyles'
import {
  STRATEGY_MONTHLY_PRICE_KRW,
  FIRST_MONTH_PROMO_PRICE_KRW,
  FIRST_TRIAL_DAYS_DISPLAY,
  SUBSCRIBE_STICKY,
  FREE_VS_PAID,
} from '../../lib/conversionUx'
import { StrategyCardSkeleton } from '../ui/Skeleton'
import { trackRecentViewedStrategy } from '../../lib/recentViewedStrategies'
import { buildStrategyBreakdown } from '../../lib/strategyBreakdown'
import { groupByEntryCombo } from '../../lib/tradeComboMetrics'
import StrategyBreakdownSection from '../validation/StrategyBreakdownSection'
import { buildStrategyRiskBreakdown } from '../../lib/strategyRiskBreakdown'
import StrategyRiskBreakdownSection from '../validation/StrategyRiskBreakdownSection'
import StrategyLiveStatusCard from './StrategyLiveStatusCard'
import { getStrategyLiveState } from '../../lib/strategyLiveState'
import { evaluateStrategyWithMarket } from '../../lib/strategyEvaluator'
import { classifyMarketState, describeStrategyMarketFit, recommendStrategiesByMarket } from '../../lib/marketStateEngine'
import {
  computeSignalTrustScore,
  getSignalTrustInsight,
  getSignalTrustEvidenceTags,
} from '../../lib/signalTrustScore'
import {
  pickComplementaryStrategies,
  describeComplementaryIntro,
} from '../../lib/strategyPortfolioEngine'
import { buildStrategyScenario, getScenarioSummary } from '../../lib/strategyScenarioEngine'
import {
  findComplementaryStrategies as findCorrelationComplements,
  findOverlappingStrategies,
} from '../../lib/strategyCorrelationEngine'
import { getEventImpactOnStrategy, getMarketEventInsight } from '../../lib/marketEventEngine'
import { pickHighlightMarketEvent, MANUAL_MARKET_EVENTS } from '../../data/marketEvents'
import { resolveStrategyClassification, parseAvgHoldingHours } from '../../lib/strategyClassification'
import StrategyProfileCard from './StrategyProfileCard'

/* ── 소 컴포넌트 ───────────────────── */

function InfoCell({ label, value, positive, negative, sub }) {
  return (
    <div className="border-r last:border-r-0 border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-gray-900/60">
      <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-[3px]">{label}</p>
      <p className={cn(
        'text-[12px] font-bold tabular-nums leading-none',
        positive && 'text-emerald-600 font-semibold dark:text-emerald-400',
        negative && 'text-rose-600 font-semibold dark:text-rose-400',
        !positive && !negative && 'text-slate-700 dark:text-slate-300',
      )}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[9px] text-slate-400 leading-snug">{sub}</p>}
    </div>
  )
}

function SLabel({ children }) {
  return (
    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">
      {children}
    </p>
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

function buildMiniEquitySeries({ seedText, endValue = 0, points = 24 }) {
  const seedBase = String(seedText ?? 'seed')
    .split('')
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7)
  let seed = seedBase || 7
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967295
  }

  const result = []
  let v = 0
  for (let i = 0; i < points; i += 1) {
    const progress = i / Math.max(1, points - 1)
    const drift = endValue * progress
    const noise = (rand() - 0.5) * Math.max(1.1, Math.abs(endValue) * 0.08)
    v = drift + noise
    result.push(Number(v.toFixed(2)))
  }
  result[points - 1] = Number(endValue.toFixed(2))
  return result
}

const BADGE_DESC = {
  backtest_only: '과거 데이터만 검증된 상태',
  live_verified: '라이브 검증 진행 중',
  trade_verified: '실거래 검증 완료 전략',
}

/** 전환용 Primary CTA — 눈에 띄는 채색·호버만 사용 (회색/보더 전용 버튼 금지) */
function SubscribeCtaButton({
  children,
  onClick,
  disabled,
  size = 'md',
  variant = 'solid',
  className = '',
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-[12px] min-h-[36px]',
    md: 'px-4 py-2 text-[13px] min-h-[40px]',
    lg: 'px-6 py-3 text-[15px] min-h-[44px] w-full sm:w-auto justify-center',
  }
  const variants = {
    solid:
      'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 '
      + 'shadow-sm hover:shadow-lg hover:scale-[1.03] active:scale-[0.99]',
    outline:
      'border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-50 dark:bg-gray-900 dark:hover:bg-blue-950/30 '
      + 'hover:scale-[1.02] shadow-sm',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center font-semibold rounded-lg transition-transform duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
        'disabled:opacity-40 disabled:pointer-events-none disabled:scale-100',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ── StrategyDetailModal ────────────────── */

export default function StrategyDetailModal({
  strategy,
  onClose,
  onSimulate,
  onGoValidation,
  runLocked = false,
  onSubscribe,
  onStartTrial,
  onCopyToEditor,
  trialStrategyId,
  user,
  /** BTC·캔들 맥락 (선택) — 자동 평가 문장에 반영 */
  marketEvaluationContext,
  /** 마켓 전략 비교 패널 연동 (선택) */
  onToggleCompare,
  compareAddDisabled = false,
  isCompared = false,
  /** 조합 추천용 전체 목록 (선택) */
  strategyPool = [],
  onOpenRelatedStrategy,
}) {
  /* ─── 훅: 최상단 선언 ─── */
  const [rendered, setRendered] = useState(null)
  const [open, setOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fullUrl, setFullUrl] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [strategyPreviewUrl, setStrategyPreviewUrl] = useState(null)
  const [strategyFullUrl, setStrategyFullUrl] = useState(null)
  const [copyClipboardErr, setCopyClipboardErr] = useState('')
  const [verSummary, setVerSummary] = useState(null)
  const [engineValidation, setEngineValidation] = useState({
    loading: false,
    error: '',
    performance: null,
    trades: null,
    backtestMeta: null,
    recentRoi7d: null,
    recentRoi30d: null,
    altBasketAggregated: false,
    basketDetail: null,
    validationResult: null,
  })

  const safeRendered = rendered && typeof rendered === 'object' ? rendered : null
  const isReady = !!safeRendered

  const requestClose = useCallback(() => { onClose?.() }, [onClose])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') requestClose() }
    if (isReady) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [isReady, requestClose])

  useEffect(() => { setCopyClipboardErr('') }, [strategy])

  useEffect(() => {
    if (strategy) {
      setRendered(strategy)
      const id = requestAnimationFrame(() => setOpen(true))
      return () => cancelAnimationFrame(id)
    }
    return undefined
  }, [strategy])

  useEffect(() => {
    if (!strategy && rendered) {
      setOpen(false)
      const t = window.setTimeout(() => setRendered(null), 200)
      return () => clearTimeout(t)
    }
    return undefined
  }, [strategy, rendered])

  useEffect(() => {
    if (!safeRendered?.id) return
    trackRecentViewedStrategy({
      id: safeRendered.id,
      name: safeRendered.name,
    })
  }, [safeRendered?.id, safeRendered?.name])

  /* 검증 요약 가져오기 */
  useEffect(() => {
    const sid = safeRendered?.id
    if (!sid) { setVerSummary(null); return }
    let cancelled = false
    fetchVerificationSummary(sid)
      .then((s) => { if (!cancelled) setVerSummary(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [safeRendered?.id])

  /* 엔진 검증 */
  useEffect(() => {
    if (!safeRendered) return undefined
    let cancelled = false
    async function run() {
      const isMethodLocal = String(safeRendered.type ?? 'signal') === 'method'
      if (isMethodLocal) {
        setEngineValidation({
          loading: false, error: '', performance: null, trades: null,
          backtestMeta: null, recentRoi7d: null, recentRoi30d: null,
          altBasketAggregated: false, basketDetail: null, validationResult: null,
        })
        return
      }
      try {
        setEngineValidation({
          loading: true, error: '', performance: null, trades: null,
          backtestMeta: null, recentRoi7d: null, recentRoi30d: null,
          altBasketAggregated: false, basketDetail: null, validationResult: null,
        })
        const check = await runMarketSubmissionCheck(normalizeStrategyPayload(safeRendered))
        if (cancelled) return
        const bDetail = check.basketDetail ?? check.backtestMeta?.basketDetail ?? null
        const vResult = check.validationResult
          ?? check.backtestMeta?.validationResult
          ?? buildAltValidationResult(check.performance ?? null, bDetail)
        setEngineValidation({
          loading: false, error: '',
          performance: check.performance ?? null,
          trades: Array.isArray(check.trades) ? check.trades : [],
          backtestMeta: check.backtestMeta ?? null,
          recentRoi7d: check.recentRoi7d ?? null,
          recentRoi30d: check.recentRoi30d ?? null,
          altBasketAggregated: !!check.altBasketAggregated,
          basketDetail: bDetail,
          validationResult: vResult,
        })
      } catch (e) {
        if (cancelled) return
        setEngineValidation({
          loading: false,
          error: String(e?.message ?? '엔진 검증 결과를 불러오지 못했습니다.'),
          performance: null, trades: null, backtestMeta: null,
          recentRoi7d: null, recentRoi30d: null,
          altBasketAggregated: false, basketDetail: null, validationResult: null,
        })
      }
    }
    run()
    return () => { cancelled = true }
  }, [
    safeRendered?.id, safeRendered?.code, safeRendered?.conditions, safeRendered?.risk_config,
    safeRendered?.asset, safeRendered?.timeframe, safeRendered?.entryConditions,
    safeRendered?.exitConditions, safeRendered?.entryExitSplit, safeRendered?.altValidationSymbols,
  ])

  useEffect(() => {
    if (!safeRendered) return undefined
    let cancelled = false
    const isMethodLocal = String(safeRendered.type ?? 'signal') === 'method'
    async function loadPdfUrls() {
      setPdfError(''); setPreviewUrl(null); setFullUrl(null)
      setStrategyPreviewUrl(null); setStrategyFullUrl(null)
      if (!isMethodLocal) return
      try {
        const prevPath = safeRendered.method_pdf_preview_path
        const fullPath = safeRendered.method_pdf_path
        if (prevPath) { const u = await getMethodPdfSignedUrl(prevPath, { expiresIn: 60 * 10 }); if (!cancelled) setPreviewUrl(u) }
        if (fullPath) { const u2 = await getMethodPdfSignedUrl(fullPath, { expiresIn: 60 * 10 }); if (!cancelled) setFullUrl(u2) }
      } catch (e) { if (!cancelled) setPdfError(e?.message ?? 'PDF 로드 실패') }
    }
    loadPdfUrls()
    return () => { cancelled = true }
  }, [safeRendered?.type, safeRendered?.method_pdf_preview_path, safeRendered?.method_pdf_path])

  useEffect(() => {
    if (!safeRendered) return undefined
    let cancelled = false
    const isMethodLocal = String(safeRendered.type ?? 'signal') === 'method'
    async function loadStrategyPdfUrls() {
      if (isMethodLocal) return
      try {
        const prevPath = safeRendered.strategy_pdf_preview_path
        const fullPath = safeRendered.strategy_pdf_path
        if (prevPath) { const u = await getStrategyPdfSignedUrl(prevPath, { expiresIn: 60 * 10 }); if (!cancelled) setStrategyPreviewUrl(u) }
        if (fullPath) { const u2 = await getStrategyPdfSignedUrl(fullPath, { expiresIn: 60 * 10 }); if (!cancelled) setStrategyFullUrl(u2) }
      } catch (e) { if (!cancelled) setPdfError(e?.message ?? 'PDF 로드 실패') }
    }
    loadStrategyPdfUrls()
    return () => { cancelled = true }
  }, [safeRendered?.type, safeRendered?.strategy_pdf_preview_path, safeRendered?.strategy_pdf_path])

  /* 검증 요약 2줄 */
  const verSummaryLine = useMemo(() => {
    if (!verSummary) return null
    const count = Number(verSummary.last_30_signal_count ?? 0)
    const rate = Number(verSummary.match_rate ?? 0)
    const verReturn = Number(verSummary.verified_return_pct)
    const avgSec = Number(verSummary.avg_time_diff_sec ?? 0)
    const interpretation = rate >= 70
      ? '검증 일치율이 높아 신호 신뢰도가 비교적 안정적입니다.'
      : rate >= 50
        ? '기본 일치율은 확보됐지만 추가 검증 확인이 필요합니다.'
        : '일치율이 낮아 보수적으로 해석하는 편이 낫습니다.'
    if (count === 0) {
      return {
        line1: '실거래 인증 표본이 아직 충분하지 않습니다.',
        line2: '라이브·백테스트 지표를 우선 확인해 주세요.',
        line3: interpretation,
        positive: false,
      }
    }
    return {
      line1: `최근 ${count}개 시그널 중 약 ${rate.toFixed(0)}% 매칭`,
      line2: Number.isFinite(avgSec) && avgSec > 0 ? `평균 지연 약 ${Math.round(avgSec)}초` : null,
      line3: Number.isFinite(verReturn)
        ? `실거래 기준 수익률 ${verReturn >= 0 ? '+' : ''}${verReturn.toFixed(1)}% · ${interpretation}`
        : interpretation,
      positive: rate >= 60 && (!Number.isFinite(verReturn) || verReturn >= 0),
    }
  }, [verSummary])

  const trustScore = useMemo(() => {
    if (!safeRendered) return 0
    return computeTrustScore({
      matchRate: safeRendered.matchRate,
      verifiedReturn: safeRendered.verifiedReturn,
      liveReturn30d: safeRendered.recentRoi30d,
      maxDrawdown: safeRendered.maxDrawdown ?? safeRendered.mdd,
      tradeCount: safeRendered.tradeCount ?? safeRendered.trades,
      hasRealVerification: safeRendered.hasRealVerification,
    })
  }, [safeRendered])

  const trustGrade = useMemo(() => {
    return getTrustGrade(trustScore)
  }, [trustScore])

  const safe = safeRendered ?? {}

  const isUser        = !!safe.isUserStrategy
  const showTrialCta  = !user || !hasPaidPlanFeatures(user)
  const simIdForTrial = trialStrategyId || resolveSimIdForUnlock(safe)
  const subscriptions = Array.isArray(user?.unlockedStrategyIds) ? user.unlockedStrategyIds : []
  const { rules = { maxSubscriptions: 0 } } = resolvePlanAndRules(user) ?? {}
  const subscribeLimitReached = subscriptions.length >= rules.maxSubscriptions
  const isMethod      = String(safe.type ?? 'signal') === 'method'
  const codeForCopy   = String(safe.code ?? '').trim()
  const canCopyToEditor = !runLocked && !isMethod && codeForCopy.length > 0 && typeof onCopyToEditor === 'function'

  const verLevel = verSummary?.verified_badge_level ?? safe.verified_badge_level ?? 'backtest_only'

  const trustMeta = (() => {
    const author = String(
      safe.author
      ?? safe.creator
      ?? safe.creator_id
      ?? safe.user_id
      ?? 'unknown',
    ).trim()

    const toYmd = (v) => {
      const n = Number(v)
      if (Number.isFinite(n)) return fmtYMD(n)
      if (typeof v === 'string' && v.trim()) {
        const t = Date.parse(v)
        if (Number.isFinite(t)) return fmtYMD(t)
      }
      return null
    }

    const createdAt = toYmd(safe.createdAt ?? safe.created_at)
    const marketRegisteredAt = toYmd(
      safe.market_registered_at
      ?? safe.approved_at
      ?? safe.published_at
      ?? safe.submitted_at
      ?? safe.updatedAt
      ?? safe.updated_at,
    )
    const liveStartedAt = toYmd(
      safe.live_verification_started_at
      ?? safe.live_started_at
      ?? safe.liveStartAt
      ?? verSummary?.live_verification_started_at
      ?? verSummary?.live_started_at,
    )

    const apiConnected = Boolean(
      verSummary?.is_trade_verified
      ?? safe.is_trade_verified
      ?? safe.hasRealVerification,
    )
    const updatedAt = toYmd(
      safe.updatedAt
      ?? safe.updated_at
      ?? safe.market_updated_at
      ?? verSummary?.updated_at,
    )

    return {
      author,
      createdAt: createdAt ?? '—',
      marketRegisteredAt: marketRegisteredAt ?? '—',
      liveStartedAt: liveStartedAt ?? (verLevel === 'backtest_only' ? '미시작' : '—'),
      apiVerified: apiConnected ? '연결됨' : '미연결',
      updatedAt: updatedAt ?? '—',
    }
  })()

  const creatorTrustLabel = (() => {
    if (safe.isOperator || String(trustMeta.author).includes('운영')) return '운영 전략'
    if (trustMeta.apiVerified === '연결됨' || verLevel === 'trade_verified') return '검증된 제작자'
    return '신규 제작자'
  })()

  /* backtest meta */
  const bt = (() => {
    const evMeta = engineValidation.backtestMeta
    if (evMeta && typeof evMeta === 'object') return evMeta
    const rawMeta = safe.backtest_meta
    if (rawMeta && typeof rawMeta === 'object') return rawMeta
    return {}
  })()

  const trustWarnings = (() => {
    try {
      const w = buildTrustWarnings({ performance: safe.performance ?? safe, backtestMeta: bt })
      return Array.isArray(w) ? w : []
    } catch { return [] }
  })()

  const riskStatus = (() => {
    try { return computeStrategyStatus({ performance: safe.performance ?? safe, backtestMeta: bt }) } catch { return null }
  })()

  const ep          = engineValidation.performance && typeof engineValidation.performance === 'object' ? engineValidation.performance : null
  const fallbackPerf = safe.performance && typeof safe.performance === 'object' ? safe.performance : null
  const perf        = ep ?? fallbackPerf ?? {}

  const safeN = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb }

  const ret    = safeN(perf.roi    ?? safe.totalReturnPct ?? safe.roi)
  const mdd    = safeN(perf.mdd    ?? safe.maxDrawdown    ?? (safe.mdd != null ? Math.abs(safe.mdd) : undefined))
  const win    = safeN(perf.winRate ?? safe.winRate)
  const trades = safeN(perf.totalTrades ?? safe.tradeCount ?? safe.trades)

  const validationLine = (() => {
    try {
      const a = fmtYMD(bt.startTime)
      const b = fmtYMD(bt.endTime)
      const tf = bt.timeframe
      if (!a || !b || !tf) return null
      return `${a} ~ ${b} / ${tf}봉`
    } catch { return null }
  })()

  const engTrades = Array.isArray(engineValidation.trades) ? engineValidation.trades : []

  const strategyBreakdownBundle = useMemo(() => {
    if (isMethod) return null
    return buildStrategyBreakdown({
      trades: engTrades,
      performance: {
        winRate: win,
        mdd,
        roi: ret,
        totalTrades: trades,
      },
      comboRows: groupByEntryCombo(engTrades).slice(0, 12),
      assetHint: String(safe.asset ?? '').toUpperCase().includes('ALT') ? 'ALT' : '',
    })
  }, [isMethod, engTrades, win, mdd, ret, trades, safe.asset])

  const riskBreakdownBundle = useMemo(() => {
    if (isMethod) return null
    return buildStrategyRiskBreakdown({
      trades: engTrades,
      tradeRows: null,
      performance: {
        mdd,
        winRate: win,
        totalTrades: trades,
      },
    })
  }, [isMethod, engTrades, mdd, win, trades])

  const recent7d = (() => {
    const o = engineValidation.recentRoi7d
    if (o != null && Number.isFinite(Number(o))) return Number(o)
    try { return computeRecentRoiPct(engTrades, bt, 7) } catch { return null }
  })()
  const recent30d = (() => {
    const o = engineValidation.recentRoi30d
    if (o != null && Number.isFinite(Number(o))) return Number(o)
    try { return computeRecentRoiPct(engTrades, bt, 30) } catch { return null }
  })()

  const autoEvaluationText = (() => {
    if (isMethod) {
      return '매매법은 절차·리스크를 PDF에서 확인하고, 연결된 시그널 전략으로 실행 결과를 검증하세요.'
    }
    const r7Raw = recent7d ?? safe.recentRoi7d ?? safe.roi7d
    const r7Payload = (r7Raw != null && Number.isFinite(Number(r7Raw))) ? Number(r7Raw) : undefined
    const retRaw = perf.roi ?? safe.totalReturnPct ?? safe.roi
    const retPayload = (retRaw != null && Number.isFinite(Number(retRaw))) ? Number(retRaw) : undefined
    const winRaw = perf.winRate ?? safe.winRate
    const winPayload = (winRaw != null && Number.isFinite(Number(winRaw))) ? Number(winRaw) : undefined
    return buildStrategyAutoEvaluation(
      {
        recentRoi7d: r7Payload,
        totalReturnPct: retPayload,
        winRate: winPayload,
      },
      marketEvaluationContext && typeof marketEvaluationContext === 'object' ? marketEvaluationContext : {},
    )
  })()

  const strategyEvaluation = useMemo(() => {
    if (isMethod) {
      return {
        summary: '매매법(PDF)은 연결된 시그널 전략의 검증·성과와 함께 봐야 합니다.',
        strength: '절차·리스크가 문서로 정리되어 있습니다.',
        weakness: '이 화면만으로 체결 품질을 단정하기는 어렵습니다.',
        verdict: '실행 전략의 라이브·실거래 검증을 먼저 확인하는 것을 권장합니다.',
        tone: 'neutral',
        currentFit: '',
      }
    }
    const matchFromVer = verSummary != null ? Number(verSummary.match_rate ?? NaN) : NaN
    const mr = Number.isFinite(matchFromVer)
      ? matchFromVer
      : Number(safe.matchRate ?? safe.match_rate ?? 0)
    const r7 = recent7d != null && Number.isFinite(Number(recent7d))
      ? Number(recent7d)
      : Number(safe.recentRoi7d ?? safe.roi7d ?? 0)
    const payload = {
      ...safe,
      totalReturnPct: ret,
      winRate: win,
      maxDrawdown: mdd,
      tradeCount: trades,
      recentRoi7d: r7,
      matchRate: mr,
      hasRealVerification: Boolean(
        safe.hasRealVerification ?? verSummary?.is_trade_verified,
      ),
    }
    const ch = Number(marketEvaluationContext?.btcChangePercent)
    const marketSummary = (() => {
      if (!Number.isFinite(ch)) {
        return { volatilityLabel: '', marketTrend: '' }
      }
      const abs = Math.abs(ch)
      const vol = abs >= 2.5 ? '높음' : abs >= 1 ? '보통' : '낮음'
      const trend = ch >= 2
        ? '강한 상승'
        : ch >= 0.3
          ? '상승'
          : ch <= -2
            ? '강한 하락'
            : ch <= -0.3
              ? '하락'
              : '횡보'
      return { volatilityLabel: vol, marketTrend: trend }
    })()
    try {
      return evaluateStrategyWithMarket(payload, marketSummary)
    } catch {
      return {
        summary: '전략 평가를 불러오지 못했습니다.',
        strength: '—',
        weakness: '—',
        verdict: '잠시 후 다시 열어 주세요.',
        tone: 'neutral',
        currentFit: '',
      }
    }
  }, [
    isMethod,
    safe,
    ret,
    win,
    mdd,
    trades,
    recent7d,
    marketEvaluationContext,
    verSummary,
  ])

  const strategyEvalSafe = useMemo(() => {
    const ev = strategyEvaluation && typeof strategyEvaluation === 'object' ? strategyEvaluation : {}
    return {
      tone: ev.tone ?? 'neutral',
      verdict: String(ev.verdict ?? '—'),
      summary: String(ev.summary ?? '—'),
      strength: String(ev.strength ?? '—'),
      weakness: String(ev.weakness ?? '—'),
      currentFit: String(ev.currentFit ?? ''),
    }
  }, [strategyEvaluation])

  const strategyEvalPanelTone =
    strategyEvalSafe.tone === 'positive'
      ? 'rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20'
      : strategyEvalSafe.tone === 'warning'
        ? 'rounded-xl border border-amber-200 bg-amber-50/70 p-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20'
        : cn(panelEmphasis, 'p-4')

  const modalMarketState = useMemo(
    () => classifyMarketState({
      btcChange24h: marketEvaluationContext?.btcChangePercent,
      ethChange24h: marketEvaluationContext?.ethChange24h,
      avgRangePct: marketEvaluationContext?.avgRangePct,
      dominanceTrend: marketEvaluationContext?.dominanceTrend ?? '',
      volumeTrend: marketEvaluationContext?.volumeTrend ?? '',
    }),
    [marketEvaluationContext],
  )

  const strategyMarketFitLine = useMemo(
    () => (isMethod ? '' : describeStrategyMarketFit(safe, modalMarketState)),
    [isMethod, safe, modalMarketState],
  )

  const equityMiniSeries = useMemo(() => {
    const target = Number.isFinite(recent30d) ? recent30d : (Number.isFinite(ret) ? ret : 0)
    return buildMiniEquitySeries({
      seedText: `${safe.id ?? safe.name ?? 'strategy'}-${target}`,
      endValue: target,
      points: 24,
    })
  }, [safe.id, safe.name, recent30d, ret])

  const equityMiniPath = useMemo(() => {
    const arr = Array.isArray(equityMiniSeries) ? equityMiniSeries : []
    if (arr.length < 2) return ''
    const w = 100
    const h = 44
    const min = Math.min(...arr)
    const max = Math.max(...arr)
    const range = Math.max(1e-6, max - min)
    return arr
      .map((v, i) => {
        const x = (i / (arr.length - 1)) * w
        const y = h - ((v - min) / range) * h
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  }, [equityMiniSeries])

  const riskLevelMarket = (() => {
    try { return mapTrustToRiskLevelMarket(riskStatus) } catch { return '보통' }
  })()

  const liveStateHeader = useMemo(
    () => getStrategyLiveState(safe),
    [safe.id, safe.recentSignals, safe.currentDir, safe.openPosition, safe.open_position],
  )

  const modalCurrentSignalTrust = useMemo(() => {
    if (isMethod) return null
    const matchFromVer = verSummary != null ? Number(verSummary.match_rate ?? NaN) : NaN
    const mr = Number.isFinite(matchFromVer)
      ? matchFromVer
      : Number(safe.matchRate ?? safe.match_rate ?? 0)
    const rw = Number.isFinite(Number(win)) ? Number(win) : Number(safe.winRate ?? 0)
    const mf = recommendStrategiesByMarket([safe], modalMarketState)[0]?.marketFitScore ?? 50

    const rows = safeArray(safe.recentSignals)
    let latestMs = NaN
    let reasonCount = 0
    for (const raw of rows) {
      const n = Number(raw?.ts ?? raw?.timeMs)
      if (Number.isFinite(n) && n > 0) {
        latestMs = Math.max(Number.isFinite(latestMs) ? latestMs : 0, n)
      }
    }
    if (rows.length > 0) {
      const sorted = [...rows].sort((a, b) => {
        const na = Number(a?.ts ?? a?.timeMs ?? 0)
        const nb = Number(b?.ts ?? b?.timeMs ?? 0)
        return nb - na
      })
      const top = sorted[0]
      if (Array.isArray(top?.reasons)) reasonCount = top.reasons.length
      else if (Number.isFinite(Number(top?.reasonCount))) reasonCount = Number(top.reasonCount)
      if (!Number.isFinite(latestMs) || latestMs <= 0) {
        const parsed = Date.parse(String(top?.time ?? ''))
        if (Number.isFinite(parsed)) latestMs = parsed
      }
    }

    const signalAgeMinutes = Number.isFinite(latestMs) && latestMs > 0
      ? Math.max(0, (Date.now() - latestMs) / 60000)
      : 0

    const sc = computeSignalTrustScore({
      strategyTrustScore: trustScore,
      matchRate: mr,
      recentWinRate: rw,
      marketFitScore: mf,
      reasonCount,
      volatilityLabel: modalMarketState.volatilityLabel ?? '보통',
      signalAgeMinutes,
      hasRealVerification: Boolean(safe.hasRealVerification ?? verSummary?.is_trade_verified),
    })
    return {
      score: sc,
      insight: getSignalTrustInsight(sc),
      evidence: getSignalTrustEvidenceTags({
        matchRate: mr,
        recentWinRate: rw,
        marketFitScore: mf,
        reasonCount,
        hasRealVerification: Boolean(safe.hasRealVerification ?? verSummary?.is_trade_verified),
      }),
    }
  }, [
    isMethod,
    safe,
    modalMarketState,
    trustScore,
    verSummary,
    win,
  ])

  const portfolioTogetherStrategies = useMemo(() => {
    if (isMethod || !Array.isArray(strategyPool) || strategyPool.length < 2) return []
    return pickComplementaryStrategies(safe, strategyPool, modalMarketState, 2)
  }, [isMethod, safe, strategyPool, modalMarketState])

  const correlationPool = useMemo(
    () => (Array.isArray(strategyPool) ? strategyPool.filter((s) => String(s?.type ?? 'signal') !== 'method') : []),
    [strategyPool],
  )

  const correlationComplementary = useMemo(() => {
    if (isMethod || !safe?.id || correlationPool.length < 2) return []
    return findCorrelationComplements(safe, correlationPool)
  }, [isMethod, safe, correlationPool])

  const correlationOverlapping = useMemo(() => {
    if (isMethod || !safe?.id || correlationPool.length < 2) return []
    return findOverlappingStrategies(safe, correlationPool)
  }, [isMethod, safe, correlationPool])

  const complementaryIntro = useMemo(
    () => describeComplementaryIntro(safe, modalMarketState),
    [safe, modalMarketState],
  )

  const strategyScenario = useMemo(() => {
    if (isMethod) return null
    return buildStrategyScenario(
      {
        ...safe,
        trustScore,
        recentRoi7d: recent7d ?? safe.recentRoi7d ?? safe.roi7d,
        maxDrawdown: mdd,
      },
      modalMarketState,
    )
  }, [isMethod, safe, trustScore, recent7d, mdd, modalMarketState])

  const strategyScenarioSummary = useMemo(() => {
    if (!strategyScenario) return ''
    return getScenarioSummary(strategyScenario)
  }, [strategyScenario])

  const modalHighlightEvent = useMemo(() => pickHighlightMarketEvent(MANUAL_MARKET_EVENTS), [])

  const modalEventInsight = useMemo(
    () => getMarketEventInsight(modalHighlightEvent ?? {}, modalMarketState),
    [modalHighlightEvent, modalMarketState],
  )

  const modalEventOnStrategy = useMemo(() => {
    if (!modalHighlightEvent || isMethod) return null
    return getEventImpactOnStrategy(modalHighlightEvent, safe, modalMarketState)
  }, [modalHighlightEvent, isMethod, safe, modalMarketState])

  const strategyProfileBlock = useMemo(() => {
    if (isMethod) return null
    return resolveStrategyClassification(safe, {
      totalReturnPct: ret,
      winRate: win,
      tradeCount: trades,
      maxDrawdown: mdd,
      avgHoldingHours: parseAvgHoldingHours(safe.avgHolding),
    })
  }, [isMethod, safe, ret, win, trades, mdd])

  const positionLabel = liveStateHeader.kind === 'long_open'
    ? 'LONG'
    : liveStateHeader.kind === 'short_open'
      ? 'SHORT'
      : '대기'

  const fmtPctCell = (v) => {
    if (v == null || !Number.isFinite(Number(v))) return '—'
    const n = Number(v)
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
  }

  const priceInfo = useMemo(() => {
    const monthly = safe.monthly_price ?? safe.monthlyPriceKrw
    if (monthly != null && Number.isFinite(Number(monthly)) && Number(monthly) > 0) {
      const n = Number(monthly)
      return {
        headline: `월 ₩${n.toLocaleString()}`,
        detail: '정기 구독 시 월 단위로 청구됩니다.',
        short: `월 ₩${n.toLocaleString()}`,
      }
    }
    if (safe.price != null) {
      const raw = typeof safe.price === 'number' ? `₩${Number(safe.price).toLocaleString()}` : String(safe.price)
      return { headline: raw, detail: '플랜·전략에 따라 금액이 달라질 수 있습니다.', short: raw }
    }
    return {
      headline: null,
      detail: '결제 단계에서 최종 금액을 확인할 수 있습니다.',
      short: null,
    }
  }, [safe.monthly_price, safe.monthlyPriceKrw, safe.price])

  const trialEligible =
    runLocked
    && showTrialCta
    && typeof onStartTrial === 'function'
    && simIdForTrial
    && safe.ctaStatus !== 'expired'

  /* CTA 상태별 문구 (전환·가격 명확화) */
  const ctaMainLabel = (() => {
    const s = safe.ctaStatus
    if (s === 'subscribed') return '이미 구독 중입니다'
    if (s === 'active') return '구독 유지하고 계속 이용'
    if (s === 'expired') return '구독으로 다시 이용하기'
    if (trialEligible) return '7일 무료로 먼저 써보기'
    if (runLocked) return '구독하고 시그널·검증 이용'
    return '전략 실행·시그널 보기'
  })()

  const ctaSubText = (() => {
    const s = safe.ctaStatus
    if (s === 'subscribed' || s === 'active') {
      return '구독 중에는 시그널·검증·상세 기능을 제한 없이 이용할 수 있습니다. 언제든 해지 가능합니다.'
    }
    if (trialEligible) {
      const priceBit = priceInfo.short ? ` 정가는 ${priceInfo.short}입니다.` : ''
      return `7일 동안 카드 없이 무료 체험합니다. 체험 기간에는 자동 결제되지 않습니다.${priceBit} 이후 이용은 구독 시에만 과금됩니다.`
    }
    if (runLocked) {
      const priceBit = priceInfo.short ? ` 정가 ${priceInfo.short}이 적용됩니다.` : ''
      return `구독 시 실시간 시그널, 검증 탭, PDF 등 잠긴 기능이 열립니다.${priceBit}`
    }
    return '지표·검증을 확인한 뒤 실행 화면으로 이동합니다.'
  })()

  const statusBadgeLabel = (() => {
    const v = String(safe.recommendBadge ?? safe.statusBadge ?? '').trim()
    if (v) return v
    if (safe.isPopular) return '인기'
    if (safe.isNew) return '신규'
    if (safe.isRecommended) return '추천'
    return null
  })()

  const ctaMainAction = (() => {
    if (!runLocked) {
      if (typeof onSimulate === 'function') {
        return {
          label: isMethod ? '연결 전략 실행' : '전략 실행 보기',
          onClick: () => { requestClose(); onSimulate() },
          disabled: false,
        }
      }
      return null
    }

    if (safe.ctaStatus === 'subscribed') {
      return {
        label: ctaMainLabel,
        onClick: null,
        disabled: true,
      }
    }

    if (showTrialCta && typeof onStartTrial === 'function' && simIdForTrial && safe.ctaStatus !== 'expired') {
      return {
        label: ctaMainLabel,
        onClick: () => { onStartTrial(simIdForTrial); requestClose() },
        disabled: false,
      }
    }

    if (typeof onSubscribe === 'function') {
      return {
        label: ctaMainLabel,
        onClick: () => onSubscribe(),
        disabled: subscribeLimitReached,
      }
    }

    return null
  })()

  const ctaSecondaryAction = (() => {
    if (!isMethod && typeof onGoValidation === 'function') {
      return {
        label: '검증·시그널 먼저 보기',
        onClick: () => { requestClose(); onGoValidation() },
      }
    }
    if (runLocked && typeof onSubscribe === 'function' && ctaMainAction?.onClick !== onSubscribe) {
      return {
        label: safe.ctaStatus === 'expired' ? '구독으로 계속 이용하기' : '지금 구독하기',
        onClick: () => onSubscribe(),
      }
    }
    return null
  })()

  async function handleCopyToEditor() {
    if (!canCopyToEditor) return
    try {
      await navigator.clipboard.writeText(codeForCopy)
      setCopyClipboardErr('')
    } catch {
      setCopyClipboardErr('클립보드에 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.')
      return
    }
    onCopyToEditor(safe)
    requestClose()
  }

  /* 닫힌 상태(strategy=null)에서는 오버레이 없음. 로딩은 모든 훅 이후에만 분기(훅 개수 일치). */
  if (!isReady) {
    if (!strategy) return null
    return (
      <div
        role="presentation"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      >
        <div className="w-full max-w-[440px] space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            전략 데이터를 불러오는 중입니다
          </p>
          <StrategyCardSkeleton />
        </div>
      </div>
    )
  }

  /* ─── JSX ─── */
  return (
    <div
      role="presentation"
      className={cn(
        'fixed inset-0 z-50 flex min-h-0 items-center justify-center p-4 bg-black/40',
        'transition-opacity duration-200 ease-out',
        open ? 'opacity-100' : 'opacity-0',
      )}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'detail-modal relative bg-white dark:bg-gray-900',
          'w-full min-w-0 max-w-[min(1440px,calc(100vw-1.25rem))]',
          'rounded-lg',
          'border border-slate-200 dark:border-gray-700',
          'max-h-[min(90vh,100dvh)] flex min-h-0 flex-col overflow-hidden',
          'transition-[opacity,transform] duration-200 ease-out',
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]',
        )}
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ════════════════════════════════════════════
            SCROLL 영역 — 상세 전체 (긴 콘텐츠도 모달 내부에서만 스크롤)
            ════════════════════════════════════════════ */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 min-h-0 min-w-0 overscroll-contain px-4 py-3 space-y-6 [overflow-anchor:none]">

          {/* ── 1) 전략명 + 배지 + 상태 ── */}
          <div className="flex flex-col gap-4 pt-0 pb-0">
            <button
              type="button"
              onClick={requestClose}
              className="mb-0 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              ← 전략 마켓으로
            </button>
            <div className={cn(panelBase, 'px-4 py-3')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-50 leading-snug">
                    {safe.name ?? '—'}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <VerificationBadge level={verLevel} size="xs" />
                    {statusBadgeLabel && <Badge variant="default">{statusBadgeLabel}</Badge>}
                    <Badge variant={riskMarketVariant(riskLevelMarket)}>{riskLevelMarket}</Badge>
                    <Badge variant={dirVariant(positionLabel === '대기' ? null : positionLabel)} className="text-[11px]">
                      {positionLabel}
                    </Badge>
                    {runLocked && (
                      <Badge variant="warning">
                        <Lock size={9} className="mr-0.5 inline-block" strokeWidth={2} aria-hidden />
                        구독 혜택
                      </Badge>
                    )}
                  </div>
                  {!isMethod && runLocked && (
                    <>
                      <p className="mt-2 text-[11px] font-medium leading-snug text-amber-900 dark:text-amber-100/95 rounded-lg border border-amber-200/90 bg-amber-50/95 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-950/35">
                        {FREE_VS_PAID.lockedBanner}
                      </p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] leading-snug">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{FREE_VS_PAID.freeTitle}</p>
                          <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-400">
                            {FREE_VS_PAID.freeItems.map((t) => (
                              <li key={t}>· {t}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-2 dark:border-blue-900/45 dark:bg-blue-950/30">
                          <p className="font-semibold text-blue-900 dark:text-blue-100">{FREE_VS_PAID.paidTitle}</p>
                          <ul className="mt-1 space-y-0.5 text-blue-900/90 dark:text-blue-100/90">
                            {FREE_VS_PAID.paidItems.map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {recent7d != null && Number.isFinite(Number(recent7d)) && (
                        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                          최근 7일 수익률
                          {' '}
                          <span className={cn(
                            'font-semibold tabular-nums',
                            Number(recent7d) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
                          )}
                          >
                            {fmtPctCell(recent7d)}
                          </span>
                        </p>
                      )}
                      {Number.isFinite(Number(safe.subscriber_count)) && Number(safe.subscriber_count) > 0 && (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          이 전략 구독
                          {' '}
                          {Number(safe.subscriber_count).toLocaleString()}
                          명
                        </p>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-gray-800 rounded-md transition-[color,background-color] duration-[120ms]"
                  aria-label="닫기"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              {!isMethod && runLocked && typeof onSubscribe === 'function' && safe.ctaStatus !== 'subscribed' && (
                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-white px-3 py-3 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-gray-900/80 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">구독 요금</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
                      {priceInfo.short ?? SUBSCRIBE_STICKY.priceLabel(STRATEGY_MONTHLY_PRICE_KRW)}
                    </p>
                    <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                      🔥 첫 달 ₩
                      {FIRST_MONTH_PROMO_PRICE_KRW.toLocaleString()}
                      {' '}
                      · 또는 첫
                      {' '}
                      {FIRST_TRIAL_DAYS_DISPLAY}
                      일 무료 체험
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-[200px] sm:items-stretch">
                    <SubscribeCtaButton
                      size="md"
                      onClick={() => onSubscribe()}
                      disabled={subscribeLimitReached}
                      className="w-full justify-center"
                    >
                      {SUBSCRIBE_STICKY.cta}
                    </SubscribeCtaButton>
                    {trialEligible && typeof onStartTrial === 'function' && simIdForTrial && (
                      <SubscribeCtaButton
                        size="sm"
                        variant="outline"
                        onClick={() => { onStartTrial(simIdForTrial); requestClose() }}
                        className="w-full justify-center"
                      >
                        {FIRST_TRIAL_DAYS_DISPLAY}
                        일 무료로 먼저 써보기
                      </SubscribeCtaButton>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className={cn(panelSoft, 'px-4 py-3')}>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                전략 자동 평가
              </p>
              <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-snug">
                {autoEvaluationText}
              </p>
            </div>
            <div className={cn(strategyEvalPanelTone)}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                Strategy Evaluation
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {strategyEvalSafe.verdict}
              </p>
              {Boolean(strategyMarketFitLine) && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-snug">
                  {strategyMarketFitLine}
                </p>
              )}
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">요약: </span>
                  {strategyEvalSafe.summary}
                </p>
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">강점: </span>
                  {strategyEvalSafe.strength}
                </p>
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">약점: </span>
                  {strategyEvalSafe.weakness}
                </p>
                {Boolean(strategyEvalSafe.currentFit) && (
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-300">현재 적합성: </span>
                    {strategyEvalSafe.currentFit}
                  </p>
                )}
              </div>
            </div>
            <div className={cn(panelSoft, 'px-4 py-3')}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Trust Meta
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                  {trustMeta.author}
                </span>
                <span className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  creatorTrustLabel === '검증된 제작자'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                    : creatorTrustLabel === '운영 전략'
                      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-slate-300',
                )}>
                  {creatorTrustLabel}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
                {[
                  ['제작자', trustMeta.author, 'text-slate-800 dark:text-slate-200'],
                  ['생성일', trustMeta.createdAt, 'text-slate-800 dark:text-slate-200'],
                  ['등록일', trustMeta.marketRegisteredAt, 'text-slate-800 dark:text-slate-200'],
                  ['라이브 시작', trustMeta.liveStartedAt, 'text-slate-800 dark:text-slate-200'],
                  ['실거래 인증', trustMeta.apiVerified, trustMeta.apiVerified === '연결됨' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40">
                    <p className="text-[11px] text-slate-400">{label}</p>
                    <p className={cn('mt-1 text-sm font-medium', tone)}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={cn(
              trustMeta.apiVerified === '연결됨' ? panelPositive : panelSoft,
              'px-4 py-3',
            )}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Trust Evidence
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {trustMeta.apiVerified === '연결됨'
                  ? '실거래 인증이 연결되어 체결 데이터 기반으로 검증 중입니다.'
                  : '현재는 백테스트/라이브 중심 검증이며 실거래 인증 연결 대기 상태입니다.'}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                검증 구조: 백테스트 → 라이브 추적 → 실거래 비교
              </p>
              <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 list-disc list-inside">
                <li>거래소 API 연결 기반</li>
                <li>시그널과 실제 체결을 비교</li>
                <li>수동 입력 기록 아님</li>
              </ul>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <p className="text-slate-500 dark:text-slate-400">
                  데이터 갱신:
                  {' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{trustMeta.updatedAt}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  검증 배지:
                  {' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{verLevel}</span>
                </p>
              </div>
            </div>
            <div className={cn(panelBase, 'px-4 py-3')}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Quick Check
              </p>
              <div className="mt-2 grid grid-cols-1 gap-1 text-[12px] text-slate-600 dark:text-slate-300">
                <p><span className="font-semibold text-slate-800 dark:text-slate-100">1.</span> 수익률/MDD/거래 수 먼저 확인</p>
                <p><span className="font-semibold text-slate-800 dark:text-slate-100">2.</span> 검증 요약으로 신뢰도 판단</p>
                <p><span className="font-semibold text-slate-800 dark:text-slate-100">3.</span> 시그널 보기로 실행 흐름 확인</p>
              </div>
            </div>
          </div>

          {/* ── 2) 핵심 KPI 4개 ── */}
          {!isMethod && (
            <div className="px-4 pb-3">
              {engineValidation.loading && (
                <p className="text-[10px] text-slate-400 mb-1.5">엔진 계산 중…</p>
              )}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className={cn(panelBase, 'p-4')}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">수익률</p>
                  <p className={cn(
                    'mt-2 text-2xl font-bold tabular-nums',
                    Number.isFinite(ret) ? (ret >= 0 ? 'text-emerald-600 font-semibold dark:text-emerald-400' : 'text-rose-600 font-semibold dark:text-rose-400') : 'text-slate-800 dark:text-slate-100',
                  )}>
                    {Number.isFinite(ret) ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {validationLine ? `${validationLine} 기준` : '선택 기간 백테스트 기준'}
                  </p>
                </div>
                <div className={cn(panelBase, 'p-4')}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">MDD</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {Number.isFinite(mdd) ? `-${mdd.toFixed(1)}%` : '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">같은 기간 백테스트 기준, 낮을수록 안정적</p>
                </div>
                <div className={cn(panelBase, 'p-4')}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">승률</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {Number.isFinite(win) ? `${win.toFixed(1)}%` : '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">백테스트 거래 기준 승리 비율</p>
                </div>
                <div className={cn(panelBase, 'p-4')}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">거래 수</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {Number.isFinite(trades) ? String(trades) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">백테스트 표본 수, 많을수록 신뢰도 상승</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 dark:text-slate-500 space-y-0.5 px-0.5">
                <p>{safe.hasRealVerification ? '실거래 인증 ✔' : '실거래 인증 여부는 상단 배지를 확인하세요'}</p>
                <p>백테스트: 2021~2024</p>
                <p>실시간 검증: 2025~</p>
              </div>
            </div>
          )}

          {!isMethod && (
            <div className="px-4 pb-3">
              <StrategyLiveStatusCard strategy={safe} live={liveStateHeader} emphasis />
              {modalCurrentSignalTrust && (
                <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-gray-700 dark:bg-gray-900/60">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Current signal trust
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    현재 신호 신뢰도 {modalCurrentSignalTrust.score}점
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {modalCurrentSignalTrust.insight}
                  </p>
                  {modalCurrentSignalTrust.evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {modalCurrentSignalTrust.evidence.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-black/20 dark:text-slate-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isMethod && strategyProfileBlock && (
            <div className="px-4 pb-3">
              <StrategyProfileCard
                typeLabel={strategyProfileBlock.typeLabel}
                profileLabel={strategyProfileBlock.profileLabel}
                summary={strategyProfileBlock.profileSummary}
              />
            </div>
          )}

          {!isMethod && modalHighlightEvent && modalEventOnStrategy && (
            <div className="px-4 pb-3">
              <div className="rounded-2xl border border-amber-200/90 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                  Market Event
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {modalHighlightEvent.title}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {modalEventInsight.summary}
                </p>
                <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    <span className="font-medium text-slate-700 dark:text-slate-200">이 전략 영향: </span>
                    {modalEventOnStrategy.impactLevel === 'positive'
                      ? '긍정적 참고'
                      : modalEventOnStrategy.impactLevel === 'warning'
                        ? '주의'
                        : '중립'}
                  </p>
                  <p className="leading-snug">{modalEventOnStrategy.action}</p>
                </div>
              </div>
            </div>
          )}

          {!isMethod && strategyScenario && (
            <div className="px-4 pb-3">
              <div
                className={
                  strategyScenario.confidence === '높음'
                    ? 'rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20'
                    : strategyScenario.confidence === '주의'
                      ? 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20'
                      : 'rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70'
                }
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Strategy Scenario
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {strategyScenarioSummary}
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <p>기대 시나리오: {strategyScenario.primaryScenario}</p>
                  <p>위험 시나리오: {strategyScenario.riskScenario}</p>
                  <p>행동 가이드: {strategyScenario.actionGuide}</p>
                </div>
                <div className="mt-3">
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-black/20 dark:text-slate-200">
                    신뢰도: {strategyScenario.confidence}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!isMethod && (
            <div className="px-4 pb-3">
              <div className={cn(panelBase, 'p-4')}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">누적 수익 그래프</p>
                  <p className="text-[11px] text-slate-400">최근 시간 흐름</p>
                </div>
                <div className="mt-3 h-[76px] rounded-lg border border-slate-100 bg-slate-50/70 p-2 dark:border-gray-800 dark:bg-gray-900/40">
                  <svg viewBox="0 0 100 44" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
                    <path
                      d={equityMiniPath}
                      fill="none"
                      stroke={Number((equityMiniSeries ?? []).at?.(-1) ?? 0) >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  시간 기준 누적 성과 변화입니다. 단일 수치보다 흐름의 안정성을 함께 확인하세요.
                </p>
              </div>
            </div>
          )}

          {/* ── 3) 검증 요약 박스 ── */}
          {!isMethod && (
            <div className="px-4 pb-3">
              <div className={cn(verSummaryLine?.positive ? panelPositive : panelSoft, 'px-4 py-3')}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Verification Summary</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {verSummaryLine?.line1 ?? '최근 검증 표본이 충분하지 않아 추적 데이터를 수집 중입니다.'}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {verSummaryLine?.line2
                    ?? `검증 기간 ${validationLine ?? '집계 중'} · 신뢰도 ${trustScore}점`}
                </p>
                {verSummaryLine?.line3 && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    해석: {verSummaryLine.line3}
                  </p>
                )}
              </div>
              <div className={cn(panelSoft, 'mt-3 p-4')}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Verification Guide
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <li>백테스트: 과거 데이터 기준 성과입니다.</li>
                  <li>라이브 검증: 전략 등록 이후 실시간 시장 성과입니다.</li>
                  <li>실거래 인증: 판매자 실제 체결과 시그널 비교 결과입니다.</li>
                </ul>
              </div>
            </div>
          )}

          {!isMethod && portfolioTogetherStrategies.length > 0 && typeof onOpenRelatedStrategy === 'function' && (
            <div className="px-4 pb-3">
              <div className={cn(panelSoft, 'p-4')}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Together with
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  이 전략과 함께 보면 좋은 전략
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {complementaryIntro}
                </p>
                <ul className="mt-3 space-y-2">
                  {portfolioTogetherStrategies.map((rel) => (
                    <li key={rel.id}>
                      <button
                        type="button"
                        onClick={() => onOpenRelatedStrategy(rel)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:bg-gray-800/50"
                      >
                        <span className="min-w-0 font-medium text-slate-800 dark:text-slate-100 truncate">
                          {rel.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-sky-600 dark:text-sky-400">
                          {rel.typeLabel ?? '—'} · {rel.profileLabel ?? '—'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {!isMethod && correlationComplementary.length > 0 && typeof onOpenRelatedStrategy === 'function' && (
            <section className="px-4 pb-3 mt-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Complementary Picks
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  같이 쓰면 좋은 전략
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  유사도는 낮고 분산 점수가 높은 편으로, 함께 볼 만한 조합입니다. (참고용)
                </p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {correlationComplementary.map((s) => (
                  <button
                    key={`corr-comp-${s.id}`}
                    type="button"
                    onClick={() => onOpenRelatedStrategy(s)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-slate-50/80 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-sky-800 dark:hover:bg-gray-800/40"
                  >
                    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                      {s.name}
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-gray-800 dark:text-slate-300">
                        {s.typeLabel ?? '—'}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                        {s.profileLabel ?? '—'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-snug line-clamp-3">
                      {s.pairRecommendation}
                    </p>
                    <p className="mt-3 text-xs text-slate-400 tabular-nums">
                      분산 점수 {Math.round(Number(s.pairDiversification ?? 0))}점
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {!isMethod && correlationOverlapping.length > 0 && (
            <section className="px-4 pb-3 mt-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Overlapping Picks
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  성격이 비슷한 전략
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  함께 써도 효과가 겹칠 수 있는 전략입니다. (참고용)
                </p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {correlationOverlapping.map((s) => (
                  <div
                    key={`corr-over-${s.id}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20"
                  >
                    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                      {s.name}
                    </h4>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-snug line-clamp-3">
                      {s.pairSummary}
                    </p>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      유사도 {Math.round(Number(s.pairSimilarity ?? 0))}점
                    </p>
                    {typeof onOpenRelatedStrategy === 'function' ? (
                      <button
                        type="button"
                        onClick={() => onOpenRelatedStrategy(s)}
                        className="mt-3 text-xs font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400"
                      >
                        상세 보기 →
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── 4) CTA 액션 박스 ── */}
          <div className="px-4 pb-4 border-b border-slate-100 dark:border-gray-800">
            <div className={cn(panelBase, 'p-4')}>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {trialEligible
                  ? '7일 무료 체험으로 먼저 써보세요'
                  : runLocked
                    ? '구독 시 열리는 혜택'
                    : '이 전략을 바로 확인해보세요'}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {trialEligible
                  ? '카드 없이 시작 · 체험 중 자동 결제 없음 · 만족할 때만 구독을 선택하세요.'
                  : runLocked
                    ? '실시간 시그널, 검증 탭, PDF·코드 등 잠금 해제 후 전체 흐름을 이용할 수 있습니다.'
                    : '지표와 검증을 본 뒤 시그널 화면에서 실행 흐름을 확인하세요.'}
              </p>
              {runLocked && (
                <div className={cn(
                  'mt-3 rounded-xl border px-3 py-2',
                  trialEligible
                    ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/25'
                    : 'border-slate-200 bg-slate-50/80 dark:border-gray-700 dark:bg-gray-800/40',
                )}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    가격
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {priceInfo.headline ?? '플랜·결제 단계에서 확인'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {priceInfo.detail}
                  </p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  trialEligible
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-slate-300',
                )}>
                  7일 무료 체험
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-slate-300">
                  자동 결제 없음
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-slate-300">
                  언제든 해지 가능
                </span>
              </div>
              {runLocked && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 list-disc list-inside">
                  <li>실시간 LONG/SHORT/EXIT 시그널</li>
                  <li>백테스트·라이브·실거래 검증 탭</li>
                  <li>전략 PDF·상세 리포트(잠금 해제 시)</li>
                </ul>
              )}

              {!isMethod && (
                <div className={cn(panelSoft, 'mt-3 px-3 py-2.5')}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    비구독자도 아래 핵심 지표는 결제 전 확인할 수 있습니다.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                    <p className="text-slate-600 dark:text-slate-300">
                      최근 성과:
                      {' '}
                      <span className={cn(
                        'font-semibold',
                        recent7d != null && Number(recent7d) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100',
                      )}>
                        {fmtPctCell(recent7d)}
                      </span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      수익률:
                      {' '}
                      <span className={cn(
                        'font-semibold',
                        Number.isFinite(ret) && ret < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100',
                      )}>
                        {Number.isFinite(ret) ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : '—'}
                      </span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      MDD:
                      {' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Number.isFinite(mdd) ? `-${mdd.toFixed(1)}%` : '—'}
                      </span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      거래 수:
                      {' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Number.isFinite(trades) ? String(trades) : '—'}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {!isMethod && typeof onToggleCompare === 'function' && !isUser && (
                <div className={cn(panelBase, 'mt-4 px-3 py-2.5')}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Strategy Compare
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    마켓 상단 비교 표에 이 전략을 넣어 성격·리스크·신뢰를 나란히 볼 수 있습니다. (최대 3개)
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={compareAddDisabled && !isCompared}
                      className="w-full sm:w-auto"
                      onClick={() => onToggleCompare(safe)}
                    >
                      {isCompared ? '비교에서 제거' : compareAddDisabled ? '비교 슬롯 가득 참' : '이 전략 비교에 추가'}
                    </Button>
                    {compareAddDisabled && !isCompared && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300">
                        비교는 최대 3개까지입니다. 기존 항목을 빼고 추가하세요.
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {ctaMainAction && (
                runLocked ? (
                  <SubscribeCtaButton
                    size="md"
                    className="flex-1"
                    disabled={ctaMainAction.disabled}
                    onClick={ctaMainAction.onClick ?? undefined}
                  >
                    {ctaMainAction.label}
                  </SubscribeCtaButton>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className="flex-1"
                    disabled={ctaMainAction.disabled}
                    onClick={ctaMainAction.onClick ?? undefined}
                  >
                    {ctaMainAction.label}
                  </Button>
                )
              )}
              {ctaSecondaryAction && (
                runLocked ? (
                  <SubscribeCtaButton
                    variant="outline"
                    size="md"
                    onClick={ctaSecondaryAction.onClick}
                  >
                    {ctaSecondaryAction.label}
                  </SubscribeCtaButton>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={ctaSecondaryAction.onClick}
                  >
                    {ctaSecondaryAction.label}
                  </Button>
                )
              )}
            </div>
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                {ctaSubText}
              </p>
            </div>
            {!isMethod && trustWarnings.length > 0 && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">주의할 점</p>
                <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80 line-clamp-2">
                  {trustWarnings[0]}
                </p>
              </div>
            )}
          </div>

          {copyClipboardErr && (
            <p className="text-[10px] text-red-500 dark:text-red-400 leading-snug">{copyClipboardErr}</p>
          )}

          {/* 추가 판단 정보 */}
          {!isMethod && (
            <SectionErrorBoundary>
              <div className="grid grid-cols-2 sm:grid-cols-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <InfoCell
                  label="최근 7일"
                  value={fmtPctCell(recent7d)}
                  positive={recent7d != null && Number(recent7d) >= 0}
                  negative={recent7d != null && Number(recent7d) < 0}
                />
                <InfoCell
                  label="최근 30일"
                  value={fmtPctCell(recent30d)}
                  positive={recent30d != null && Number(recent30d) >= 0}
                  negative={recent30d != null && Number(recent30d) < 0}
                />
                <div className="border-r last:border-r-0 border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-gray-900/60">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">현재 상태</p>
                  <Badge variant={dirVariant(positionLabel === '대기' ? null : positionLabel)} className="text-[11px]">
                    {positionLabel}
                  </Badge>
                </div>
                <div className="border-r border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-gray-900/60 sm:col-span-1">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">리스크</p>
                  <Badge variant={riskMarketVariant(riskLevelMarket)}>{riskLevelMarket}</Badge>
                </div>
                <InfoCell
                  label="검증 기간"
                  value={validationLine ?? '—'}
                  sub={bt.candleCount != null ? `${bt.candleCount}봉` : undefined}
                />
              </div>
            </SectionErrorBoundary>
          )}

          {/* ALT 바스켓 상세 */}
          {!isMethod && (String(safe.asset ?? '').toUpperCase() === 'ALT' || engineValidation.altBasketAggregated) && (
            <div className="rounded-md border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/65 dark:bg-indigo-950/25 px-2 py-1.5">
              <p className="text-[10px] text-indigo-900 dark:text-indigo-200 leading-snug">
                {assetUniverseCopy.altBasketValidation}
              </p>
            </div>
          )}

          {!isMethod && engineValidation.validationResult && (
            <SectionErrorBoundary>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-gray-900/35 px-3 py-2">
                <SLabel>ALT · 분포·개별 성과</SLabel>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 mb-2">
                  ROI 표준편차{' '}
                  <span className="font-mono tabular-nums">{engineValidation.validationResult.roiStd}%</span>
                  {' · 편차 '}
                  <span className="font-semibold">{engineValidation.validationResult.varianceLabel}</span>
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="rounded border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-gray-900/60 px-2 py-1">
                    <p className="text-[9px] text-slate-500">최고 ROI</p>
                    <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      {engineValidation.validationResult.best?.symbol}{' '}
                      <span className="tabular-nums">
                        {Number.isFinite(Number(engineValidation.validationResult.best?.roi))
                          ? `${Number(engineValidation.validationResult.best.roi) >= 0 ? '+' : ''}${Number(engineValidation.validationResult.best.roi).toFixed(1)}%`
                          : '—'}
                      </span>
                    </p>
                  </div>
                  <div className="rounded border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-gray-900/60 px-2 py-1">
                    <p className="text-[9px] text-slate-500">최저 ROI</p>
                    <p className="font-mono font-semibold text-red-700 dark:text-red-400">
                      {engineValidation.validationResult.worst?.symbol}{' '}
                      <span className="tabular-nums">
                        {Number.isFinite(Number(engineValidation.validationResult.worst?.roi))
                          ? `${Number(engineValidation.validationResult.worst.roi) >= 0 ? '+' : ''}${Number(engineValidation.validationResult.worst.roi).toFixed(1)}%`
                          : '—'}
                      </span>
                    </p>
                  </div>
                </div>
                <ul className="mt-2 max-h-[100px] overflow-y-auto space-y-1 text-[9px] font-mono border-t border-slate-200 dark:border-slate-700 pt-1.5">
                  {safeArray(engineValidation.validationResult.perSymbol).map((row) => (
                    <li key={row.symbol} className="flex flex-col gap-0.5 border-b border-slate-100 dark:border-gray-800 pb-1 last:border-0">
                      <span className="flex justify-between gap-2">
                        <span>{row.symbol}</span>
                        <span className="tabular-nums">
                          {Number.isFinite(Number(row.roi))
                            ? `${Number(row.roi) >= 0 ? '+' : ''}${Number(row.roi).toFixed(1)}%`
                            : '—'}
                        </span>
                      </span>
                      <span className="text-[8px] text-slate-500 flex justify-between gap-2">
                        <span>MDD {formatDisplayMdd(row.mdd)}</span>
                        <span>승률 {formatDisplayWinRate(row.winRate)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </SectionErrorBoundary>
          )}

          {/* 판단 전 확인 (경고) */}
          {!isMethod && Array.isArray(trustWarnings) && trustWarnings.length > 0 && (
            <SectionErrorBoundary>
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2.5">
                <SLabel>판단 전 확인</SLabel>
                <ul className="list-disc list-inside text-[11px] text-amber-800 dark:text-amber-200 space-y-1 mt-1">
                  {trustWarnings.map((w, i) => <li key={i}>{typeof w === 'string' ? w : String(w)}</li>)}
                </ul>
              </div>
            </SectionErrorBoundary>
          )}

          {/* 검증 탭 */}
          {!isMethod && (
            <SectionErrorBoundary>
              <div className="border-t border-slate-100 dark:border-gray-800 pt-3">
                <StrategyVerificationTabs strategy={safe} />
              </div>
            </SectionErrorBoundary>
          )}

          {!isMethod && strategyBreakdownBundle && (
            <SectionErrorBoundary>
              <StrategyBreakdownSection
                breakdown={strategyBreakdownBundle}
                showMeta={!engineValidation.loading}
              />
            </SectionErrorBoundary>
          )}

          {!isMethod && riskBreakdownBundle && (
            <SectionErrorBoundary>
              <StrategyRiskBreakdownSection
                risk={riskBreakdownBundle}
                className="mt-4"
                showMeta={!engineValidation.loading}
              />
            </SectionErrorBoundary>
          )}

          {/* 전략 설명 (하단 이동) */}
          {!isMethod && (
            <SectionErrorBoundary>
              <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5 space-y-2">
                <SLabel>전략 상세</SLabel>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">전략 개요</p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    {String(safe.strategy_summary ?? '').trim() || '등록된 요약이 없습니다.'}
                  </p>
                </div>
                {String(safe.market_condition ?? '').trim() && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">적합한 시장 조건</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {String(safe.market_condition).trim()}
                    </p>
                  </div>
                )}
                {String(safe.risk_description ?? '').trim() && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">리스크 요인</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {String(safe.risk_description).trim()}
                    </p>
                  </div>
                )}
              </div>
            </SectionErrorBoundary>
          )}

          {/* 매매법(Method) 전용 */}
          {isMethod && (
            <SectionErrorBoundary>
              <div className="rounded-lg border border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/25 px-3 py-3 space-y-2">
                <SLabel>매매법 (PDF)</SLabel>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  상세 해부·거래 로그는 연결된 <span className="font-semibold text-slate-700 dark:text-slate-200">실행 전략</span> 기준 검증 페이지에서 확인하세요.
                </p>
                {pdfError && <p className="text-[11px] text-amber-700 dark:text-amber-400">{pdfError}</p>}
                <div className="flex flex-wrap gap-2">
                  {fullUrl && !runLocked && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => window.open(fullUrl, '_blank', 'noopener,noreferrer')}>
                      <FileText size={12} className="mr-1" />
                      PDF 열기
                    </Button>
                  )}
                  {runLocked && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Lock size={12} />
                      PDF 전문·해부는 구독 후 이용할 수 있습니다.
                    </div>
                  )}
                  <Badge variant="default">연결: {safe.linkedSignalName ?? '—'}</Badge>
                </div>
              </div>
            </SectionErrorBoundary>
          )}

          {/* 구독 시 추가 열림 (잠김 상태) */}
          {runLocked && !isMethod && (
            <SectionErrorBoundary>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-gray-800/40 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-1.5">구독 시 추가로 열립니다</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-1.5"><Lock size={10} className="mt-0.5 shrink-0" />전체 거래 로그·진입 근거</li>
                  <li className="flex items-start gap-1.5"><Lock size={10} className="mt-0.5 shrink-0" />PDF 전문·실시간 멀티 시그널</li>
                </ul>
              </div>
            </SectionErrorBoundary>
          )}

          {/* 에디터 복사 */}
          {canCopyToEditor && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => { void handleCopyToEditor() }}
            >
              에디터로 개선
            </Button>
          )}

          {runLocked && !isMethod && typeof onSubscribe === 'function' && safe.ctaStatus !== 'subscribed' && (
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-gray-900/90">
              <p className="text-center text-[15px] font-bold text-slate-900 dark:text-slate-50">
                {SUBSCRIBE_STICKY.title}
              </p>
              <p className="mt-2 text-center text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {SUBSCRIBE_STICKY.priceLabel(STRATEGY_MONTHLY_PRICE_KRW)}
                <span className="text-slate-400 dark:text-slate-500"> → </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  첫 달 ₩{FIRST_MONTH_PROMO_PRICE_KRW.toLocaleString()}
                </span>
              </p>
              <SubscribeCtaButton
                size="lg"
                className="mt-3 w-full"
                onClick={() => onSubscribe()}
                disabled={subscribeLimitReached}
              >
                {SUBSCRIBE_STICKY.cta}
              </SubscribeCtaButton>
              <p className="mt-2 text-center text-[12px] text-slate-500 dark:text-slate-400">
                {SUBSCRIBE_STICKY.cancelHint}
              </p>
            </div>
          )}

          {/* 면책 */}
          {!isUser && (
            <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-relaxed border-t border-slate-100 dark:border-gray-800 pt-2">
              본 플랫폼은 투자 자문을 제공하지 않으며,
              <br />
              모든 투자 판단과 책임은 사용자 본인에게 있습니다.
            </p>
          )}
        </div>
        </div>

        {/* 하단 고정 구독 카드 — 스크롤과 무관하게 항상 노출 (잠금 전략만) */}
        {!isMethod && runLocked && typeof onSubscribe === 'function' && safe.ctaStatus !== 'subscribed' && (
          <div className="relative z-20 flex-shrink-0 border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] dark:border-gray-700 dark:from-gray-900 dark:to-gray-950">
            <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-lg dark:border-blue-900/40 dark:bg-gray-900/90">
              <p className="text-center text-[15px] font-bold text-slate-900 dark:text-slate-50">
                {SUBSCRIBE_STICKY.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                  {SUBSCRIBE_STICKY.promoBanner}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {SUBSCRIBE_STICKY.promoDetail}
                </span>
              </div>
              <p className="mt-2 text-center text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {SUBSCRIBE_STICKY.priceLabel(STRATEGY_MONTHLY_PRICE_KRW)}
                <span className="text-slate-400 dark:text-slate-500"> → </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  첫 달 ₩{FIRST_MONTH_PROMO_PRICE_KRW.toLocaleString()}
                </span>
              </p>
              <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
                또는 첫 {FIRST_TRIAL_DAYS_DISPLAY}일 무료 체험 후 결제 선택
              </p>
              <SubscribeCtaButton
                size="lg"
                className="mt-3 w-full"
                onClick={() => onSubscribe()}
                disabled={subscribeLimitReached}
              >
                {SUBSCRIBE_STICKY.cta}
              </SubscribeCtaButton>
              <p className="mt-2 text-center text-[12px] text-slate-500 dark:text-slate-400">
                {SUBSCRIBE_STICKY.cancelHint}
              </p>
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-600 dark:border-gray-800 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <span className={verLevel === 'trade_verified' || safe.hasRealVerification ? 'text-emerald-600' : 'text-slate-400'}>
                    {verLevel === 'trade_verified' || safe.hasRealVerification ? '✔' : '○'}
                  </span>
                  {SUBSCRIBE_STICKY.trust.realTrade}
                </li>
                <li className="flex items-center gap-2">
                  <span className={Number(trades) >= 20 ? 'text-emerald-600' : 'text-slate-400'}>{Number(trades) >= 20 ? '✔' : '○'}</span>
                  {SUBSCRIBE_STICKY.trust.backtest}
                </li>
                <li className="flex items-center gap-2">
                  <span className={verLevel === 'live_verified' || verLevel === 'trade_verified' ? 'text-emerald-600' : 'text-slate-400'}>
                    {verLevel === 'live_verified' || verLevel === 'trade_verified' ? '✔' : '○'}
                  </span>
                  {SUBSCRIBE_STICKY.trust.liveVerify}
                </li>
              </ul>
              {recent7d != null && Number.isFinite(Number(recent7d)) && (
                <p className="mt-2 text-center text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                  최근 7일 수익률{' '}
                  <span className={Number(recent7d) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                    {fmtPctCell(recent7d)}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
        {!isMethod && typeof onSubscribe === 'function' && safe.ctaStatus === 'subscribed' && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-[12px] font-medium text-emerald-800 dark:border-gray-700 dark:bg-emerald-950/25 dark:text-emerald-200">
            이 전략은 구독 중입니다 · 시그널 탭에서 실시간 신호를 확인하세요
          </div>
        )}

      </div>
    </div>
  )
}

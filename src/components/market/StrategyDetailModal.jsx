import { useEffect, useState, useCallback, useMemo } from 'react'
import { X, FileText, Lock } from 'lucide-react'
import { cn } from '../../lib/cn'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { CTA_CONFIG } from '../../lib/strategyStatus'
import { buildStrategyNarrative } from '../../lib/strategyNarrative'
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

/* ── 소 컴포넌트 ───────────────────── */

function KpiCell({ label, value, positive, negative }) {
  return (
    <div className="flex flex-col items-center justify-center py-2.5 px-1 bg-slate-50/60 dark:bg-gray-800/30">
      <span className="text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-wide mb-1">
        {label}
      </span>
      <span
        className={cn(
          'text-base sm:text-lg font-bold tabular-nums leading-none',
          positive && 'text-emerald-600 dark:text-emerald-400',
          negative && 'text-red-600 dark:text-red-400',
          !positive && !negative && 'text-slate-800 dark:text-slate-200',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function InfoCell({ label, value, positive, negative, sub }) {
  return (
    <div className="border-r last:border-r-0 border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-gray-900/60">
      <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-[3px]">{label}</p>
      <p className={cn(
        'text-[12px] font-bold tabular-nums leading-none',
        positive && 'text-emerald-600 dark:text-emerald-400',
        negative && 'text-red-600',
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

const BADGE_DESC = {
  backtest_only: '과거 데이터만 검증된 상태',
  live_verified: '라이브 검증 진행 중',
  trade_verified: '실거래 검증 완료 전략',
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
    if (count === 0) return null
    return {
      line1: `최근 ${count}개 시그널 중 ${rate.toFixed(0)}% 실제 거래와 일치`,
      line2: Number.isFinite(verReturn)
        ? `실거래 기준 수익률 ${verReturn >= 0 ? '+' : ''}${verReturn.toFixed(1)}%`
        : null,
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

  /* ─── 조건부 반환 ─── */
  if (!isReady) {
    /* 닫힌 상태(strategy=null, rendered=null)에서는 오버레이를 그리지 않음 — 전역 클릭 차단 방지 */
    if (!strategy) return null
    return (
      <div
        role="presentation"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      >
        <div className="w-full max-w-[420px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-300">
          전략 데이터를 불러오는 중입니다
        </div>
      </div>
    )
  }

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

  const riskLevelMarket = (() => {
    try { return mapTrustToRiskLevelMarket(riskStatus) } catch { return '보통' }
  })()

  const positionLabel = (() => {
    const d = safe.recentSignals?.[0]?.dir ?? safe.currentDir ?? null
    if (!d) return '대기'
    const s = String(d).toUpperCase()
    if (s === 'LONG' || s === 'BUY') return 'LONG'
    if (s === 'SHORT' || s === 'SELL') return 'SHORT'
    return '대기'
  })()

  const fmtPctCell = (v) => {
    if (v == null || !Number.isFinite(Number(v))) return '—'
    const n = Number(v)
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
  }

  const priceLine = (() => {
    const p = safe.monthly_price ?? safe.monthlyPriceKrw
    if (p != null && Number.isFinite(Number(p)) && Number(p) > 0) return `₩${Number(p).toLocaleString()}/월`
    if (safe.price != null) return typeof safe.price === 'number' ? `₩${Number(safe.price).toLocaleString()}` : String(safe.price)
    return null
  })()

  /* CTA 상태별 문구 */
  const ctaMainLabel = (() => {
    const s = safe.ctaStatus
    if (s === 'subscribed') return '현재 구독 중'
    if (s === 'active')     return '지금 구독하고 계속 이용하기'
    if (s === 'expired')    return '구독으로 다시 시작하기'
    return '7일 무료 체험 시작'
  })()

  const ctaSubText = (() => {
    const s = safe.ctaStatus
    if (s === 'subscribed' || s === 'active') return '언제든 구독 취소 가능'
    return '무료 체험 후 자동 결제 없음'
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
        label: '검증 데이터 보기',
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

  /* ─── JSX ─── */
  return (
    <div
      role="presentation"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40',
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
          'w-full max-w-[560px]',
          'rounded-lg',
          'border border-slate-200 dark:border-gray-700',
          'max-h-[86vh] flex flex-col',
          'transition-[opacity,transform] duration-200 ease-out',
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]',
        )}
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ════════════════════════════════════════════
            FIXED TOP — 스크롤 없이 항상 보이는 영역
            ════════════════════════════════════════════ */}
        <div className="flex-shrink-0">

          {/* ── 1. 헤더: 전략명 + 배지 + 닫기 ── */}
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-50 leading-snug">
                {safe.name ?? '—'}
              </h2>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <VerificationBadge level={verLevel} size="xs" />
                {statusBadgeLabel && <Badge variant="default">{statusBadgeLabel}</Badge>}
                {runLocked && (
                  <Badge variant="warning">
                    <Lock size={9} className="mr-0.5 inline-block" strokeWidth={2} aria-hidden />
                    구독 혜택
                  </Badge>
                )}
              </div>
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

          {/* ── 2. 핵심 KPI 4개 (2x2 모바일, 4열 데스크톱) ── */}
          {!isMethod && (
            <div className="px-4 pb-2">
              <div className="mb-3">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {trustGrade.grade}등급 전략
                </div>
                <div className="text-xs text-slate-500">
                  신뢰도 {trustScore}점
                </div>
              </div>
              {engineValidation.loading && (
                <p className="text-[9px] text-slate-400 mb-1">엔진 계산 중…</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
                <KpiCell
                  label="수익률"
                  value={Number.isFinite(ret) ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : '—'}
                  positive={Number.isFinite(ret) && ret >= 0}
                  negative={Number.isFinite(ret) && ret < 0}
                />
                <KpiCell
                  label="MDD"
                  value={Number.isFinite(mdd) ? `-${mdd.toFixed(1)}%` : '—'}
                  negative
                />
                <KpiCell
                  label="승률"
                  value={Number.isFinite(win) ? `${win.toFixed(1)}%` : '—'}
                  positive={Number.isFinite(win) && win >= 55}
                />
                <KpiCell
                  label="거래 수"
                  value={Number.isFinite(trades) ? String(trades) : '—'}
                />
              </div>
            </div>
          )}

          {/* ── 3. 검증 요약 (2줄 이내) ── */}
          {verSummaryLine && !isMethod && (
            <div className="px-4 pb-3">
              <div className={cn(
                'rounded-lg px-3 py-2 text-[11px] leading-relaxed',
                verSummaryLine.positive
                  ? 'bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200'
                  : 'bg-slate-50 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
              )}>
                <p className="font-medium">{verSummaryLine.line1}</p>
                {verSummaryLine.line2 && (
                  <p className="mt-0.5">{verSummaryLine.line2} · 현재도 라이브 검증이 진행 중입니다.</p>
                )}
              </div>
            </div>
          )}

          {/* ── 4. CTA (항상 상단 고정) ── */}
          <div className="px-4 pb-4 border-b border-slate-100 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row gap-2">
              {ctaMainAction && (
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
              )}
              {ctaSecondaryAction && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={ctaSecondaryAction.onClick}
                >
                  {ctaSecondaryAction.label}
                </Button>
              )}
            </div>

            {/* 8. CTA 보조 문구 */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-center">
              {ctaSubText}
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            SCROLLABLE BODY
            ════════════════════════════════════════════ */}
        <div className="overflow-y-auto flex-1 min-h-0 px-4 py-3 space-y-3">

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

          {/* 면책 */}
          {!isUser && (
            <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-relaxed border-t border-slate-100 dark:border-gray-800 pt-2">
              본 정보는 투자 자문이 아닙니다. 손익 책임은 이용자에게 있습니다.
            </p>
          )}
        </div>

      </div>
    </div>
  )
}

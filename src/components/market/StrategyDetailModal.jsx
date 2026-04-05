import { useEffect, useState, useCallback } from 'react'
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
import {
  UPSELL_COPY,
  hasPaidPlanFeatures,
  resolveSimIdForUnlock,
  getStrategyAccessUpsellMessage,
  PLAN_MESSAGES,
} from '../../lib/userPlan'

/* ── 내부 소 컴포넌트 ───────────────────── */

function MetricBox({ label, value, positive, negative }) {
  return (
    <div className="flex flex-col items-center py-1.5 px-1 bg-slate-50/60 dark:bg-gray-800/30 border-r last:border-r-0 border-slate-100 dark:border-gray-800">
      <span className="text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-wide mb-[3px]">
        {label}
      </span>
      <span
        className={cn(
          'text-[13px] font-bold tabular-nums leading-none',
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

function ctaCaption(ctaStatus) {
  if (ctaStatus === 'subscribed') return '현재 구독 중인 전략입니다.'
  if (ctaStatus === 'active')     return '체험 기간 중 · 만료 후 구독으로 이어집니다.'
  if (ctaStatus === 'expired')    return '체험이 종료됐습니다. 구독으로 계속 이용하세요.'
  return '7일 무료 체험 후 구독 전환이 가능합니다.'
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
  /* ─── 모든 훅은 무조건 최상단에서 선언 ─── */
  const [rendered, setRendered] = useState(null)
  const [open, setOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fullUrl, setFullUrl] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [strategyPreviewUrl, setStrategyPreviewUrl] = useState(null)
  const [strategyFullUrl, setStrategyFullUrl] = useState(null)
  const [copyClipboardErr, setCopyClipboardErr] = useState('')
  const [engineValidation, setEngineValidation] = useState({
    loading: false, error: '', performance: null, trades: null, backtestMeta: null,
  })

  const requestClose = useCallback(() => { onClose?.() }, [onClose])

  /* ESC 닫기 */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') requestClose() }
    if (rendered) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [rendered, requestClose])

  /* 클립보드 에러 초기화 */
  useEffect(() => {
    setCopyClipboardErr('')
  }, [strategy])

  /* 전략 오픈/클로즈 */
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

  /* 엔진 검증 */
  useEffect(() => {
    if (!rendered || typeof rendered !== 'object') return undefined
    let cancelled = false
    async function run() {
      const isMethodLocal = String(rendered.type ?? 'signal') === 'method'
      if (isMethodLocal) {
        setEngineValidation({ loading: false, error: '', performance: null, trades: null, backtestMeta: null })
        return
      }
      try {
        setEngineValidation({ loading: true, error: '', performance: null, trades: null, backtestMeta: null })
        const check = await runMarketSubmissionCheck(normalizeStrategyPayload(rendered))
        if (cancelled) return
        setEngineValidation({
          loading: false,
          error: '',
          performance: check.performance ?? null,
          trades: Array.isArray(check.trades) ? check.trades : [],
          backtestMeta: check.backtestMeta ?? null,
        })
      } catch (e) {
        if (cancelled) return
        setEngineValidation({
          loading: false,
          error: String(e?.message ?? '엔진 검증 결과를 불러오지 못했습니다.'),
          performance: null, trades: null, backtestMeta: null,
        })
      }
    }
    run()
    return () => { cancelled = true }
  }, [
    rendered?.id, rendered?.code, rendered?.conditions, rendered?.risk_config,
    rendered?.asset, rendered?.timeframe, rendered?.entryConditions,
    rendered?.exitConditions, rendered?.entryExitSplit,
  ])

  /* method PDF 로드 */
  useEffect(() => {
    if (!rendered || typeof rendered !== 'object') return undefined
    let cancelled = false
    const isMethodLocal = String(rendered.type ?? 'signal') === 'method'
    async function loadPdfUrls() {
      setPdfError('')
      setPreviewUrl(null)
      setFullUrl(null)
      setStrategyPreviewUrl(null)
      setStrategyFullUrl(null)
      if (!isMethodLocal) return
      try {
        const prevPath = rendered.method_pdf_preview_path
        const fullPath = rendered.method_pdf_path
        if (prevPath) {
          const u = await getMethodPdfSignedUrl(prevPath, { expiresIn: 60 * 10 })
          if (!cancelled) setPreviewUrl(u)
        }
        if (fullPath) {
          const u2 = await getMethodPdfSignedUrl(fullPath, { expiresIn: 60 * 10 })
          if (!cancelled) setFullUrl(u2)
        }
      } catch (e) {
        if (!cancelled) setPdfError(e?.message ?? 'PDF 로드 실패')
      }
    }
    loadPdfUrls()
    return () => { cancelled = true }
  }, [rendered?.type, rendered?.method_pdf_preview_path, rendered?.method_pdf_path])

  /* strategy PDF 로드 */
  useEffect(() => {
    if (!rendered || typeof rendered !== 'object') return undefined
    let cancelled = false
    const isMethodLocal = String(rendered.type ?? 'signal') === 'method'
    async function loadStrategyPdfUrls() {
      if (isMethodLocal) return
      try {
        const prevPath = rendered.strategy_pdf_preview_path
        const fullPath = rendered.strategy_pdf_path
        if (prevPath) {
          const u = await getStrategyPdfSignedUrl(prevPath, { expiresIn: 60 * 10 })
          if (!cancelled) setStrategyPreviewUrl(u)
        }
        if (fullPath) {
          const u2 = await getStrategyPdfSignedUrl(fullPath, { expiresIn: 60 * 10 })
          if (!cancelled) setStrategyFullUrl(u2)
        }
      } catch (e) {
        if (!cancelled) setPdfError(e?.message ?? 'PDF 로드 실패')
      }
    }
    loadStrategyPdfUrls()
    return () => { cancelled = true }
  }, [rendered?.type, rendered?.strategy_pdf_preview_path, rendered?.strategy_pdf_path])

  /* ─── 모든 훅 선언 완료 후 조건부 반환 ─── */
  if (!rendered || typeof rendered !== 'object') return null

  /* ── safe: 완전 null-safe 래퍼 ── */
  const safe = rendered ?? {}

  const isUser        = !!safe.isUserStrategy
  const showTrialCta  = !user || !hasPaidPlanFeatures(user)
  const simIdForTrial = trialStrategyId || resolveSimIdForUnlock(safe)
  const isMethod      = String(safe.type ?? 'signal') === 'method'
  const codeForCopy   = String(safe.code ?? '').trim()
  const canCopyToEditor = !runLocked && !isMethod && codeForCopy.length > 0 && typeof onCopyToEditor === 'function'
  const cta           = CTA_CONFIG[safe.ctaStatus] ?? CTA_CONFIG.not_started ?? { label: '—', variant: 'secondary' }

  /* backtest meta — 엔진 결과 우선, 없으면 DB raw */
  const bt = (() => {
    const evMeta = engineValidation.backtestMeta
    if (evMeta && typeof evMeta === 'object') return evMeta
    const rawMeta = safe.backtest_meta
    if (rawMeta && typeof rawMeta === 'object') return rawMeta
    return {}
  })()

  /* 신뢰 경고 / 리스크 / 서술 — 예외 차단 */
  const trustWarnings = (() => {
    try {
      const w = buildTrustWarnings({ performance: safe.performance ?? safe, backtestMeta: bt })
      return Array.isArray(w) ? w : []
    } catch { return [] }
  })()

  const riskStatus = (() => {
    try { return computeStrategyStatus({ performance: safe.performance ?? safe, backtestMeta: bt }) } catch { return null }
  })()

  const narrative = (() => {
    try {
      const n = buildStrategyNarrative(safe)
      return typeof n === 'string' ? n : ''
    } catch { return '' }
  })()

  /* 성과 수치 — 엔진 우선, 없으면 DB 필드, 없으면 0 */
  const ep          = engineValidation.performance && typeof engineValidation.performance === 'object' ? engineValidation.performance : null
  const fallbackPerf = safe.performance && typeof safe.performance === 'object' ? safe.performance : null
  const perf        = ep ?? fallbackPerf ?? {}

  const safeN = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb }

  const ret    = safeN(perf.roi    ?? safe.totalReturnPct ?? safe.roi)
  const mdd    = safeN(perf.mdd    ?? safe.maxDrawdown    ?? (safe.mdd != null ? Math.abs(safe.mdd) : undefined))
  const win    = safeN(perf.winRate ?? safe.winRate)
  const trades = safeN(perf.totalTrades ?? safe.tradeCount ?? safe.trades)

  /* 검증 기간 문자열 */
  const validationLine = (() => {
    try {
      const a = fmtYMD(bt.startTime)
      const b = fmtYMD(bt.endTime)
      const tf = bt.timeframe
      if (!a || !b || !tf) return null
      return `${a} ~ ${b} / ${tf}봉`
    } catch { return null }
  })()

  /* 최근 7일 / 30일 — computeRecentRoiPct (ValidationPage·MarketPage 동일 기준) */
  const engTrades = Array.isArray(engineValidation.trades) ? engineValidation.trades : []
  const recent7d  = (() => { try { return computeRecentRoiPct(engTrades, bt, 7) } catch { return null } })()
  const recent30d = (() => { try { return computeRecentRoiPct(engTrades, bt, 30) } catch { return null } })()

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

  const oneLineDesc = String(
    safe.fitSummary || safe.strategy_summary || safe.description || safe.desc || narrative || '',
  ).trim()

  const priceLine = (() => {
    const p = safe.monthly_price ?? safe.monthlyPriceKrw
    if (p != null && Number.isFinite(Number(p)) && Number(p) > 0) {
      return `₩${Number(p).toLocaleString()}/월`
    }
    if (safe.price != null) {
      return typeof safe.price === 'number' ? `₩${Number(safe.price).toLocaleString()}` : String(safe.price)
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

        {/* ── 상단: 이름 · 한 줄 설명 · 가격 ── */}
        <div className="detail-header flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-gray-800 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {isUser && <Badge variant="info">내 전략</Badge>}
              {safe.isOperator && <Badge variant="success">운영자</Badge>}
              {safe.isDbStrategy && !safe.isOperator && <Badge variant="info">판매자</Badge>}
              <Badge variant="default">{safe.typeLabel ?? '—'}</Badge>
              {runLocked && (
                <Badge variant="warning">
                  <Lock size={9} className="mr-0.5 inline-block" strokeWidth={2} aria-hidden />
                  구독 혜택
                </Badge>
              )}
            </div>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-50 leading-snug">
              {safe.name ?? '—'}
            </h2>
            {oneLineDesc && (
              <p className="mt-1.5 text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {oneLineDesc}
              </p>
            )}
            {priceLine && (
              <p className="mt-2 text-[18px] font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {priceLine}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              {safe.author ? `by ${safe.author}` : ''}
              {safe.isDbStrategy && !isUser && <span className="text-slate-500"> · 참고용 검증 데이터</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="
              w-8 h-8 flex items-center justify-center flex-shrink-0
              text-slate-400 hover:text-slate-700 hover:bg-slate-100
              dark:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-gray-800
              rounded-md transition-[color,background-color] duration-[120ms]
            "
            aria-label="닫기"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* ── 바디: 구매 판단용 요약 (상세 해부는 검증 페이지) ── */}
        <div className="relative flex-1 min-h-0 flex flex-col">
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">

          {!isMethod && (
            <>
              <SectionErrorBoundary>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <SLabel>핵심 지표</SLabel>
                    <div className="flex items-center gap-2">
                      {engineValidation.loading && (
                        <span className="text-[9px] text-slate-400">계산 중…</span>
                      )}
                      {engineValidation.error && (
                        <span className="text-[9px] text-amber-600 max-w-[200px] truncate">{String(engineValidation.error).slice(0, 64)}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-2">구독 여부와 관계없이 동일 기준으로 표시됩니다.</p>
                  <div className="kpi-grid grid grid-cols-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <MetricBox
                      label="누적 수익률"
                      value={Number.isFinite(ret) ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : '—'}
                      positive={Number.isFinite(ret) && ret >= 0}
                      negative={Number.isFinite(ret) && ret < 0}
                    />
                    <MetricBox
                      label="MDD"
                      value={Number.isFinite(mdd) ? `−${mdd.toFixed(1)}%` : '—'}
                      negative
                    />
                    <MetricBox
                      label="승률"
                      value={Number.isFinite(win) ? `${win.toFixed(1)}%` : '—'}
                      positive={Number.isFinite(win) && win >= 55}
                    />
                    <MetricBox
                      label="거래 수"
                      value={Number.isFinite(trades) ? String(trades) : '—'}
                    />
                  </div>
                </div>
              </SectionErrorBoundary>

              <SectionErrorBoundary>
                <div>
                  <SLabel>추가 판단 정보</SLabel>
                  <div className="sub-grid grid grid-cols-2 sm:grid-cols-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mt-1.5">
                    <InfoCell
                      label="최근 7일"
                      value={fmtPctCell(recent7d)}
                      positive={recent7d != null && Number(recent7d) >= 0}
                      negative={recent7d != null && Number(recent7d) < 0}
                      sub="엔진 거래 기준"
                    />
                    <InfoCell
                      label="최근 30일"
                      value={fmtPctCell(recent30d)}
                      positive={recent30d != null && Number(recent30d) >= 0}
                      negative={recent30d != null && Number(recent30d) < 0}
                      sub="엔진 거래 기준"
                    />
                    <div className="border-r last:border-r-0 border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-gray-900/60">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">현재 상태</p>
                      <Badge variant={dirVariant(positionLabel === '대기' ? null : positionLabel)} className="text-[11px]">
                        {positionLabel}
                      </Badge>
                    </div>
                    <div className="border-r border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-gray-900/60 sm:col-span-1">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">리스크 레벨</p>
                      <Badge variant={riskMarketVariant(riskLevelMarket)}>{riskLevelMarket}</Badge>
                    </div>
                    <InfoCell
                      label="검증 기간"
                      value={validationLine ?? '—'}
                      sub={bt.candleCount != null ? `${bt.candleCount}봉` : undefined}
                    />
                  </div>
                </div>
              </SectionErrorBoundary>

              <SectionErrorBoundary>
                {Array.isArray(trustWarnings) && trustWarnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2.5">
                    <SLabel>판단 전 확인</SLabel>
                    <ul className="list-disc list-inside text-[11px] text-amber-800 dark:text-amber-200 space-y-1 mt-1">
                      {trustWarnings.map((w, i) => <li key={i}>{typeof w === 'string' ? w : String(w)}</li>)}
                    </ul>
                  </div>
                )}
              </SectionErrorBoundary>

              <SectionErrorBoundary>
                <div className="detail-description rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5 space-y-3">
                  <SLabel>설명</SLabel>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">전략 개요</p>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      {String(safe.strategy_summary ?? '').trim() || '등록된 요약이 없습니다.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">어떤 시장에서 쓰는지</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {String(safe.market_condition ?? '').trim() || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">어떤 리스크가 있는지</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {String(safe.risk_description ?? '').trim() || '—'}
                    </p>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-snug pt-1 border-t border-slate-100 dark:border-gray-800">
                    진·청산 로직 전문, 거래별 근거, PDF 전문, 실시간 시그널 스트림은 구독 후 검증·알림 화면에서 확인할 수 있습니다.
                  </p>
                </div>
              </SectionErrorBoundary>
            </>
          )}

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

          {!isUser && (
            <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-relaxed border-t border-slate-100 dark:border-gray-800 pt-2">
              본 정보는 투자 자문이 아닙니다. 손익 책임은 이용자에게 있습니다.
            </p>
          )}
        </div>
        </div>

        {/* ── 하단 CTA ───────────────── */}
        <div className="
          detail-actions flex flex-col gap-2.5
          px-4 py-2.5
          border-t border-slate-100 dark:border-gray-800
          bg-slate-50/40 dark:bg-gray-800/20
          flex-shrink-0
        ">
          {copyClipboardErr && (
            <p className="text-[10px] text-red-500 dark:text-red-400 leading-snug">{copyClipboardErr}</p>
          )}
          {runLocked ? (
            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug min-w-0">
              위 요약으로 구매 여부를 가늠하고, 검증 페이지에서 전략을 해부할 수 있습니다.
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 dark:text-slate-600 leading-snug min-w-0">
              {ctaCaption(safe.ctaStatus)}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 flex-shrink-0">
            {canCopyToEditor && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="sm:mr-auto"
                onClick={() => { void handleCopyToEditor() }}
              >
                에디터로 개선
              </Button>
            )}
            {!isMethod && typeof onGoValidation === 'function' && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => { requestClose(); onGoValidation() }}
              >
                검증 보기
              </Button>
            )}
            {runLocked ? (
              <>
                {typeof onSubscribe === 'function' && (
                  <Button type="button" variant="primary" size="md" onClick={() => onSubscribe()}>
                    구독하기
                  </Button>
                )}
                {showTrialCta && typeof onStartTrial === 'function' && simIdForTrial && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => { onStartTrial(simIdForTrial); requestClose() }}
                  >
                    {UPSELL_COPY.ctaTrial}
                  </Button>
                )}
                {!onSubscribe && !onStartTrial && (
                  <p className="text-[10px] text-slate-500">로그인 후 구독·체험을 이용할 수 있습니다.</p>
                )}
              </>
            ) : (
              <>
                {onSimulate && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => { requestClose(); onSimulate() }}
                  >
                    {isMethod ? '연결 전략 실행' : '시그널 보기'}
                  </Button>
                )}
                <span
                  role="status"
                  className={cn(
                    'inline-flex items-center min-h-[36px] px-3 rounded-md text-[13px] font-semibold border select-none',
                    cta.variant === 'primary' && 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-200',
                    cta.variant === 'secondary' && 'border-slate-200 bg-white text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-200',
                    (cta.variant === 'ghost' || !cta.variant) && 'border-transparent bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-slate-400',
                  )}
                >
                  {cta.label}
                </span>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

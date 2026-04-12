import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { Activity, RotateCcw, ExternalLink, BarChart2, Lock } from 'lucide-react'
import PageShell    from '../components/ui/PageShell'
import PageHeader   from '../components/ui/PageHeader'
import Card         from '../components/ui/Card'
import Badge, { dirVariant, dirTextClass, pnlClass } from '../components/ui/Badge'
import Button       from '../components/ui/Button'
import EmptyState   from '../components/ui/EmptyState'
import SectionErrorBoundary from '../components/ui/SectionErrorBoundary'
import MockChart         from '../components/simulation/MockChart'
import CandlestickChart from '../components/simulation/CandlestickChart'
import StrategyMarkerLegend from '../components/charts/StrategyMarkerLegend'
import SignalList from '../components/simulation/SignalList'
import { ChartSkeleton } from '../components/ui/Skeleton'
import { cn }       from '../lib/cn'
import { panelBase, panelSoft, panelDanger, panelWarning } from '../lib/panelStyles'

const LS_SIGNAL_CHART_BY_STRATEGY = 'bb_signal_chart_by_strategy_v1'
import {
  STRATEGIES,
  CHART_DATA,
  STATUS_CONFIG,
} from '../data/simulationMockData'
import {
  isSimLocked, FREE_SIM_ID,
  PLAN_MESSAGES,
  navigateToSubscriptionSection,
  UPSELL_COPY,
  getEffectiveProductTier,
  PLAN_TIER,
} from '../lib/userPlan'
import { FREE_VS_PAID } from '../lib/conversionUx'
import { seededRng, strToSeed } from '../lib/seedRandom'
import { isUserStrategyId, getUserStrategyById, ASSET_TO_SIM_ID } from '../lib/userStrategies'
import {
  normalizePrices,
  calculateTradeHistory,
  calculatePerformance,
  calculateOpenPosition,
  buildEngineConfigFromUserStrategy,
  buildCatalogStrategyEngineConfig,
  normalizeEngineRisk,
} from '../lib/strategyEngine'
import { runStrategy } from '../lib/runStrategy'
import { computeRecentRoiPct } from '../lib/marketStrategy'
import { getCachedPrice } from '../lib/priceCache'
import { useMarketData } from '../hooks/useMarketData'
import {
  useBrowserSignalNotificationPermission,
  useBrowserSignalNotifications,
} from '../hooks/useBrowserSignalNotifications'
import { useInAppNotificationsOptional } from '../context/InAppNotificationContext'
import StrategyNotifyToggles from '../components/signal/StrategyNotifyToggles'
import ChartSymbolCombobox from '../components/signal/ChartSymbolCombobox'
import { shouldNotifySignal } from '../lib/signalNotifyEligibility'
import { isSignalNotifyKeyRecorded } from '../lib/signalNotificationDedupe'
import { normalizeBinanceSymbol } from '../lib/marketCandles'
import {
  getAssetClassFromStrategy,
  getDefaultChartSymbolForAssetClass,
  getValidationBaselineLabel,
  resolveAltValidationPairs,
  SIGNAL_CHART_HINT,
} from '../lib/assetValidationUniverse'
import { safeArray } from '../lib/safeValues'
import { fetchBinanceUsdtSpotPairMetaCached } from '../lib/binanceUsdUniverse'
import { useFavoriteSymbols } from '../hooks/useFavoriteSymbols'
import {
  createNotification,
  NOTIFICATION_TYPES,
  formatSignalEntry,
  formatSignalExit,
} from '../lib/notificationService'
import { isSupabaseConfigured } from '../lib/supabase'
import { formatUsd, formatUsdKrwCombined } from '../lib/priceFormat'
import { buildRetentionRiskAlerts } from '../lib/retentionAlerts'
import { getStrategyChartColor } from '../lib/strategyChartPalette'
import { dedupeSignalsForStrategy, normalizeSignalTimeKey } from '../lib/signalDedupe'
import { appendViewedSignal } from '../lib/viewedSignals'
import { getBinanceSpotTradeUrl } from '../lib/binanceTradeLinks'
import { buildSignalTrustMetrics } from '../lib/signalTrustMetrics'
import SignalTrustStrip from '../components/signal/SignalTrustStrip'
import {
  computeSignalTrustScore,
  getSignalTrustGrade,
  getSignalTrustInsight,
  getSignalTrustEvidenceTags,
} from '../lib/signalTrustScore'
import { classifyMarketState, recommendStrategiesByMarket } from '../lib/marketStateEngine'
import { getSignalTrustEventAdjustment, getEventImpactOnStrategy } from '../lib/marketEventEngine'
import { MANUAL_MARKET_EVENTS, pickHighlightMarketEvent } from '../data/marketEvents'

/** 플랜별 동시 관찰 가능 전략 수 (무료 1~2 · 상위 5~10) */
function getWatchLimit(user) {
  const tier = getEffectiveProductTier(user)
  if (tier === PLAN_TIER.PREMIUM) return 10
  if (tier === PLAN_TIER.PRO) return 5
  if (tier === PLAN_TIER.STARTER) return 3
  return 2
}

/** 사이드바 등에 표시할 짧은 플랜 이름 (영문 코드 숨김) */
function planDisplayLabel(user) {
  const tier = getEffectiveProductTier(user)
  if (tier === PLAN_TIER.PREMIUM) return 'Premium'
  if (tier === PLAN_TIER.PRO) return 'Pro'
  if (tier === PLAN_TIER.STARTER) return 'Starter'
  return '무료'
}

function fmtNow() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function fmtLiveTime(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return '—'
  try {
    return new Date(n).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

const TIMEFRAME_TO_KLINES_INTERVAL = {
  '1H': '1h', '2H': '2h', '4H': '4h', '1D': '1d',
}

const CHART_TF_OPTIONS = [
  { value: '1m',  label: '1m'  },
  { value: '3m',  label: '3m'  },
  { value: '5m',  label: '5m'  },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h',  label: '1h'  },
  { value: '4h',  label: '4h'  },
  { value: '1d',  label: '1d'  },
]

const EMPTY_ARRAY = Object.freeze([])

const FALLBACK_STRATEGY = {
  id: 'btc-trend',
  name: '기본 전략',
  symbol: 'BTCUSDT',
  asset: 'BTC',
  timeframe: '1H',
  status: 'not_started',
  runningStatus: 'stopped',
  matchRate: 65,
  winRate: 55,
  totalTrades: 0,
}

function fmtHoldDuration(entryMs) {
  const t = Number(entryMs)
  if (!Number.isFinite(t)) return '—'
  const d = Math.max(0, Date.now() - t)
  const h = Math.floor(d / 3600000)
  const m = Math.floor((d % 3600000) / 60000)
  if (h >= 48) return `${Math.floor(h / 24)}일 ${h % 24}h`
  return `${h}h ${m}m`
}

function fmtEntryTime(t) {
  const n = Number(t)
  if (!Number.isFinite(n)) return '—'
  const ms = n > 1e11 ? n : n * 1000
  try {
    return new Date(ms).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

/** 카드·요약용 짧은 포지션 표기 */
function posLabelKo(type) {
  if (type === 'LONG') return 'LONG'
  if (type === 'SHORT') return 'SHORT'
  return type ?? '대기'
}

function formatSignalPrice(meta, fallbackNum) {
  return formatUsdKrwCombined(meta, fallbackNum)
}

/* ── 진입 근거 파싱 ───────────────────────── */
const KNOWN_RATIONALES = [
  { key: 'rsi',    label: 'RSI 과매도 / 과매수' },
  { key: 'vol',    label: '거래량 폭발'          },
  { key: 'div',    label: '다이버전스 컨펌'       },
  { key: 'ema',    label: 'EMA 크로스'            },
  { key: 'bb',     label: '볼린저 밴드 반전'       },
  { key: 'macd',   label: 'MACD 시그널'           },
  { key: 'sr',     label: 'S/R 레벨 반응'         },
  { key: 'break',  label: '추세 이탈 확인'         },
]

function parseEntryNote(note) {
  if (!note) return []
  return note.split('|').map((n) => n.trim()).filter(Boolean)
}

function formatReasonWithInterpretation(reason) {
  const r = String(reason ?? '').trim()
  if (!r) return r
  if (r.includes('RSI')) return `${r} → 반전 가능성`
  if (r.includes('거래량')) return `${r} → 추세 강화`
  if (r.includes('돌파')) return `${r} → 강한 움직임 예상`
  return r
}

function getUniqueSignals(list = []) {
  const map = new Map()
  list.forEach((signal) => {
    if (!signal) return
    const dir = signal.type === 'ENTRY' ? String(signal.direction ?? '').toUpperCase() : ''
    const id = `${String(signal.strategyId ?? '')}_${normalizeBinanceSymbol(String(signal.symbol ?? ''))}_${normalizeSignalTimeKey(signal.time)}_${String(signal.type ?? '')}_${dir}`
    if (!map.has(id)) {
      map.set(id, { ...signal, signalId: id })
    }
  })
  return Array.from(map.values())
}

function enrichNote(notes) {
  if (!notes.length) return []
  return notes.map((n) => {
    const lower = n.toLowerCase()
    const known = KNOWN_RATIONALES.find((r) =>
      lower.includes(r.key) || n.includes(r.label)
    )
    return { raw: n, label: known?.label ?? n }
  })
}

/* ── 신호 강도 계산 (0~100) ──────────────── */
function calcSignalStrength(notes, strategyConfig) {
  const conds = Array.isArray(strategyConfig?.conditions) ? strategyConfig.conditions.length : 0
  const base = 40 + Math.min(25, notes.length * 8) + Math.min(15, conds * 3)
  return Math.min(100, Math.round(base))
}

/* ── 서브 컴포넌트 ────────────────────────── */

/** 색상 dot */
function ColorDot({ color, size = 8 }) {
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: color }}
    />
  )
}

/** 사이드바 전략 카드 (목록 행) */
const SignalRow = memo(function SignalRow({
  strategy, color, isActive, isLocked,
  openPosType, openPnlPct, recent7d, rationale,
  onClick, onGoValidation, onGoMarket,
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border transition-colors cursor-pointer',
        isActive
          ? 'border-slate-400 dark:border-slate-500 bg-white dark:bg-gray-800/60'
          : 'border-slate-100 dark:border-gray-800 hover:border-slate-200 dark:hover:border-gray-700 bg-white dark:bg-gray-900/40',
      )}
      onClick={onClick}
      style={isActive ? { borderLeftColor: color, borderLeftWidth: 3 } : {}}
    >
      <div className="px-2.5 py-2.5">
        {/* 이름 + 상태 */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <ColorDot color={color} />
          <span className={cn(
            'text-[13px] font-semibold truncate flex-1 leading-tight',
            isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400',
          )}>
            {strategy?.name ?? '전략'}
          </span>
          {isLocked && <Lock size={11} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />}
        </div>

        {/* 현재 상태 + PnL */}
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={dirVariant(openPosType)}>
            {openPosType ? posLabelKo(openPosType) : '대기'}
          </Badge>
          {openPnlPct != null && openPosType && (
            <span className={cn(
              'text-[12px] font-semibold tabular-nums tracking-tight',
              pnlClass(openPnlPct),
            )}>
              {openPnlPct >= 0 ? '+' : ''}{Number(openPnlPct).toFixed(1)}%
            </span>
          )}
        </div>

        {recent7d != null && Number.isFinite(recent7d) && (
          <p className={cn(
            'text-[11px] font-medium tabular-nums mb-1',
            recent7d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
          )}>
            지난 7일 누적 {recent7d >= 0 ? '+' : ''}{recent7d.toFixed(1)}%
          </p>
        )}

        {/* 진입 근거 미리보기 */}
        {rationale.length > 0 && isActive && (
          <div className="space-y-0.5 mb-2">
            {rationale.slice(0, 2).map((r, i) => (
              <p key={i} className="text-[11px] text-slate-500 dark:text-slate-500 truncate leading-snug">
                · {r.label}
              </p>
            ))}
          </div>
        )}

        {/* 링크 버튼 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
          {typeof onGoValidation === 'function' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onGoValidation?.(strategy?.id) }}
              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              검증 보기
            </button>
          )}
          {typeof onGoMarket === 'function' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onGoMarket() }}
              className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
            >
              전략 상세
            </button>
          )}
        </div>
      </div>
    </div>
  )
}, (a, b) => a.strategy?.id === b.strategy?.id
  && a.isActive === b.isActive
  && a.isLocked === b.isLocked
  && a.openPosType === b.openPosType
  && a.openPnlPct === b.openPnlPct
  && a.recent7d === b.recent7d
  && a.color === b.color
  && a.rationale === b.rationale)

/** 진입 근거 패널 */
function EntryRationalePanel({ notes, strength, openPos, slTpDisplay, pnlPrice, locked }) {
  if (!openPos) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200/90 dark:border-gray-700 px-3 py-4 text-center bg-white/50 dark:bg-gray-900/20">
        <p className="text-[12px] text-slate-600 dark:text-slate-300 font-medium">지금은 관망 중이에요</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          포지션이 열리면, 그때 잡은 조건과 목표·손절 거리가 여기 표시됩니다.
        </p>
      </div>
    )
  }
  if (locked) {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-4 text-center">
        <Lock size={14} className="text-slate-300 dark:text-slate-600 mx-auto mb-1" />
        <p className="text-[12px] text-slate-600 dark:text-slate-300 font-medium">근거 전체 보기는 구독 회원만 가능해요</p>
        <p className="text-[11px] text-slate-500 mt-1">포지션 요약과 차트는 그대로 볼 수 있어요.</p>
      </div>
    )
  }

  const ep = safeNum(openPos.entryPrice)
  const curr = safeNum(pnlPrice || ep)
  const dirLong = openPos.type === 'LONG'

  const distToSl = slTpDisplay.sl && curr > 0
    ? +((slTpDisplay.sl - curr) / curr * 100).toFixed(2) : null
  const distToTp = slTpDisplay.tp && curr > 0
    ? +((slTpDisplay.tp - curr) / curr * 100).toFixed(2) : null

  const strengthColor = strength >= 70 ? 'text-emerald-600 dark:text-emerald-400' : strength >= 50 ? 'text-amber-600' : 'text-red-500'
  const strengthBg = strength >= 70 ? 'bg-emerald-500' : strength >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
      {/* 근거 리스트 */}
      <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-3 bg-white/60 dark:bg-gray-900/30">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">들어간 이유</p>
        </div>
        {notes.length === 0 ? (
          <p className="text-[11px] text-slate-500">진입 근거 없음</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {notes.map((n, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-slate-200"
              >
                {n.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2.5">
          <p className="text-[10px] text-slate-500 mb-1">충족도 {Number.isFinite(Number(strength)) ? `${Number(strength)}%` : '—'}</p>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', strengthBg)}
              style={{ width: `${Math.max(0, Math.min(100, Number(strength) || 0))}%` }}
            />
          </div>
          <p className={cn('mt-1 text-[10px] font-semibold tabular-nums', strengthColor)}>
            {Number.isFinite(Number(strength)) ? `${Number(strength)}%` : '—'}
          </p>
        </div>
      </div>

      {/* TP/SL + 보유 상태 */}
      <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-3 space-y-2.5 bg-slate-50/50 dark:bg-gray-950/25">
        <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-0.5">지금 위치</p>
        <div>
          <p className="text-[10px] text-slate-500 mb-0.5">포지션</p>
          <span className={cn('text-[14px] font-bold', dirTextClass(openPos.type))}>
            {openPos.type === 'LONG' ? '롱' : openPos.type === 'SHORT' ? '숏' : openPos.type}
          </span>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-0.5">경과 시간</p>
          <p className="text-[12px] font-medium text-slate-800 dark:text-slate-200 tabular-nums">
            {fmtHoldDuration(openPos.entryTime)}
          </p>
        </div>
        {distToTp != null && (
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">익절까지</p>
            <p className={cn('text-[12px] font-semibold tabular-nums', distToTp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
              {distToTp >= 0 ? '+' : ''}{distToTp.toFixed(2)}%
            </p>
          </div>
        )}
        {distToSl != null && (
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">손절까지</p>
            <p className="text-[12px] font-semibold tabular-nums text-red-600 dark:text-red-400">
              {distToSl >= 0 ? '+' : ''}{distToSl.toFixed(2)}%
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Component ──────────────────────── */
export default function SignalPage({
  initialStrategyId,
  user,
  onStartTrial,
  onSubscribe,
  userStrategies = [],
  currentUser = null,
  onNavigate,
  onGoValidation,
  onStrategyNotifySettingsChange,
}) {
  const u = user ?? { plan: 'free', unlockedStrategyIds: ['btc-trend'] }
  const watchLimit = getWatchLimit(u)
  const SAFE_CATALOG_STRATEGIES = Array.isArray(STRATEGIES) && STRATEGIES.length > 0
    ? STRATEGIES
    : [FALLBACK_STRATEGY]

  const [strategyId, setStrategyId] = useState(() => {
    if (!initialStrategyId) return SAFE_CATALOG_STRATEGIES[0].id
    if (isUserStrategyId(initialStrategyId)) return initialStrategyId
    return SAFE_CATALOG_STRATEGIES.find((s) => s.id === initialStrategyId)
      ? initialStrategyId : SAFE_CATALOG_STRATEGIES[0].id
  })

  const [userStatus, setUserStatus] = useState({})

  useEffect(() => {
    if (!initialStrategyId) return
    if (isUserStrategyId(initialStrategyId)) setStrategyId(initialStrategyId)
    else if (SAFE_CATALOG_STRATEGIES.find((s) => s.id === initialStrategyId)) setStrategyId(initialStrategyId)
  }, [initialStrategyId, SAFE_CATALOG_STRATEGIES])

  const userStrat = isUserStrategyId(strategyId)
    ? ((Array.isArray(userStrategies) ? userStrategies : []).find((s) => s.id === strategyId) ?? getUserStrategyById(strategyId))
    : null
  const mockStrategyId = userStrat
    ? (ASSET_TO_SIM_ID[userStrat.asset] ?? SAFE_CATALOG_STRATEGIES[0].id)
    : strategyId

  const locked = isSimLocked(mockStrategyId, u)

  const strategy = SAFE_CATALOG_STRATEGIES.find((s) => s.id === mockStrategyId) ?? SAFE_CATALOG_STRATEGIES[0]
  useEffect(() => {
    if (!strategyId) {
      setStrategyId(SAFE_CATALOG_STRATEGIES[0].id)
      return
    }
    const inCatalog = SAFE_CATALOG_STRATEGIES.some((s) => s.id === strategyId)
    const inUser = Array.isArray(userStrategies) && userStrategies.some((s) => s?.id === strategyId)
    if (!inCatalog && !inUser) {
      setStrategyId(SAFE_CATALOG_STRATEGIES[0].id)
    }
  }, [strategyId, SAFE_CATALOG_STRATEGIES, userStrategies])

  const signalAssetClass = useMemo(() => {
    if (userStrat) return getAssetClassFromStrategy(userStrat)
    if (mockStrategyId === 'alt-basket') return 'ALT'
    const sym = String(strategy?.symbol ?? 'BTCUSDT').toUpperCase()
    if (sym.startsWith('ETH')) return 'ETH'
    if (sym.startsWith('SOL')) return 'SOL'
    return 'BTC'
  }, [userStrat, mockStrategyId, strategy?.symbol])

  const validationStrategyLike = useMemo(
    () => (userStrat ?? { asset: signalAssetClass }),
    [userStrat, signalAssetClass],
  )

  const validationSymbolList = useMemo(() => {
    const { pairs } = resolveAltValidationPairs(validationStrategyLike)
    return safeArray(pairs)
  }, [validationStrategyLike])

  const validationBaselineLabel = useMemo(
    () => getValidationBaselineLabel(validationStrategyLike),
    [validationStrategyLike],
  )

  const defaultChartSymbolValue = useMemo(
    () => getDefaultChartSymbolForAssetClass(signalAssetClass, userStrat ?? null),
    [signalAssetClass, userStrat],
  )

  const [chartSymbolDraft, setChartSymbolDraft] = useState('')
  const [binancePairMeta, setBinancePairMeta] = useState([])
  const { favoriteSet, toggleFavorite } = useFavoriteSymbols()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await fetchBinanceUsdtSpotPairMetaCached()
        if (!cancelled && Array.isArray(m)) setBinancePairMeta(m)
      } catch {
        if (!cancelled) setBinancePairMeta([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const chartSymbolOptions = useMemo(
    () => (Array.isArray(binancePairMeta) ? binancePairMeta : []),
    [binancePairMeta],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SIGNAL_CHART_BY_STRATEGY)
      const m = raw ? JSON.parse(raw) : {}
      const saved = m[strategyId]
      setChartSymbolDraft(saved != null ? String(saved) : String(defaultChartSymbolValue))
    } catch {
      setChartSymbolDraft(String(defaultChartSymbolValue))
    }
  }, [strategyId, defaultChartSymbolValue])

  const klinesSymbol = useMemo(() => {
    const d = String(chartSymbolDraft ?? '').trim()
    if (!d) return normalizeBinanceSymbol(defaultChartSymbolValue)
    return normalizeBinanceSymbol(d)
  }, [chartSymbolDraft, defaultChartSymbolValue])

  const assetSymbol = useMemo(() => {
    return klinesSymbol.replace(/USDT$/i, '') || 'BTC'
  }, [klinesSymbol])

  const commitChartSymbol = useCallback((rawSymbol) => {
    const next = normalizeBinanceSymbol(rawSymbol || defaultChartSymbolValue)
    setChartSymbolDraft(next)
    try {
      const raw = localStorage.getItem(LS_SIGNAL_CHART_BY_STRATEGY)
      const m = raw ? JSON.parse(raw) : {}
      m[strategyId] = next
      localStorage.setItem(LS_SIGNAL_CHART_BY_STRATEGY, JSON.stringify(m))
    } catch { /* ignore */ }
  }, [defaultChartSymbolValue, strategyId])

  const applyChartSymbol = useCallback(() => {
    commitChartSymbol(chartSymbolDraft)
  }, [chartSymbolDraft, commitChartSymbol])

  const [chartTf, setChartTf] = useState('15m')
  useEffect(() => {
    const tf = strategy?.timeframe
    const mapped = tf ? (TIMEFRAME_TO_KLINES_INTERVAL[tf] ?? '1h') : '1h'
    setChartTf(mapped)
  }, [mockStrategyId, strategy?.timeframe])

  const klinesInterval = chartTf
  const chart = CHART_DATA[mockStrategyId]
  const binancePair = useMemo(() => normalizeBinanceSymbol(klinesSymbol), [klinesSymbol])
  const binanceTradeUrl = useMemo(() => getBinanceSpotTradeUrl(binancePair), [binancePair])
  const {
    candles: chartCandles,
    loading: chartLoading,
    error: chartError,
    source: chartDataSource,
    refetch: refetchChart,
  } = useMarketData(binancePair, klinesInterval, { limit: 500, pollMs: 2500 })
  const safeChartCandles = Array.isArray(chartCandles) ? chartCandles : []

  const stableCandlesRef = useRef([])
  const candleFingerprintRef = useRef('')
  const effectiveCandles = useMemo(() => {
    const src = safeChartCandles.length > 0 ? safeChartCandles : stableCandlesRef.current
    if (src.length === 0) return stableCandlesRef.current

    const last = src[src.length - 1]
    const fp = `${src.length}_${last?.time}_${last?.close}`
    if (fp === candleFingerprintRef.current) return stableCandlesRef.current

    candleFingerprintRef.current = fp
    stableCandlesRef.current = src
    return src
  }, [safeChartCandles])

  const effectivePrices = useMemo(() => {
    if (effectiveCandles.length > 0) return effectiveCandles.map((c) => ({ time: c.time, price: c.close }))
    return chart?.prices ?? []
  }, [effectiveCandles, chart?.prices])

  const enginePrices = useMemo(() => normalizePrices(effectivePrices), [effectivePrices])

  const strategyConfig = useMemo(() => {
    if (userStrat) return buildEngineConfigFromUserStrategy(userStrat, { candles: effectiveCandles })
    return buildCatalogStrategyEngineConfig(
      { id: mockStrategyId, symbol: binancePair, timeframe: strategy?.timeframe },
      { candles: effectiveCandles },
    )
  }, [userStrat, effectiveCandles, mockStrategyId, binancePair, strategy?.timeframe])

  /* ── 단일 엔진 파이프라인 (캔들 → runStrategy → 시그널·거래·성과) ── */
  const engineResult = useMemo(
    () => {
      if (!enginePrices.length || !effectiveCandles.length) {
        return { signals: [], trades: [], performance: { roi: 0, winRate: 0, totalTrades: 0, mdd: 0 } }
      }
      return runStrategy(effectiveCandles, null, { strategyConfig, chartSymbol: binancePair })
    },
    [enginePrices, strategyConfig, effectiveCandles, binancePair],
  )

  const engineSignals = useMemo(() => {
    const src = Array.isArray(engineResult?.signals) ? engineResult.signals : []
    const filtered = src.filter((s) => {
      const signalSymbol = normalizeBinanceSymbol(String(s?.symbol ?? binancePair))
      return signalSymbol === binancePair
    })
    const deduped = dedupeSignalsForStrategy(strategyId, filtered, binancePair)
    return deduped.map((signal) => {
      const symbol = normalizeBinanceSymbol(String(signal.symbol ?? binancePair))
      const type = String(signal.type ?? '')
      const time = normalizeSignalTimeKey(signal.time)
      return {
        ...signal,
        strategyId,
        symbol,
        reasons: Array.isArray(signal.reasons) ? signal.reasons : parseEntryNote(signal.note ?? ''),
        signalId: `${strategyId}_${symbol}_${time}_${type}`,
      }
    })
  }, [engineResult?.signals, strategyId, binancePair])

  const visibleSignals = useMemo(
    () => getUniqueSignals(engineSignals),
    [engineSignals],
  )
  const currentSignal = useMemo(() => {
    if (!visibleSignals.length) return null
    const entries = visibleSignals.filter((s) => s?.type === 'ENTRY')
    return entries.length > 0 ? entries[entries.length - 1] : visibleSignals[visibleSignals.length - 1]
  }, [visibleSignals])
  const latestClosedSignal = useMemo(() => {
    if (!Array.isArray(visibleSignals) || visibleSignals.length === 0) return null
    const closed = [...visibleSignals]
      .filter((s) => s && (s.type === 'EXIT' || s.closed === true || s.open === false))
      .sort((a, b) => Number(a?.time ?? 0) - Number(b?.time ?? 0))
    return closed.length ? closed[closed.length - 1] : null
  }, [visibleSignals])

  const currentSignalReasons = useMemo(() => {
    if (Array.isArray(currentSignal?.reasons) && currentSignal.reasons.length > 0) {
      return [...new Set(currentSignal.reasons.filter(Boolean).map((x) => String(x).trim()).filter(Boolean))]
    }
    return [...new Set(
      parseEntryNote(currentSignal?.note ?? '')
        .map((x) => String(x).trim())
        .filter(Boolean),
    )]
  }, [currentSignal])
  const currentSignalConfidence = useMemo(() => {
    const n = Number(currentSignal?.confidenceScore)
    return Number.isFinite(n) ? n : null
  }, [currentSignal])
  const trades = Array.isArray(engineResult?.trades) ? engineResult.trades : EMPTY_ARRAY

  const liveData = useMemo(() => {
    const rng = seededRng(strToSeed(mockStrategyId))
    const r = (amp) => (rng() * 2 - 1) * amp
    const fallbackPrice = strategy?.currentPrice ?? 50000
    const lastPrice = enginePrices.length ? enginePrices[enginePrices.length - 1].price : fallbackPrice
    return {
      basePrice: Math.round(lastPrice * (1 + r(0.0012))),
      priceChangePct: +((strategy?.priceChangePct ?? 0) + r(0.07)).toFixed(2),
    }
  }, [mockStrategyId, enginePrices, strategy?.currentPrice, strategy?.priceChangePct])

  const [currentPrice, setCurrentPrice] = useState(() => liveData.basePrice)
  const [marketPrice, setMarketPrice] = useState(null)
  const [marketPriceMeta, setMarketPriceMeta] = useState({
    usdPrice: null, krwPrice: null, krwSource: null, changePercent: null,
  })
  const [fastUpdatedAt, setFastUpdatedAt] = useState(0)
  const [kstTick, setKstTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setKstTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const kstWallClock = useMemo(() => {
    try {
      return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).replace('T', ' ')
    } catch {
      return '—'
    }
  }, [kstTick])

  const displayPrice = marketPrice ?? currentPrice ?? liveData.basePrice
  const pnlPrice = marketPriceMeta.usdPrice ?? currentPrice ?? liveData.basePrice

  const entryIdxs = useMemo(() => {
    const arr = visibleSignals
      .filter((s) => s.type === 'ENTRY')
      .map((s) => enginePrices.findIndex((p) => p.time === s.time))
      .filter((i) => i >= 0)
    return [...new Set(arr)]
  }, [visibleSignals, enginePrices])
  const exitIdxs = useMemo(() => {
    const arr = visibleSignals
      .filter((s) => s.type === 'EXIT')
      .map((s) => enginePrices.findIndex((p) => p.time === s.time))
      .filter((i) => i >= 0)
    return [...new Set(arr)]
  }, [visibleSignals, enginePrices])

  useEffect(() => { setCurrentPrice(liveData.basePrice) }, [mockStrategyId]) // eslint-disable-line

  useEffect(() => {
    let cancelled = false
    const POLL_MS = 1000
    async function loadPrice() {
      try {
        const data = await getCachedPrice(assetSymbol)
        if (cancelled) return
        setMarketPrice((prev) => {
          const next = data.krwPrice ?? data.usdPrice ?? null
          return next != null ? next : prev
        })
        setMarketPriceMeta((prev) => ({
          usdPrice: data.usdPrice ?? prev.usdPrice,
          krwPrice: data.krwPrice ?? prev.krwPrice,
          krwSource: data.krwSource ?? prev.krwSource,
          changePercent: data.changePercent ?? prev.changePercent,
        }))
        setFastUpdatedAt(Date.now())
      } catch { /* 조용히 무시 — 이전 값 유지 */ }
    }
    loadPrice()
    const id = setInterval(loadPrice, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [assetSymbol])

  const openPos = useMemo(
    () => calculateOpenPosition(visibleSignals, pnlPrice || (enginePrices.at(-1)?.price ?? 0)),
    [visibleSignals, pnlPrice, enginePrices],
  )
  const openPnlPct = openPos?.pnlPct ?? null

  const riskEngine = useMemo(
    () => normalizeEngineRisk(strategyConfig.risk_config ?? {}),
    [strategyConfig.risk_config],
  )

  const slTpDisplay = useMemo(() => {
    const stopPct = riskEngine.stopPct
    const tpPct = riskEngine.tpPct
    if (!openPos) return { sl: null, tp: null, slPct: stopPct, tpPct }
    const ep = safeNum(openPos.entryPrice)
    let sl = null; let tp = null
    if (ep > 0 && stopPct > 0) sl = openPos.type === 'LONG' ? ep * (1 - stopPct / 100) : ep * (1 + stopPct / 100)
    if (ep > 0 && tpPct > 0)  tp = openPos.type === 'LONG' ? ep * (1 + tpPct / 100) : ep * (1 - tpPct / 100)
    return { sl, tp, slPct: stopPct, tpPct }
  }, [openPos, riskEngine])

  const closedPerf = (engineResult && typeof engineResult.performance === 'object' && engineResult.performance) ? engineResult.performance : {}

  const btMetaForTrust = useMemo(() => {
    if (!effectiveCandles.length) return {}
    return { endTime: effectiveCandles[effectiveCandles.length - 1].time }
  }, [effectiveCandles])

  const signalTrustMetrics = useMemo(
    () => buildSignalTrustMetrics({
      strategy,
      userStrat,
      trades,
      backtestMeta: btMetaForTrust,
      closedPerformance: closedPerf,
    }),
    [strategy, userStrat, trades, btMetaForTrust, closedPerf],
  )

  const marketStateForSignalTrust = useMemo(() => {
    const ch = Number(marketPriceMeta.changePercent ?? liveData.priceChangePct)
    const abs = Math.abs(Number.isFinite(ch) ? ch : 0)
    return classifyMarketState({
      btcChange24h: Number.isFinite(ch) ? ch : 0,
      ethChange24h: Number.isFinite(ch) ? ch : 0,
      avgRangePct: abs,
      dominanceTrend: '',
      volumeTrend: '',
    })
  }, [marketPriceMeta.changePercent, liveData.priceChangePct])

  const strategyMarketFitScore = useMemo(() => {
    const base = { ...(strategy ?? {}), ...(userStrat ?? {}) }
    const row = recommendStrategiesByMarket([base], marketStateForSignalTrust)[0]
    return Number(row?.marketFitScore ?? 50)
  }, [strategy, userStrat, marketStateForSignalTrust])

  const currentSignalAgeMinutes = useMemo(() => {
    if (!currentSignal) return 0
    const t = Number(currentSignal.time ?? currentSignal.ts)
    if (!Number.isFinite(t)) return 0
    return Math.max(0, (Date.now() - t) / 60000)
  }, [currentSignal])

  const signalEventTrustAdjustment = useMemo(
    () => getSignalTrustEventAdjustment(MANUAL_MARKET_EVENTS, marketStateForSignalTrust),
    [marketStateForSignalTrust],
  )

  const signalPageHighlightEvent = useMemo(
    () => pickHighlightMarketEvent(MANUAL_MARKET_EVENTS),
    [],
  )

  const signalPageEventOnStrategy = useMemo(() => {
    if (!signalPageHighlightEvent || !strategy) return null
    return getEventImpactOnStrategy(
      signalPageHighlightEvent,
      { typeLabel: String(strategy.typeLabel ?? '추세형') },
      marketStateForSignalTrust,
    )
  }, [signalPageHighlightEvent, strategy, marketStateForSignalTrust])

  const signalTrustScore = useMemo(
    () => computeSignalTrustScore({
      strategyTrustScore: signalTrustMetrics.trustPct,
      matchRate: Number(
        strategy?.matchRate ?? strategy?.match_rate ?? signalTrustMetrics.matchPct ?? 0,
      ),
      recentWinRate: Number(
        signalTrustMetrics.recentSuccessPct ?? closedPerf.winRate ?? strategy?.winRate ?? 0,
      ),
      marketFitScore: strategyMarketFitScore,
      reasonCount: currentSignalReasons.length,
      volatilityLabel: marketStateForSignalTrust.volatilityLabel,
      signalAgeMinutes: currentSignalAgeMinutes,
      hasRealVerification: !!(strategy?.hasRealVerification ?? strategy?.is_trade_verified),
      eventTrustAdjustment: signalEventTrustAdjustment,
    }),
    [
      signalTrustMetrics.trustPct,
      signalTrustMetrics.matchPct,
      signalTrustMetrics.recentSuccessPct,
      strategy,
      closedPerf.winRate,
      strategyMarketFitScore,
      currentSignalReasons.length,
      marketStateForSignalTrust.volatilityLabel,
      currentSignalAgeMinutes,
      signalEventTrustAdjustment,
    ],
  )

  const signalTrustGrade = useMemo(
    () => getSignalTrustGrade(signalTrustScore),
    [signalTrustScore],
  )

  const signalTrustInsight = useMemo(
    () => getSignalTrustInsight(signalTrustScore),
    [signalTrustScore],
  )

  const signalTrustEvidenceTags = useMemo(
    () => getSignalTrustEvidenceTags({
      matchRate: Number(strategy?.matchRate ?? strategy?.match_rate ?? signalTrustMetrics.matchPct ?? 0),
      recentWinRate: Number(
        signalTrustMetrics.recentSuccessPct ?? closedPerf.winRate ?? strategy?.winRate ?? 0,
      ),
      marketFitScore: strategyMarketFitScore,
      reasonCount: currentSignalReasons.length,
      hasRealVerification: !!(strategy?.hasRealVerification ?? strategy?.is_trade_verified),
    }),
    [
      strategy,
      signalTrustMetrics,
      closedPerf.winRate,
      strategyMarketFitScore,
      currentSignalReasons.length,
    ],
  )

  const signalTrustPanelClass =
    signalTrustGrade.tone === 'positive'
      ? 'rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20'
      : signalTrustGrade.tone === 'warning'
        ? 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20'
        : signalTrustGrade.tone === 'danger'
          ? 'rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20'
          : 'rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70'

  const riskAlerts = useMemo(
    () => buildRetentionRiskAlerts({ mdd: closedPerf.mdd, totalTrades: trades.length, recentTrades: trades }),
    [closedPerf.mdd, trades],
  )

  const effectiveStatus = userStatus[mockStrategyId] ?? strategy?.status ?? 'not_started'
  const statusCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.not_started

  const displayChangePct = marketPriceMeta.changePercent ?? liveData.priceChangePct
  const priceSign = displayChangePct >= 0 ? '+' : ''
  const signalMarketState = displayChangePct > 0.3 ? '상승' : displayChangePct < -0.3 ? '하락' : '횡보'

  // 시그널 알림
  const chartSeriesEpoch = useMemo(() => {
    if (safeChartCandles.length > 0) {
      const a = safeChartCandles[0].time; const b = safeChartCandles[safeChartCandles.length - 1].time
      return `live-${a}-${b}-${safeChartCandles.length}`
    }
    return `mock-${mockStrategyId}`
  }, [safeChartCandles, mockStrategyId])

  const signalNotifyHydrated = useRef(false)
  const signalSeenIds = useRef(new Set())
  useEffect(() => { signalNotifyHydrated.current = false; signalSeenIds.current = new Set() }, [mockStrategyId, klinesSymbol, klinesInterval, chartSeriesEpoch])

  const handleCTA = useCallback(async () => {
    if (effectiveStatus === 'not_started') {
      setUserStatus((prev) => ({ ...prev, [mockStrategyId]: 'active' }))
      if (u.plan === 'free') await onStartTrial?.(mockStrategyId)
    } else if (effectiveStatus === 'active' || effectiveStatus === 'expired') {
      setUserStatus((prev) => ({ ...prev, [mockStrategyId]: 'subscribed' }))
      await onSubscribe?.()
    }
  }, [effectiveStatus, mockStrategyId, u.plan, onStartTrial, onSubscribe])

  const displayName = userStrat?.name ?? strategy?.name ?? '전략'
  const goMarketCb = useMemo(() => (onNavigate ? () => onNavigate('market') : undefined), [onNavigate])

  /* ── 색상 맵 ─────────────────────────────── */
  const allListableStrategies = useMemo(() => {
    const rows = [
      ...(Array.isArray(userStrategies) ? userStrategies : []).map((s) => ({ id: s.id, name: s.name, isUser: true, locked: false })),
      ...SAFE_CATALOG_STRATEGIES.map((s) => ({ id: s.id, name: s.name, isUser: false, locked: isSimLocked(s.id, u) })),
    ]
    const byId = new Map()
    rows.forEach((row) => {
      const id = String(row?.id ?? '')
      if (!id || byId.has(id)) return
      byId.set(id, row)
    })
    return Array.from(byId.values())
  }, [userStrategies, u, SAFE_CATALOG_STRATEGIES])

  const strategyColorMap = useMemo(() => {
    const map = {}
    allListableStrategies.forEach((s, i) => {
      map[s.id] = getStrategyChartColor(s.id, i)
    })
    return map
  }, [allListableStrategies])

  const selectedColor = strategyColorMap[strategyId] ?? getStrategyChartColor(strategyId, 0)

  /** 엔진 결과 (캔들 변경 시에만 재실행 — pnlPrice 비의존) */
  const multiEngineResults = useMemo(() => {
    const out = {}
    if (!enginePrices.length || !effectiveCandles.length) return out
    const userStratMap = new Map((Array.isArray(userStrategies) ? userStrategies : []).map((s) => [s.id, s]))
    const btMeta = effectiveCandles.length ? { endTime: effectiveCandles[effectiveCandles.length - 1].time } : {}
    const list = allListableStrategies.slice(0, watchLimit)

    for (const row of list) {
      const id = row.id
      try {
        const us = userStratMap.get(id)
        const cat = SAFE_CATALOG_STRATEGIES.find((x) => x.id === id)
        const cfg = us
          ? buildEngineConfigFromUserStrategy(us, { candles: effectiveCandles })
          : buildCatalogStrategyEngineConfig(
              { id, symbol: binancePair, timeframe: cat?.timeframe ?? strategy?.timeframe },
              { candles: effectiveCandles },
            )
        const res = runStrategy(effectiveCandles, null, { strategyConfig: cfg, chartSymbol: binancePair })
        const filteredSignals = dedupeSignalsForStrategy(
          id,
          (Array.isArray(res.signals) ? res.signals : []).filter((sig) => {
            const signalSymbol = normalizeBinanceSymbol(String(sig?.symbol ?? binancePair))
            return signalSymbol === binancePair
          }),
          binancePair,
        )
        out[id] = {
          signals: filteredSignals,
          trades: res.trades,
          performance: res.performance,
          recent7d: computeRecentRoiPct(res.trades, btMeta, 7),
        }
      } catch {
        out[id] = null
      }
    }
    return out
  }, [
    enginePrices, effectiveCandles, allListableStrategies, watchLimit, userStrategies,
    binancePair, strategy?.timeframe, SAFE_CATALOG_STRATEGIES,
  ])

  /** openPos만 가격 변경 시 갱신 (엔진 재실행 없이 저렴한 계산) */
  const multiEngineSnapshots = useMemo(() => {
    const ids = Object.keys(multiEngineResults)
    if (ids.length === 0) return multiEngineResults
    const lastPrice = pnlPrice ?? enginePrices[enginePrices.length - 1]?.price ?? 0
    const out = {}
    for (const id of ids) {
      const r = multiEngineResults[id]
      if (!r) { out[id] = null; continue }
      out[id] = {
        ...r,
        openPos: calculateOpenPosition(r.signals, lastPrice),
      }
    }
    return out
  }, [multiEngineResults, pnlPrice, enginePrices])

  const browserNotifyGroups = useMemo(
    () => allListableStrategies.slice(0, watchLimit).map((s) => ({
      id: s.id,
      name: s.name,
      signals: multiEngineResults[s.id]?.signals ?? EMPTY_ARRAY,
    })),
    [allListableStrategies, watchLimit, multiEngineResults],
  )

  const userStrategyIdsList = useMemo(
    () => (Array.isArray(userStrategies) ? userStrategies : []).map((s) => s.id),
    [userStrategies],
  )

  const inAppNotify = useInAppNotificationsOptional()
  const onSignalInApp = useCallback(
    (events) => {
      if (!currentUser?.id || !inAppNotify || !Array.isArray(events)) return
      events.forEach((e) => inAppNotify.addNotification(e))
    },
    [currentUser?.id, inAppNotify],
  )

  const strategyNotifySettings = u?.strategyNotifySettings ?? {}

  useBrowserSignalNotificationPermission()
  useBrowserSignalNotifications({
    groups: browserNotifyGroups,
    enabled: true,
    currentUser,
    user: u,
    userStrategyIds: userStrategyIdsList,
    strategyNotifySettings,
    onNewSignals: onSignalInApp,
  })

  /* Supabase 인앱 저장 — 브라우저 훅 다음 실행, 동일 시그널은 tryConsume 으로 이미 소비됨 */
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser?.id || !engineSignals.length) return
    if (!signalNotifyHydrated.current) {
      engineSignals.forEach((s) => signalSeenIds.current.add(s.id))
      signalNotifyHydrated.current = true
      return
    }
    const label = strategy?.name ?? assetSymbol
    for (const s of engineSignals) {
      if (signalSeenIds.current.has(s.id)) continue
      signalSeenIds.current.add(s.id)
      let kind
      if (s.type === 'ENTRY') {
        kind = String(s.direction ?? '').toUpperCase() === 'SHORT' ? 'short' : 'long'
      } else if (s.type === 'EXIT') {
        kind = 'exit'
      } else {
        continue
      }
      if (
        !shouldNotifySignal({
          currentUser,
          user: u,
          strategyId,
          kind,
          userStrategyIds: userStrategyIdsList,
        })
      ) {
        continue
      }
      if (s.type === 'ENTRY') {
        if (isSignalNotifyKeyRecorded(strategyId, s)) continue
        const { title, message } = formatSignalEntry(label, s.direction, s.price)
        createNotification({ userId: currentUser.id, type: NOTIFICATION_TYPES.ENTRY, title, message, skipDuplicateCheck: false }).catch(() => {})
      } else if (s.type === 'EXIT') {
        if (isSignalNotifyKeyRecorded(strategyId, s)) continue
        const { title, message } = formatSignalExit(label, s.price)
        createNotification({ userId: currentUser.id, type: NOTIFICATION_TYPES.EXIT, title, message, skipDuplicateCheck: false }).catch(() => {})
      }
    }
  }, [engineSignals, currentUser?.id, strategy?.name, assetSymbol, u, strategyId, userStrategyIdsList])

  const strategyOverlays = useMemo(() => {
    if (!enginePrices.length) return EMPTY_ARRAY
    const snap = multiEngineResults[strategyId]
    if (!snap?.signals?.length) return EMPTY_ARRAY
    const s = allListableStrategies.find((x) => x.id === strategyId) ?? { id: strategyId, name: displayName }
    const eIdxs = [...new Set(
      snap.signals
        .filter((x) => x.type === 'ENTRY')
        .map((x) => enginePrices.findIndex((p) => p.time === x.time))
        .filter((i) => i >= 0),
    )]
    const xIdxs = [...new Set(
      snap.signals
        .filter((x) => x.type === 'EXIT')
        .map((x) => enginePrices.findIndex((p) => p.time === x.time))
        .filter((i) => i >= 0),
    )]
    return [{
      id: s.id,
      name: s.name,
      color: selectedColor,
      entryIdxs: eIdxs,
      exitIdxs: xIdxs,
    }]
  }, [multiEngineResults, strategyId, enginePrices, selectedColor, displayName, allListableStrategies])

  /** 차트 마커용: 엔진 시그널 원본 (방향 LONG/SHORT 반영) */
  const strategySignalBundles = useMemo(() => {
    if (!visibleSignals.length) return EMPTY_ARRAY
    return [{
      id: strategyId,
      name: displayName,
      color: selectedColor,
      chartSymbol: binancePair,
      signals: visibleSignals,
    }]
  }, [strategyId, displayName, selectedColor, binancePair, visibleSignals])

  const strategyLegendItems = useMemo(
    () => [{
      strategyKey: strategyId,
      strategyLabel: displayName,
      color: selectedColor,
    }],
    [strategyId, displayName, selectedColor],
  )

  const priceLineOverlays = useMemo(() => {
    const op = openPos
    if (!op?.entryPrice) return EMPTY_ARRAY
    const lines = [{
      price: op.entryPrice,
      color: op.type === 'LONG' ? '#16c784' : '#ea3943',
      title: op.type === 'LONG' ? '현재 진입가 (LONG)' : '현재 진입가 (SHORT)',
      lineWidth: 2,
    }]
    if (Number.isFinite(Number(slTpDisplay?.tp))) {
      lines.push({
        price: Number(slTpDisplay.tp),
        color: '#16c784',
        title: 'TP',
        lineWidth: 1,
      })
    }
    if (Number.isFinite(Number(slTpDisplay?.sl))) {
      lines.push({
        price: Number(slTpDisplay.sl),
        color: '#ea3943',
        title: 'SL',
        lineWidth: 1,
      })
    }
    const seen = new Set()
    return lines.filter((ln) => {
      const k = `${Number(ln.price).toFixed(8)}|${String(ln.title ?? '')}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [openPos, slTpDisplay])

  /* ── 진입 근거 파싱 ──────────────────────── */
  const entryRationale = useMemo(() => {
    if (!Array.isArray(currentSignalReasons) || currentSignalReasons.length === 0) return []
    return currentSignalReasons.map((r) => ({
      raw: r,
      label: formatReasonWithInterpretation(r),
    }))
  }, [currentSignalReasons])

  const signalStrength = useMemo(
    () => (currentSignalConfidence != null ? currentSignalConfidence : calcSignalStrength(entryRationale, strategyConfig)),
    [currentSignalConfidence, entryRationale, strategyConfig],
  )

  /* ── 사이드바 전략 행 요약 (포지션·7일 성과 등) ──────────────── */
  const monitorRows = useMemo(() => {
    const lastPrice = pnlPrice ?? enginePrices[enginePrices.length - 1]?.price ?? 0
    const userStratMap = new Map((Array.isArray(userStrategies) ? userStrategies : []).map((x) => [x.id, x]))
    return allListableStrategies.slice(0, watchLimit).map((s) => {
      const color = strategyColorMap[s.id] ?? '#64748b'
      const snap = multiEngineSnapshots[s.id]
      if (!snap) {
        return {
          ...s,
          color,
          openPosType: null,
          openPnlPct: null,
          entryTime: null,
          recentPnl: null,
          recent7d: null,
          distToTp: null,
          distToSl: null,
          reasons: [],
          statusSummary: '엔진 데이터를 불러오지 못했습니다.',
        }
      }
      const op = snap.openPos
      const lastT = snap.trades?.length ? snap.trades[snap.trades.length - 1] : null
      let openPnl = op?.pnlPct ?? null
      if (op && openPnl == null) {
        const recalc = calculateOpenPosition(snap.signals, lastPrice)
        openPnl = recalc?.pnlPct ?? null
      }

      let distToTp = null
      let distToSl = null
      try {
        const us = userStratMap.get(s.id)
        const cat = SAFE_CATALOG_STRATEGIES.find((x) => x.id === s.id)
        const cfg = us
          ? buildEngineConfigFromUserStrategy(us, { candles: effectiveCandles })
          : buildCatalogStrategyEngineConfig(
              { id: s.id, symbol: binancePair, timeframe: cat?.timeframe ?? strategy?.timeframe },
              { candles: effectiveCandles },
            )
        const risk = normalizeEngineRisk(cfg.risk_config ?? {})
        const stopPct = risk.stopPct
        const tpPct = risk.tpPct
        const ep = safeNum(op?.entryPrice)
        const curr = safeNum(lastPrice)
        let sl = null
        let tp = null
        if (op && ep > 0 && stopPct > 0) {
          sl = op.type === 'LONG' ? ep * (1 - stopPct / 100) : ep * (1 + stopPct / 100)
        }
        if (op && ep > 0 && tpPct > 0) {
          tp = op.type === 'LONG' ? ep * (1 + tpPct / 100) : ep * (1 - tpPct / 100)
        }
        if (sl != null && curr > 0) distToSl = +(((sl - curr) / curr) * 100).toFixed(2)
        if (tp != null && curr > 0) distToTp = +(((tp - curr) / curr) * 100).toFixed(2)
      } catch {
        /* 거리 계산 생략 */
      }

      const sourceSignals = s.id === strategyId ? visibleSignals : (snap.signals ?? [])
      const entries = sourceSignals.filter((x) => x.type === 'ENTRY')
      const lastEntry = entries[entries.length - 1]
      let reasons = []
      if (lastEntry) {
        if (Array.isArray(lastEntry.reasons) && lastEntry.reasons.length) {
          reasons = lastEntry.reasons
        } else {
          reasons = enrichNote(parseEntryNote(lastEntry.note ?? '')).map((n) => n.label)
        }
      }
      reasons = [...new Set((Array.isArray(reasons) ? reasons : []).filter(Boolean))]

      let statusSummary = '대기 · 새 시그널 대기'
      if (op?.type) {
        if (openPnl != null) {
          statusSummary =
            openPnl >= 0
              ? `평가 이익 ${openPnl >= 0 ? '+' : ''}${openPnl.toFixed(1)}% · 목표·손절 거리는 아래 참고`
              : `평가 손실 ${openPnl.toFixed(1)}% · 변동성에 유의하세요`
        } else {
          statusSummary = `${op.type === 'LONG' ? 'LONG' : 'SHORT'} 포지션 유지 중`
        }
      } else if (lastT?.pnl != null) {
        statusSummary = `직전 청산 ${lastT.pnl >= 0 ? '+' : ''}${lastT.pnl.toFixed(1)}%`
      }

      return {
        ...s,
        color,
        openPosType: op?.type ?? null,
        openPnlPct: openPnl,
        entryTime: op?.entryTime ?? null,
        recentPnl: lastT?.pnl ?? null,
        recent7d: snap.recent7d,
        distToTp,
        distToSl,
        reasons,
        statusSummary,
      }
    })
  }, [
    allListableStrategies, watchLimit, multiEngineSnapshots, pnlPrice, enginePrices,
    strategyColorMap, userStrategies, effectiveCandles, binancePair, strategy?.timeframe, SAFE_CATALOG_STRATEGIES,
    strategyId, visibleSignals,
  ])

  const currentStatusBox = useMemo(() => {
    const pos = openPos?.type === 'LONG' ? 'LONG' : openPos?.type === 'SHORT' ? 'SHORT' : '대기'
    const state = openPos?.type ? '진입 중' : (latestClosedSignal ? '종료됨' : '대기 중')
    const pnl = Number.isFinite(Number(openPnlPct)) ? Number(openPnlPct) : null
    const headline =
      openPos?.type === 'LONG' ? '현재 LONG 진입 중'
      : openPos?.type === 'SHORT' ? '현재 SHORT 진입 중'
      : latestClosedSignal ? '포지션 없음'
      : '진입 대기 상태'
    const actionText =
      state === '진입 중' ? '지금 포지션 유지 중입니다'
      : state === '대기 중' ? '진입 대기 상태입니다'
      : '직전 포지션이 종료되었습니다'
    return { pos, state, pnl, actionText, headline }
  }, [openPos?.type, openPnlPct, latestClosedSignal])

  const distanceBox = useMemo(() => {
    const curr = Number(pnlPrice)
    const tpPct = Number.isFinite(Number(slTpDisplay?.tp)) && curr > 0
      ? ((Number(slTpDisplay.tp) - curr) / curr) * 100
      : null
    const slPct = Number.isFinite(Number(slTpDisplay?.sl)) && curr > 0
      ? ((Number(slTpDisplay.sl) - curr) / curr) * 100
      : null
    return {
      tpPct: Number.isFinite(tpPct) ? tpPct : null,
      slPct: Number.isFinite(slPct) ? slPct : null,
    }
  }, [pnlPrice, slTpDisplay])

  const topReasonLines = useMemo(() => {
    if (!Array.isArray(entryRationale) || entryRationale.length === 0) {
      return ['근거 데이터가 아직 충분하지 않습니다']
    }
    return entryRationale
      .map((r) => String(r?.label ?? '').trim())
      .filter(Boolean)
      .map((line) => (line.includes('→') ? String(line).split('→')[0].trim() : line))
      .slice(0, 5)
  }, [entryRationale])

  const recentSignalRows = useMemo(
    () => [...safeArray(visibleSignals)]
      .sort((a, b) => Number(b?.time ?? 0) - Number(a?.time ?? 0))
      .slice(0, 8)
      .map((s, i) => ({
        id: s.signalId ?? `${s.type}-${s.time}-${i}`,
        type: s.type === 'ENTRY' ? String(s.direction ?? 'LONG').toUpperCase() : String(s.type ?? 'WAIT').toUpperCase(),
        price: Number(s.price),
        time: fmtEntryTime(s.time),
        rawTime: Number(s.time),
        note: s.note ?? '',
        open: Boolean(s.open),
      })),
    [visibleSignals],
  )

  const onSignalListRowClick = useCallback((s) => {
    if (!s || s.type === 'WAIT') return
    const rt = Number(s.rawTime)
    appendViewedSignal({
      strategyId,
      strategyName: displayName,
      symbol: binancePair,
      type: s.type,
      signalTs: Number.isFinite(rt) ? rt : Date.now(),
      signalKey: `${strategyId}-${s.id}`,
    })
  }, [strategyId, displayName, binancePair])

  const chartCaption = useMemo(() => {
    const posLine = `현재 ${currentStatusBox.pos} 포지션 ${currentStatusBox.state}`
    const recentLine = currentSignal
      ? `최근 신호: ${fmtEntryTime(currentSignal.time)} ${String(currentSignal.direction ?? currentSignal.type ?? '').toUpperCase()}`
      : '최근 신호: —'
    const curr = Number(pnlPrice)
    const tpPct = Number.isFinite(Number(slTpDisplay?.tp)) && curr > 0
      ? ((Number(slTpDisplay.tp) - curr) / curr) * 100
      : null
    const slPct = Number.isFinite(Number(slTpDisplay?.sl)) && curr > 0
      ? ((Number(slTpDisplay.sl) - curr) / curr) * 100
      : null
    const tpPart = Number.isFinite(tpPct) ? `${tpPct >= 0 ? '+' : ''}${tpPct.toFixed(2)}%` : '—'
    const slPart = Number.isFinite(slPct) ? `${slPct >= 0 ? '+' : ''}${slPct.toFixed(2)}%` : '—'
    return { posLine, recentLine, riskLine: `익절 ${tpPart} / 손절 ${slPart}` }
  }, [currentStatusBox, currentSignal, pnlPrice, slTpDisplay])

  const chartWatermark = displayName || (strategy?.name ?? '')

  /* ── JSX ───────────────────────────────── */
  return (
    <PageShell wide className="min-w-0">
      <PageHeader title="시그널" />
      {locked && (
        <div className="mb-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 dark:border-amber-900/45 dark:bg-amber-950/25">
          <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-100">
            {FREE_VS_PAID.lockedBanner}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
            <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-900/50">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{FREE_VS_PAID.freeTitle}</p>
              <ul className="mt-1 list-disc list-inside text-slate-600 dark:text-slate-400">
                {FREE_VS_PAID.freeItems.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-sky-200/80 bg-sky-50/80 px-2.5 py-2 dark:border-sky-900/40 dark:bg-sky-950/20">
              <p className="font-semibold text-sky-900 dark:text-sky-100">{FREE_VS_PAID.paidTitle}</p>
              <ul className="mt-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                {FREE_VS_PAID.paidItems.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
      {chartError && chartDataSource === 'fallback' && (
        <p className="mb-3 text-[12px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-3 py-2">
          Binance 캔들을 불러오지 못해 참고용 데이터로 시뮬레이션합니다. 네트워크를 확인해 주세요.
        </p>
      )}

      <div className="signal-page-layout">

        <aside className="signal-sidebar flex flex-col gap-2">
          {typeof onStrategyNotifySettingsChange === 'function' && (
            <div className="rounded-[8px] border border-slate-200 bg-white px-2.5 py-2 dark:border-gray-700 dark:bg-gray-900/50">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
                전략별 알림
              </p>
              <div className="space-y-1.5 max-h-[min(40vh,280px)] overflow-y-auto pr-0.5">
                {allListableStrategies.slice(0, watchLimit).map((s) => (
                  <StrategyNotifyToggles
                    key={`notify-${s.id}`}
                    strategyName={s.name}
                    settingsRaw={strategyNotifySettings[s.id]}
                    onPatch={(patch) => onStrategyNotifySettingsChange(s.id, patch)}
                  />
                ))}
              </div>
            </div>
          )}

          {allListableStrategies.slice(0, watchLimit).map((s) => {
            const isActive = s.id === strategyId
            const summary = monitorRows.find((w) => w.id === s.id)
            return (
              <SignalRow
                key={s.id}
                strategy={s}
                color={strategyColorMap[s.id] ?? '#94a3b8'}
                isActive={isActive}
                isLocked={s.locked}
                openPosType={summary?.openPosType ?? null}
                openPnlPct={summary?.openPnlPct ?? null}
                recent7d={summary?.recent7d ?? null}
                rationale={isActive ? entryRationale : EMPTY_ARRAY}
                onClick={() => setStrategyId(s.id)}
                onGoValidation={typeof onGoValidation === 'function' ? onGoValidation : undefined}
                onGoMarket={goMarketCb}
              />
            )
          })}

          {/* 잠긴 전략 (watchLimit 초과) */}
          {allListableStrategies.length > watchLimit && (
            <div className="mt-1 rounded-lg border border-dashed border-slate-200 dark:border-gray-700 px-2.5 py-2 text-center">
              <Lock size={11} className="text-slate-300 dark:text-slate-600 mx-auto mb-1" />
              <p className="text-[9px] text-slate-400 leading-snug">
                +{allListableStrategies.length - watchLimit}개 더
              </p>
            </div>
          )}
        </aside>

        <main className="signal-main space-y-5">

          <section className="signal-top-status" aria-labelledby="signal-active-heading">
            <h2 id="signal-active-heading" className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 mb-3">
              현재 상태 · 판단 · 진입 근거
            </h2>
            <div className={cn(panelBase, 'p-4 space-y-4')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-slate-400">현재 상태</p>
                  <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {currentStatusBox.headline}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    미실현 손익{' '}
                    <span className={cn(
                      'tabular-nums font-semibold',
                      currentStatusBox.pnl == null && 'text-slate-500 dark:text-slate-400',
                      currentStatusBox.pnl != null && currentStatusBox.pnl >= 0 && 'text-emerald-600 dark:text-emerald-400',
                      currentStatusBox.pnl != null && currentStatusBox.pnl < 0 && 'text-red-500 dark:text-red-400',
                    )}>
                      {currentStatusBox.pnl == null ? '—' : `${currentStatusBox.pnl >= 0 ? '+' : ''}${currentStatusBox.pnl.toFixed(2)}%`}
                    </span>
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                  <p>익절까지 {distanceBox.tpPct == null ? '—' : `${distanceBox.tpPct >= 0 ? '+' : ''}${distanceBox.tpPct.toFixed(2)}%`}</p>
                  <p>손절까지 {distanceBox.slPct == null ? '—' : `${distanceBox.slPct >= 0 ? '+' : ''}${distanceBox.slPct.toFixed(2)}%`}</p>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">현재 판단</p>
                <p className="mt-1 text-sm text-slate-800 dark:text-slate-100 leading-snug">
                  {signalTrustInsight || currentStatusBox.actionText}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">진입 근거</p>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {topReasonLines.map((line, i) => (
                    <li key={`${line}-${i}`}>{line}</li>
                  ))}
                </ul>
              </div>
              <EntryRationalePanel
                notes={entryRationale}
                strength={signalStrength}
                openPos={openPos}
                slTpDisplay={slTpDisplay}
                pnlPrice={pnlPrice}
                locked={locked}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-gray-800">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  선택 전략: {displayName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {typeof onGoValidation === 'function' && (
                    <Button variant="secondary" size="sm" type="button" onClick={() => onGoValidation(strategyId)}>
                      <BarChart2 size={12} className="mr-1 opacity-80" />
                      검증 보기
                    </Button>
                  )}
                  {onNavigate && (
                    <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate('market')}>
                      <ExternalLink size={12} className="mr-1 opacity-80" />
                      전략 상세
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 잠금 배너 */}
          {locked && (
            <div className="px-4 py-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/25">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 mb-1">
                이 전략은 구독(또는 체험) 후 실시간 실행할 수 있어요
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                {PLAN_MESSAGES.simulationLocked}
                {strategyId !== FREE_SIM_ID && (
                  <> {' '}
                    <button type="button" onClick={() => setStrategyId(FREE_SIM_ID)} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      무료 전략으로 이동
                    </button>
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => onSubscribe?.()}>
                  {UPSELL_COPY.ctaSubscribe}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onStartTrial?.(strategyId)}>
                  {UPSELL_COPY.ctaTrial}
                </Button>
                <button type="button" onClick={() => navigateToSubscriptionSection(onNavigate)} className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">
                  플랜 비교
                </button>
              </div>
            </div>
          )}

          {riskAlerts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {riskAlerts.map((a) => (
                <div key={a.key} className={cn(
                  a.level === 'danger' ? panelDanger : panelWarning,
                  'px-2.5 py-1.5 text-[11px] font-semibold',
                )}>
                  {a.text}
                </div>
              ))}
            </div>
          )}

          <section className="signal-chart-section" aria-label="캔들 차트">
          <Card className={cn(panelBase, 'rounded-2xl shadow-sm')}>
            <Card.Header className="flex flex-col gap-2 border-b border-slate-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">가격 흐름</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">현재 포지션과 시그널 마커를 함께 표시합니다</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* 선택 전략 색상 표시 */}
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: selectedColor }}
                  />
                  <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                    {displayName}
                  </p>
                  {openPos ? (
                    <Badge variant={dirVariant(openPos.type)}>
                      {openPos.type === 'LONG' ? 'LONG 보유' : openPos.type === 'SHORT' ? 'SHORT 보유' : `${openPos.type} 보유`}
                    </Badge>
                  ) : (
                    <Badge variant="default">대기</Badge>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">
                    {formatSignalPrice(marketPriceMeta, displayPrice)}
                  </p>
                  <p className="text-[10px] text-slate-500">참고 시세</p>
                </div>
              </div>

              <p className="text-[9px] text-slate-500 dark:text-slate-500">
                SAFE MODE · 주문 대행 없음 · 검증 기준: {validationBaselineLabel}
                {signalAssetClass === 'ALT' && validationSymbolList.length > 0
                  ? ` · ALT: ${validationSymbolList.slice(0, 3).join(', ')}${validationSymbolList.length > 3 ? '…' : ''}`
                  : ''}
              </p>

              <div className="rounded-lg border border-slate-200/80 dark:border-gray-700 bg-white/80 dark:bg-gray-900/50 px-2.5 py-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <p className="text-slate-500">전략</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{displayName || '전략 없음'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">상태</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{openPos?.type ?? '대기'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">수익률</p>
                    <p className={cn('font-semibold tabular-nums', openPnlPct != null ? pnlClass(openPnlPct) : 'text-slate-600 dark:text-slate-300')}>
                      {openPnlPct != null ? `${openPnlPct >= 0 ? '+' : ''}${openPnlPct.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
                <SignalTrustStrip
                  className="mt-2"
                  trustPct={signalTrustMetrics.trustPct}
                  recentSuccessPct={signalTrustMetrics.recentSuccessPct}
                  matchPct={signalTrustMetrics.matchPct}
                />
                <div className={cn('mt-3', signalTrustPanelClass)}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Signal Trust
                  </p>
                  {signalPageHighlightEvent && (
                    <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-2.5 py-2 text-[11px] leading-snug text-slate-600 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-slate-300">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">
                        시장 이벤트: {String(signalPageHighlightEvent.impact ?? '').toLowerCase() === 'high' ? '높음' : '보통'}
                        {' '}
                        · {signalPageHighlightEvent.title}
                      </p>
                      {signalPageEventOnStrategy ? (
                        <p className="mt-1 text-slate-600 dark:text-slate-400">
                          이 전략 영향: {signalPageEventOnStrategy.summary}
                          {' '}
                          ({signalPageEventOnStrategy.impactLevel === 'positive' ? '긍정적 참고' : signalPageEventOnStrategy.impactLevel === 'warning' ? '주의' : '중립'})
                        </p>
                      ) : null}
                      {signalEventTrustAdjustment !== 0 ? (
                        <p className="mt-1 text-slate-500 dark:text-slate-500">
                          신호 신뢰도 보정: 이벤트 불확실성 반영 {signalEventTrustAdjustment}점
                        </p>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        시그널 신뢰도
                        {' '}
                        <span className="tabular-nums">{signalTrustScore}</span>
                        점
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-snug">
                        {signalTrustInsight}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium bg-white/70 text-slate-700 dark:bg-black/20 dark:text-slate-200">
                      {signalTrustGrade.label}
                    </span>
                  </div>
                  {signalTrustEvidenceTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {signalTrustEvidenceTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/60 px-2 py-1 text-[11px] text-slate-600 dark:bg-black/20 dark:text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 rounded-lg border border-slate-200/90 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/35 px-2.5 py-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <ChartSymbolCombobox
                      value={chartSymbolDraft}
                      onChange={setChartSymbolDraft}
                      onCommit={commitChartSymbol}
                      suggestions={chartSymbolOptions}
                      favoriteSet={favoriteSet}
                      onToggleFavorite={toggleFavorite}
                      disabled={locked}
                      className="sm:max-w-[240px]"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 text-[11px]"
                        onClick={applyChartSymbol}
                        disabled={locked}
                      >
                        적용
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[11px] shrink-0"
                        onClick={() => window.open(binanceTradeUrl, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink size={12} className="opacity-80 mr-0.5" aria-hidden />
                        거래소
                      </Button>
                    </div>
                    <div className={cn(
                      'rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-1 flex flex-wrap items-center gap-1',
                      locked && 'opacity-60 pointer-events-none',
                    )}
                    >
                      {CHART_TF_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setChartTf(o.value)}
                          className={cn(
                            'h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-colors',
                            o.value === chartTf
                              ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200'
                              : 'border-transparent bg-transparent text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-white dark:hover:bg-gray-800',
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
                    <p className="text-[10px] sm:text-[11px] font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      기준 {kstWallClock}
                      {' '}
                      <span className="text-slate-400 font-normal">KST</span>
                    </p>
                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        갱신 Live {fmtLiveTime(fastUpdatedAt)}
                      </span>
                      <span className={cn(
                        'text-[11px] font-semibold tabular-nums tracking-tight',
                        displayChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                      )}>
                        {priceSign}{displayChangePct}%
                      </span>
                      {effectiveStatus === 'subscribed' ? (
                        <Badge variant="info">구독 중</Badge>
                      ) : (
                        <Button variant={statusCfg.ctaVariant} size="sm" onClick={handleCTA}>
                          {statusCfg.cta}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="py-3 pt-0">
              <div className="space-y-2 min-w-0">
                {strategyLegendItems.length > 0 && (
                  <StrategyMarkerLegend items={strategyLegendItems} />
                )}
                <div className="rounded-md border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-slate-300">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{chartCaption.posLine}</p>
                  <p className="mt-0.5">{chartCaption.recentLine} · {chartCaption.riskLine}</p>
                </div>
                <div className="relative min-h-[240px] h-[min(360px,48vh)] sm:h-[min(440px,52vh)] sm:min-h-[300px] overflow-hidden rounded-[8px] border border-slate-100 bg-white dark:border-gray-800 dark:bg-gray-950/30">
                <div className={cn('h-full relative', locked && 'opacity-[0.65] pointer-events-none select-none')}>
                  <SectionErrorBoundary title="차트를 불러오지 못했습니다" fallbackDescription="잠시 후 다시 시도하거나 새로고침해 주세요.">
                  {(() => {
                    const safeCandles = Array.isArray(effectiveCandles) ? effectiveCandles : []
                    const safePrices  = Array.isArray(effectivePrices) ? effectivePrices : []

                    if (chartLoading && safeCandles.length === 0) {
                      return <ChartSkeleton className="h-full" />
                    }
                    if (chartError) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center gap-3 px-3 text-center">
                          <span className="text-[12px] text-red-500">{chartError}</span>
                          <Button variant="secondary" size="sm" type="button" onClick={() => { refetchChart?.() }}>
                            <RotateCcw size={12} className="inline mr-1 opacity-80" /> 다시 시도
                          </Button>
                        </div>
                      )
                    }
                    if (safeCandles.length > 0) {
                      const multiOn = strategyOverlays.length > 0
                      const useBundles = strategySignalBundles.length > 0
                      const hasOverlayLines = priceLineOverlays.length > 0
                      return (
                        <CandlestickChart
                          candles={safeCandles}
                          strategySignalBundles={useBundles ? strategySignalBundles : null}
                          entries={useBundles || multiOn ? EMPTY_ARRAY : entryIdxs}
                          exits={useBundles || multiOn ? EMPTY_ARRAY : exitIdxs}
                          strategyOverlays={useBundles ? null : (multiOn ? strategyOverlays : null)}
                          priceLineOverlays={hasOverlayLines ? priceLineOverlays : null}
                          openEntry={
                            hasOverlayLines || multiOn || useBundles
                              ? null
                              : (openPos?.entryPrice ?? null)
                          }
                          openDir={openPos?.type ?? 'LONG'}
                          openPnlPct={openPnlPct}
                          emphasizeOpen={!hasOverlayLines && !multiOn && !useBundles && !!openPos}
                          strategyName={chartWatermark}
                        />
                      )
                    }
                    const mockPrices = safePrices
                      .map((p) => (p != null && typeof p === 'object' ? Number(p.price) : Number(p)))
                      .filter(Number.isFinite)
                    if (mockPrices.length > 1) {
                      return (
                        <MockChart
                          prices={mockPrices}
                          entries={Array.isArray(entryIdxs) ? entryIdxs : []}
                          exits={Array.isArray(exitIdxs) ? exitIdxs : []}
                          openEntry={openPos?.entryPrice ?? null}
                          openDir={openPos?.type ?? 'LONG'}
                        />
                      )
                    }
                    return (
                      <div className="h-full flex items-center justify-center">
                        <EmptyState
                          title="차트 데이터가 없습니다"
                          description="다른 전략 또는 시간 프레임으로 다시 시도해 주세요."
                          bordered={false}
                        />
                      </div>
                    )
                  })()}
                  </SectionErrorBoundary>
                </div>
                {locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center bg-white/70 dark:bg-gray-900/70 pointer-events-auto">
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug max-w-[280px]">{UPSELL_COPY.chartOverlay}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="primary" size="sm" type="button" onClick={() => onSubscribe?.()}>{UPSELL_COPY.ctaSubscribe}</Button>
                      <Button variant="secondary" size="sm" type="button" onClick={() => onStartTrial?.(strategyId)}>{UPSELL_COPY.ctaTrialShort}</Button>
                    </div>
                  </div>
                )}
                {chartLoading && (
                  <div className="absolute top-2 right-2 rounded-md border border-slate-200 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-gray-700 dark:bg-gray-900/80 dark:text-slate-300">
                    데이터 업데이트 중...
                  </div>
                )}
              </div>
              </div>
            </Card.Content>
          </Card>
          </section>

          <section className="signal-list-section" aria-label="시그널 기록">
            <div className={cn(panelBase, 'p-4')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">시그널 기록</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{recentSignalRows.length}건</p>
              </div>
              <div className="mt-3 rounded-xl border border-slate-100 dark:border-gray-800 overflow-hidden">
                <SignalList signals={recentSignalRows} onRowClick={onSignalListRowClick} />
              </div>
            </div>
          </section>

          {/* 면책 */}
          {!locked && (
            <p className="text-[11px] text-slate-500 dark:text-slate-600 leading-relaxed pb-6">
              참고용 시뮬레이션 결과이며 투자 권유가 아닙니다.
            </p>
          )}

        </main>
      </div>
    </PageShell>
  )
}

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
import SignalReasonPanel from '../components/charts/SignalReasonPanel'
import { ChartSkeleton } from '../components/ui/Skeleton'
import SignalList   from '../components/simulation/SignalList'
import { cn }       from '../lib/cn'
import {
  STRATEGIES,
  CHART_DATA,
  STATUS_CONFIG,
} from '../data/simulationMockData'
import {
  isSimLocked, getSignalLimit, FREE_SIM_ID,
  getTrialUrgencyClass, getTrialUrgencyBg, PLAN_MESSAGES,
  navigateToSubscriptionSection,
  UPSELL_COPY,
  getEffectiveProductTier,
  PLAN_TIER,
} from '../lib/userPlan'
import { seededRng, strToSeed } from '../lib/seedRandom'
import { isUserStrategyId, getUserStrategyById, ASSET_TO_SIM_ID } from '../lib/userStrategies'
import {
  normalizePrices,
  generateSignalsFromPrices,
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
import { shouldNotifySignal } from '../lib/signalNotifyEligibility'
import { isSignalNotifyKeyRecorded } from '../lib/signalNotificationDedupe'
import { normalizeBinanceSymbol } from '../lib/marketCandles'
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

/** 플랜별 동시 관찰 가능 전략 수 (무료 1~2 · 상위 5~10) */
function getWatchLimit(user) {
  const plan = user?.plan ?? 'free'
  if (plan === 'subscribed') {
    return getEffectiveProductTier(user) === PLAN_TIER.PREMIUM ? 10 : 5
  }
  if (plan === 'trial') return 3
  return 2
}

/** 사이드바 등에 표시할 짧은 플랜 이름 (영문 코드 숨김) */
function planDisplayLabel(user) {
  const plan = user?.plan ?? 'free'
  if (plan === 'subscribed') return '구독 중'
  if (plan === 'trial') return '체험 중'
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

const TIMEFRAME_TO_KLINES_INTERVAL = {
  '1H': '1h', '2H': '2h', '4H': '4h', '1D': '1d',
}

const CHART_TF_OPTIONS = [
  { value: '15m', label: '15m' },
  { value: '1h',  label: '1h'  },
  { value: '4h',  label: '4h'  },
  { value: '1d',  label: '1d'  },
]

const FALLBACK_STRATEGY = {
  id: 'btc-trend',
  name: '기본 전략',
  symbol: 'BTCUSDT',
  asset: 'BTC',
  timeframe: '1H',
  status: 'not_started',
  runningStatus: 'stopped',
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
  if (type === 'LONG') return '롱'
  if (type === 'SHORT') return '숏'
  return type ?? '관망'
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
            'text-[11px] font-semibold truncate flex-1 leading-tight',
            isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400',
          )}>
            {strategy.name}
          </span>
          {isLocked && <Lock size={9} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />}
        </div>

        {/* 현재 상태 + PnL */}
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={dirVariant(openPosType)}>
            {openPosType ? posLabelKo(openPosType) : '관망'}
          </Badge>
          {openPnlPct != null && openPosType && (
            <span className={cn(
              'text-[10px] font-semibold tabular-nums tracking-tight',
              pnlClass(openPnlPct),
            )}>
              {openPnlPct >= 0 ? '+' : ''}{openPnlPct}%
            </span>
          )}
        </div>

        {recent7d != null && Number.isFinite(recent7d) && (
          <p className={cn(
            'text-[9px] font-medium tabular-nums mb-1',
            recent7d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
          )}>
            지난 7일 누적 {recent7d >= 0 ? '+' : ''}{recent7d.toFixed(1)}%
          </p>
        )}

        {/* 진입 근거 미리보기 */}
        {rationale.length > 0 && isActive && (
          <div className="space-y-0.5 mb-2">
            {rationale.slice(0, 2).map((r, i) => (
              <p key={i} className="text-[9px] text-slate-500 dark:text-slate-500 truncate leading-snug">
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
              onClick={(e) => { e.stopPropagation(); onGoValidation(strategy.id) }}
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

/** 우측 상단 — 활성 시그널 상태판 (멀티 전략 한눈에) */
const ActiveSignalStatusBoard = memo(function ActiveSignalStatusBoard({ rows, selectedId, onSelect }) {
  if (!rows?.length) {
    return (
      <div className="rounded-[8px] border border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[13px] text-slate-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-slate-400">
        표시할 전략이 없습니다
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
      {rows.map((s) => {
        const isSel = s.id === selectedId
        const color = s.color ?? '#64748b'
        const posType = s.openPosType
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              'text-left rounded-[8px] border bg-white px-3 py-3 transition-colors shadow-none dark:bg-gray-900/40',
              isSel
                ? 'border-blue-500 ring-1 ring-blue-500/25'
                : 'border-slate-200 hover:border-slate-300 dark:border-gray-700 dark:hover:border-gray-600',
            )}
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                {s.name}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
              <Badge variant={dirVariant(posType)} className="text-[10px]">
                {posType ? posLabelKo(posType) : '대기'}
              </Badge>
              {s.openPnlPct != null && posType && (
                <span
                  className={cn(
                    'text-[18px] font-bold tabular-nums tracking-tight',
                    s.openPnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {s.openPnlPct >= 0 ? '+' : ''}
                  {Number(s.openPnlPct).toFixed(1)}%
                </span>
              )}
              {!posType && s.recentPnl != null && (
                <span className={cn('text-[12px] font-semibold tabular-nums', pnlClass(s.recentPnl))}>
                  직전 청산 {s.recentPnl >= 0 ? '+' : ''}
                  {s.recentPnl}%
                </span>
              )}
            </div>
            {s.statusSummary && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mb-2 line-clamp-2">{s.statusSummary}</p>
            )}
            {s.entryTime != null && posType && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug tabular-nums">
                진입 {fmtEntryTime(s.entryTime)} · 보유 {fmtHoldDuration(s.entryTime)}
              </p>
            )}
            {s.recent7d != null && Number.isFinite(s.recent7d) && (
              <p
                className={cn(
                  'text-[10px] font-medium tabular-nums mt-1',
                  s.recent7d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                )}
              >
                최근 7일 누적 {s.recent7d >= 0 ? '+' : ''}
                {s.recent7d.toFixed(1)}%
              </p>
            )}
            {s.isLocked && (
              <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-1">
                <Lock size={9} /> 잠금
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}, (a, b) => {
  if (a.selectedId !== b.selectedId) return false
  if (a.rows === b.rows) return true
  const ra = a.rows
  const rb = b.rows
  if (!ra || !rb || ra.length !== rb.length) return false
  for (let i = 0; i < ra.length; i++) {
    const x = ra[i]
    const y = rb[i]
    if (x.id !== y.id || x.openPnlPct !== y.openPnlPct || x.openPosType !== y.openPosType
      || x.recent7d !== y.recent7d || x.recentPnl !== y.recentPnl || x.entryTime !== y.entryTime
      || x.statusSummary !== y.statusSummary) return false
  }
  return true
})

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
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">조건 충족도</span>
            <span className={cn('text-[12px] font-bold tabular-nums', strengthColor)}>{strength}</span>
          </div>
        </div>
        <div className="mb-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', strengthBg)}
            style={{ width: `${strength}%` }}
          />
        </div>
        {notes.length === 0 ? (
          <p className="text-[11px] text-slate-500">이번 진입에 대한 설명을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
                <span className="text-[12px] text-slate-700 dark:text-slate-200 leading-snug">{n.label}</span>
              </li>
            ))}
          </ul>
        )}
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
            <p className="text-[10px] text-slate-500 mb-0.5">익절 목표까지</p>
            <p className={cn('text-[12px] font-semibold tabular-nums', distToTp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
              {distToTp >= 0 ? '+' : ''}{distToTp}%
            </p>
          </div>
        )}
        {distToSl != null && (
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">손절 라인까지</p>
            <p className="text-[12px] font-semibold tabular-nums text-red-600 dark:text-red-400">
              {distToSl.toFixed(2)}%
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** 최근 거래 행 */
const RecentTradeRow = memo(function RecentTradeRow({ trade, isLast }) {
  const pnlPos = trade.pnl >= 0
  return (
    <div className={cn(
      'flex items-center gap-3 px-3.5 py-2',
      !isLast && 'border-b border-slate-100 dark:border-gray-800',
    )}>
      <Badge variant={dirVariant(trade.dir)}>{posLabelKo(trade.dir)}</Badge>
      <span className="text-[10px] font-mono text-slate-500 tabular-nums">
        {trade.entry.toLocaleString()}
      </span>
      <span className="text-[9px] text-slate-300 dark:text-slate-700">→</span>
      <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 tabular-nums">
        {trade.exit.toLocaleString()}
      </span>
      <div className="flex-1" />
      <span className={cn(
        'text-[11px] font-bold font-mono tabular-nums',
        pnlPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
      )}>
        {pnlPos ? '+' : ''}{trade.pnl}%
      </span>
      <span className={cn('text-[10px] font-bold', trade.win ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-400')}>
        {trade.win ? '✓' : '✗'}
      </span>
    </div>
  )
}, (a, b) => a.isLast === b.isLast && a.trade.entry === b.trade.entry && a.trade.exit === b.trade.exit
  && a.trade.pnl === b.trade.pnl && a.trade.dir === b.trade.dir && a.trade.win === b.trade.win)

/** 성과 스냅샷 KPI (숫자 영역만 갱신되도록 분리) */
const SignalPerfKpi = memo(function SignalPerfKpi({ trades, closedPerf, lastTrade }) {
  const n = trades?.length ?? 0
  const winPct = (() => {
    if (!n) return '—'
    const w = trades.filter((t) => !!t.win).length
    return `${Math.round((w / n) * 100)}%`
  })()
  const lastPnl = lastTrade?.pnl
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
        <p className="text-[10px] text-slate-500 mb-0.5">완료된 거래 수</p>
        <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 tabular-nums">{n.toLocaleString()}</p>
      </div>
      <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
        <p className="text-[10px] text-slate-500 mb-0.5">이기는 비율</p>
        <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 tabular-nums">{winPct}</p>
      </div>
      <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
        <p className="text-[10px] text-slate-500 mb-0.5">마지막 한 번 손익</p>
        <p className={cn(
          'text-[15px] font-bold tabular-nums',
          lastPnl != null ? (lastPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-slate-900 dark:text-slate-100',
        )}
        >
          {lastPnl != null ? `${lastPnl >= 0 ? '+' : ''}${lastPnl}%` : '—'}
        </p>
      </div>
    </div>
  )
}, (a, b) => a.trades === b.trades && a.closedPerf?.roi === b.closedPerf?.roi
  && a.lastTrade?.pnl === b.lastTrade?.pnl && a.lastTrade?.entry === b.lastTrade?.entry)

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
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: ['btc-trend'] }
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
  const signalLimit = getSignalLimit(u)
  const trialDays = u.trialDaysLeft

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

  const assetSymbol = useMemo(() => {
    const fromSymbol = strategy?.symbol && String(strategy.symbol).replace(/USDT$/i, '')
    return (userStrat?.asset || strategy?.asset || fromSymbol || 'BTC').toUpperCase()
  }, [userStrat?.asset, strategy?.asset, strategy?.symbol])

  const klinesSymbol = useMemo(() => {
    if (userStrat?.asset) return String(userStrat.asset).trim().toUpperCase()
    if (strategy?.symbol) return String(strategy.symbol).trim().toUpperCase()
    return 'BTCUSDT'
  }, [userStrat?.asset, strategy?.symbol])

  const [chartTf, setChartTf] = useState('1h')
  useEffect(() => {
    const tf = strategy?.timeframe
    const mapped = tf ? (TIMEFRAME_TO_KLINES_INTERVAL[tf] ?? '1h') : '1h'
    setChartTf(mapped)
  }, [mockStrategyId, strategy?.timeframe])

  const klinesInterval = chartTf
  const chart = CHART_DATA[mockStrategyId]
  const binancePair = useMemo(() => normalizeBinanceSymbol(klinesSymbol), [klinesSymbol])
  const {
    candles: chartCandles,
    loading: chartLoading,
    error: chartError,
    source: chartDataSource,
    refetch: refetchChart,
  } = useMarketData(binancePair, klinesInterval, { limit: 500, pollMs: 1500 })

  const effectivePrices = useMemo(() => {
    if (chartCandles.length > 0) return chartCandles.map((c) => ({ time: c.time, price: c.close }))
    return chart?.prices ?? []
  }, [chartCandles, chart?.prices])

  const enginePrices = useMemo(() => normalizePrices(effectivePrices), [effectivePrices])

  const strategyConfig = useMemo(() => {
    if (userStrat) return buildEngineConfigFromUserStrategy(userStrat, { candles: chartCandles })
    return buildCatalogStrategyEngineConfig(
      { id: mockStrategyId, symbol: strategy?.symbol, timeframe: strategy?.timeframe },
      { candles: chartCandles },
    )
  }, [userStrat, chartCandles, mockStrategyId, strategy?.symbol, strategy?.timeframe])

  /* ── 단일 엔진 파이프라인 (캔들 → runStrategy → 시그널·거래·성과) ── */
  const engineResult = useMemo(
    () => {
      if (!enginePrices.length || !chartCandles.length) {
        return { signals: [], trades: [], performance: { roi: 0, winRate: 0, totalTrades: 0, mdd: 0 } }
      }
      return runStrategy(chartCandles, null, { strategyConfig })
    },
    [enginePrices, strategyConfig, chartCandles],
  )

  const engineSignals = engineResult.signals
  const trades = engineResult.trades

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

  const displayPrice = marketPrice ?? currentPrice ?? liveData.basePrice
  const pnlPrice = marketPriceMeta.usdPrice ?? currentPrice ?? liveData.basePrice

  const entryIdxs = useMemo(
    () => engineSignals.filter((s) => s.type === 'ENTRY').map((s) => enginePrices.findIndex((p) => p.time === s.time)).filter((i) => i >= 0),
    [engineSignals, enginePrices],
  )
  const exitIdxs = useMemo(
    () => engineSignals.filter((s) => s.type === 'EXIT').map((s) => enginePrices.findIndex((p) => p.time === s.time)).filter((i) => i >= 0),
    [engineSignals, enginePrices],
  )

  const baseSignals = useMemo(() => {
    const tradeByEntryTime = new Map(trades.map((t) => [t.entryTime, t]))
    const displayedAtMs = Date.now()
    const ui = engineSignals.map((s) => {
      if (s.type === 'ENTRY') {
        const tr = tradeByEntryTime.get(s.time)
        const pnlStr = tr ? `${tr.pnl >= 0 ? '+' : ''}${tr.pnl.toFixed(1)}%` : null
        return {
          id: s.id, type: s.direction, price: s.price, time: `t=${s.time}`,
          open: !!s.open, pnl: tr ? pnlStr : null, note: s.note,
          timeIdx: s.time, generatedAtMs: Number.isFinite(Number(s.time)) ? Number(s.time) : null, displayedAtMs,
        }
      }
      return {
        id: s.id, type: 'EXIT', price: s.price, time: `t=${s.time}`,
        open: false, pnl: null, note: s.note, timeIdx: s.time,
        generatedAtMs: Number.isFinite(Number(s.time)) ? Number(s.time) : null, displayedAtMs,
      }
    })
    return ui.sort((a, b) => (b.timeIdx ?? 0) - (a.timeIdx ?? 0))
  }, [engineSignals, trades])

  const [dynamicSignals, setDynamicSignals] = useState(() => baseSignals)
  useEffect(() => { setDynamicSignals(baseSignals) }, [baseSignals])
  useEffect(() => { setCurrentPrice(liveData.basePrice) }, [mockStrategyId]) // eslint-disable-line

  useEffect(() => {
    let cancelled = false
    const POLL_MS = 1500
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
      } catch { /* 조용히 무시 — 이전 값 유지 */ }
    }
    loadPrice()
    const id = setInterval(loadPrice, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [assetSymbol])

  const allSignals = dynamicSignals
  const signals = signalLimit === Infinity ? allSignals : allSignals.slice(0, signalLimit)
  const hiddenCount = allSignals.length - signals.length

  const openPos = useMemo(
    () => calculateOpenPosition(engineSignals, pnlPrice || (enginePrices.at(-1)?.price ?? 0)),
    [engineSignals, pnlPrice, enginePrices],
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

  const lastTrade = useMemo(() => trades?.length > 0 ? trades[trades.length - 1] : null, [trades])
  const closedPerf = engineResult.performance
  const last5Trades = useMemo(() => trades?.length ? trades.slice(-5) : [], [trades])

  const riskAlerts = useMemo(
    () => buildRetentionRiskAlerts({ mdd: closedPerf.mdd, totalTrades: trades.length, recentTrades: trades }),
    [closedPerf.mdd, trades],
  )

  const chartTfLabel = useMemo(
    () => CHART_TF_OPTIONS.find((o) => o.value === chartTf)?.label ?? chartTf,
    [chartTf],
  )

  const effectiveStatus = userStatus[mockStrategyId] ?? strategy.status ?? 'not_started'
  const statusCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.not_started

  const displayChangePct = marketPriceMeta.changePercent ?? liveData.priceChangePct
  const priceSign = displayChangePct >= 0 ? '+' : ''

  // 시그널 알림
  const chartSeriesEpoch = useMemo(() => {
    if (chartCandles.length > 0) {
      const a = chartCandles[0].time; const b = chartCandles[chartCandles.length - 1].time
      return `live-${a}-${b}-${chartCandles.length}`
    }
    return `mock-${mockStrategyId}`
  }, [chartCandles, mockStrategyId])

  const signalNotifyHydrated = useRef(false)
  const signalSeenIds = useRef(new Set())
  useEffect(() => { signalNotifyHydrated.current = false; signalSeenIds.current = new Set() }, [mockStrategyId, klinesSymbol, klinesInterval, chartSeriesEpoch])

  async function handleCTA() {
    if (effectiveStatus === 'not_started') {
      setUserStatus((prev) => ({ ...prev, [mockStrategyId]: 'active' }))
      if (u.plan === 'free') await onStartTrial?.(mockStrategyId)
    } else if (effectiveStatus === 'active' || effectiveStatus === 'expired') {
      setUserStatus((prev) => ({ ...prev, [mockStrategyId]: 'subscribed' }))
      await onSubscribe?.()
    }
  }

  const displayName = userStrat?.name ?? strategy.name
  const recentSignalsDisplay = useMemo(() => signals.slice(0, 10), [signals])

  /* ── 색상 맵 ─────────────────────────────── */
  const allListableStrategies = useMemo(() => [
    ...(Array.isArray(userStrategies) ? userStrategies : []).map((s) => ({ id: s.id, name: s.name, isUser: true, locked: false })),
    ...SAFE_CATALOG_STRATEGIES.map((s) => ({ id: s.id, name: s.name, isUser: false, locked: isSimLocked(s.id, u) })),
  ], [userStrategies, u, SAFE_CATALOG_STRATEGIES])

  const strategyColorMap = useMemo(() => {
    const map = {}
    allListableStrategies.forEach((s, i) => {
      map[s.id] = getStrategyChartColor(s.id, i)
    })
    return map
  }, [allListableStrategies])

  const selectedColor = strategyColorMap[strategyId] ?? getStrategyChartColor(strategyId, 0)

  /** 동일 심볼·캔들 위에서 플랜 허용 한도만큼 엔진 재실행 → 멀티 오버레이 */
  const multiEngineSnapshots = useMemo(() => {
    const out = {}
    if (!enginePrices.length || !chartCandles.length) return out
    const userStratMap = new Map((Array.isArray(userStrategies) ? userStrategies : []).map((s) => [s.id, s]))
    const btMeta = chartCandles.length ? { endTime: chartCandles[chartCandles.length - 1].time } : {}
    const lastPrice = pnlPrice ?? enginePrices[enginePrices.length - 1]?.price ?? 0
    const list = allListableStrategies.slice(0, watchLimit)

    for (const row of list) {
      const id = row.id
      try {
        const us = userStratMap.get(id)
        const cat = SAFE_CATALOG_STRATEGIES.find((x) => x.id === id)
        const cfg = us
          ? buildEngineConfigFromUserStrategy(us, { candles: chartCandles })
          : buildCatalogStrategyEngineConfig(
              { id, symbol: klinesSymbol, timeframe: cat?.timeframe ?? strategy?.timeframe },
              { candles: chartCandles },
            )
        const res = runStrategy(chartCandles, null, { strategyConfig: cfg })
        const openPos = calculateOpenPosition(res.signals, lastPrice)
        out[id] = {
          signals: res.signals,
          trades: res.trades,
          performance: res.performance,
          openPos,
          recent7d: computeRecentRoiPct(res.trades, btMeta, 7),
        }
      } catch {
        out[id] = null
      }
    }
    return out
  }, [
    enginePrices, chartCandles, allListableStrategies, watchLimit, userStrategies,
    klinesSymbol, strategy?.timeframe, pnlPrice, SAFE_CATALOG_STRATEGIES,
  ])

  const browserNotifyGroups = useMemo(
    () => allListableStrategies.slice(0, watchLimit).map((s) => ({
      id: s.id,
      name: s.name,
      signals: multiEngineSnapshots[s.id]?.signals ?? [],
    })),
    [allListableStrategies, watchLimit, multiEngineSnapshots],
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
    const label = strategy.name ?? assetSymbol
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
  }, [engineSignals, currentUser?.id, strategy.name, assetSymbol, u, strategyId, userStrategyIdsList])

  const strategyOverlays = useMemo(() => {
    if (!enginePrices.length) return []
    return allListableStrategies.slice(0, watchLimit).map((s) => {
      const snap = multiEngineSnapshots[s.id]
      if (!snap?.signals?.length) return null
      const entryIdxs = snap.signals
        .filter((x) => x.type === 'ENTRY')
        .map((x) => enginePrices.findIndex((p) => p.time === x.time))
        .filter((i) => i >= 0)
      const exitIdxs = snap.signals
        .filter((x) => x.type === 'EXIT')
        .map((x) => enginePrices.findIndex((p) => p.time === x.time))
        .filter((i) => i >= 0)
      return {
        id: s.id,
        name: s.name,
        color: strategyColorMap[s.id],
        entryIdxs,
        exitIdxs,
      }
    }).filter(Boolean)
  }, [multiEngineSnapshots, allListableStrategies, watchLimit, enginePrices, strategyColorMap])

  /** 차트 마커용: 엔진 시그널 원본 (방향 LONG/SHORT 반영) */
  const strategySignalBundles = useMemo(() => {
    return allListableStrategies.slice(0, watchLimit).map((s) => ({
      id: s.id,
      name: s.name,
      color: strategyColorMap[s.id],
      signals: multiEngineSnapshots[s.id]?.signals ?? [],
    })).filter((b) => b.signals.length > 0)
  }, [allListableStrategies, watchLimit, strategyColorMap, multiEngineSnapshots])

  const strategyLegendItems = useMemo(
    () => allListableStrategies.slice(0, watchLimit).map((s) => ({
      strategyKey: s.id,
      strategyLabel: s.name,
      color: strategyColorMap[s.id],
    })),
    [allListableStrategies, watchLimit, strategyColorMap],
  )

  const priceLineOverlays = useMemo(() => {
    return allListableStrategies.slice(0, watchLimit).map((s) => {
      const op = multiEngineSnapshots[s.id]?.openPos
      if (!op?.entryPrice) return null
      return {
        price: op.entryPrice,
        color: strategyColorMap[s.id],
        title: `${String(s.name).slice(0, 14)} ${op.type}`,
        lineWidth: s.id === strategyId ? 2 : 1,
      }
    }).filter(Boolean)
  }, [multiEngineSnapshots, allListableStrategies, watchLimit, strategyColorMap, strategyId])

  /* ── 진입 근거 파싱 ──────────────────────── */
  const entryRationale = useMemo(() => {
    const entries = engineSignals.filter((s) => s.type === 'ENTRY')
    const latest = entries.at(-1)
    if (!latest) return []
    return enrichNote(parseEntryNote(latest.note ?? ''))
  }, [engineSignals])

  const signalStrength = useMemo(
    () => calcSignalStrength(entryRationale, strategyConfig),
    [entryRationale, strategyConfig],
  )

  /* ── 관찰 전략 행 — 상태·근거·목표/손절 거리 (멀티 모니터 단일 소스) ──────────────── */
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
          ? buildEngineConfigFromUserStrategy(us, { candles: chartCandles })
          : buildCatalogStrategyEngineConfig(
              { id: s.id, symbol: klinesSymbol, timeframe: cat?.timeframe ?? strategy?.timeframe },
              { candles: chartCandles },
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

      const entries = (snap.signals ?? []).filter((x) => x.type === 'ENTRY')
      const lastEntry = entries[entries.length - 1]
      const notes = lastEntry?.note ? enrichNote(parseEntryNote(lastEntry.note)) : []
      const reasons = notes.map((n) => n.label)

      let statusSummary = '관망 · 새 시그널 대기'
      if (op?.type) {
        if (openPnl != null) {
          statusSummary =
            openPnl >= 0
              ? `평가 이익 ${openPnl >= 0 ? '+' : ''}${openPnl.toFixed(1)}% · 목표·손절 거리는 아래 참고`
              : `평가 손실 ${openPnl.toFixed(1)}% · 변동성에 유의하세요`
        } else {
          statusSummary = `${op.type === 'LONG' ? '롱' : '숏'} 포지션 유지 중`
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
    strategyColorMap, userStrategies, chartCandles, klinesSymbol, strategy?.timeframe, SAFE_CATALOG_STRATEGIES,
  ])

  const signalReasonPanelItems = useMemo(
    () => monitorRows.map((r) => ({
      strategyKey: r.id,
      strategyLabel: r.name,
      color: r.color,
      reasons: r.reasons ?? [],
      positionLabel: r.openPosType ? posLabelKo(r.openPosType) : '대기',
      currentPnl:
        r.openPosType && r.openPnlPct != null
          ? `${r.openPnlPct >= 0 ? '+' : ''}${r.openPnlPct.toFixed(1)}%`
          : null,
      tpDistance: r.distToTp != null ? `${r.distToTp >= 0 ? '+' : ''}${r.distToTp}%` : null,
      slDistance: r.distToSl != null ? `${r.distToSl}%` : null,
    })),
    [monitorRows],
  )

  const chartWatermark = strategyOverlays.length > 1
    ? `${strategyOverlays.length}개 전략 동시 표시`
    : (strategy?.name ?? '')

  /* ── JSX ───────────────────────────────── */
  return (
    <PageShell wide className="min-w-0">
      <PageHeader
        title="실시간 전략 모니터"
        description="왼쪽에서 전략을 고르고, 위 상태판에서 움직임을 확인한 뒤, 차트와 아래 근거로 왜 들어갔는지까지 이어서 봅니다. 색은 전략마다 고정입니다."
      />
      {chartError && chartDataSource === 'fallback' && (
        <p className="mb-3 text-[12px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-3 py-2">
          Binance 캔들을 불러오지 못해 참고용 데이터로 시뮬레이션합니다. 네트워크를 확인해 주세요.
        </p>
      )}

      <div className="signal-page-layout">

        <aside className="signal-sidebar flex flex-col gap-2">
          <div className="rounded-[8px] border border-slate-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/50">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                구독 전략
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  {' '}
                  {Math.min(allListableStrategies.length, watchLimit)}/{watchLimit}
                </span>
              </p>
              <span className="text-[10px] font-medium text-slate-500 tabular-nums">{planDisplayLabel(u)}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-snug">
              상위 플랜일수록 더 많은 전략을 동시에 겹쳐 볼 수 있어요.
            </p>
          </div>

          {typeof onStrategyNotifySettingsChange === 'function' && (
            <div className="rounded-[8px] border border-slate-200 bg-white px-2.5 py-2 dark:border-gray-700 dark:bg-gray-900/50">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
                전략별 알림
              </p>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-2 leading-snug">
                시그널·인앱·OS 알림에 적용됩니다. 저장은 이 브라우저 계정 설정에 반영됩니다.
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
                rationale={isActive ? entryRationale : []}
                onClick={() => setStrategyId(s.id)}
                onGoValidation={typeof onGoValidation === 'function' ? onGoValidation : undefined}
                onGoMarket={onNavigate ? () => onNavigate('market') : undefined}
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
              <p className="text-[8px] text-slate-300 dark:text-slate-600 mt-0.5">
                구독 업그레이드 시 동시 관찰 확대
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.('mypage')}
                className="mt-1.5 text-[9px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                플랜 업그레이드
              </button>
            </div>
          )}

              <p className="text-[10px] text-slate-500 dark:text-slate-500 px-1 mt-1 leading-relaxed">
                동시에 볼 수 있는 개수는 요금제에 따라 달라요. 업그레이드하면 더 많이 겹쳐 볼 수 있어요.
              </p>
        </aside>

        <main className="signal-main space-y-5">

          <section className="signal-top-status" aria-labelledby="signal-active-heading">
            <h2 id="signal-active-heading" className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 mb-1">
              지금 움직이는 포지션
            </h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3 leading-snug">
              카드를 누르면 아래 차트와 선택 전략 설명이 바뀝니다. 색 점·마커·상태판이 모두 같은 전략을 가리킵니다.
            </p>
            <ActiveSignalStatusBoard
              rows={monitorRows}
              selectedId={strategyId}
              onSelect={setStrategyId}
            />
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
                  'rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold',
                  a.level === 'danger'
                    ? 'border-red-200 bg-red-50/90 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
                    : 'border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100',
                )}>
                  {a.text}
                </div>
              ))}
            </div>
          )}

          <section className="signal-chart-section" aria-label="캔들 차트">
          <Card className="rounded-[8px] border border-slate-200 shadow-none dark:border-gray-700">
            <Card.Header className="flex flex-col gap-2 border-b border-slate-100 dark:border-gray-800">
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
                  {strategyOverlays.length > 1 && (
                    <Badge variant="info" className="text-[9px]">+{strategyOverlays.length - 1}개 동시 표시</Badge>
                  )}
                  {openPos ? (
                    <Badge variant={dirVariant(openPos.type)}>
                      {openPos.type === 'LONG' ? '롱 보유' : openPos.type === 'SHORT' ? '숏 보유' : `${openPos.type} 보유`}
                    </Badge>
                  ) : (
                    <Badge variant="default">관망</Badge>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">
                    {formatSignalPrice(marketPriceMeta, displayPrice)}
                  </p>
                  <p className="text-[10px] text-slate-500">{strategy.symbol} · {chartTfLabel}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className={cn('flex items-center gap-1', locked && 'opacity-60 pointer-events-none')}>
                  {CHART_TF_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setChartTf(o.value)}
                      className={cn(
                        'h-7 px-2.5 rounded-[8px] text-[11px] font-semibold border transition-colors',
                        o.value === chartTf
                          ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200'
                          : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-300 hover:border-slate-300',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[11px] font-semibold tabular-nums tracking-tight',
                    displayChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                  )}>
                    {priceSign}{displayChangePct}%
                  </span>
                  {u.plan === 'trial' && trialDays > 0 && (
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-lg border', getTrialUrgencyBg(trialDays), getTrialUrgencyClass(trialDays))}>
                      체험 {trialDays}일
                    </span>
                  )}
                  {effectiveStatus === 'subscribed' ? (
                    <Badge variant="info">구독 중</Badge>
                  ) : (
                    <Button variant={statusCfg.ctaVariant} size="sm" onClick={handleCTA}>
                      {statusCfg.cta}
                    </Button>
                  )}
                </div>
              </div>
            </Card.Header>
            <Card.Content className="py-3 pt-0">
              <div className="space-y-2 min-w-0">
                {strategyLegendItems.length > 0 && (
                  <StrategyMarkerLegend items={strategyLegendItems} />
                )}
                <div className="relative min-h-[240px] h-[min(360px,48vh)] sm:h-[min(440px,52vh)] sm:min-h-[300px] overflow-hidden rounded-[8px] border border-slate-100 bg-white dark:border-gray-800 dark:bg-gray-950/30">
                <div className={cn('h-full relative', locked && 'blur-[1.5px] opacity-[0.55] pointer-events-none select-none')}>
                  <SectionErrorBoundary title="차트를 불러오지 못했습니다" fallbackDescription="잠시 후 다시 시도하거나 새로고침해 주세요.">
                  {(() => {
                    const safeCandles = Array.isArray(chartCandles) ? chartCandles : []
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
                      return (
                        <CandlestickChart
                          candles={safeCandles}
                          strategySignalBundles={useBundles ? strategySignalBundles : null}
                          entries={useBundles ? [] : (multiOn ? [] : (Array.isArray(entryIdxs) ? entryIdxs : []))}
                          exits={useBundles ? [] : (multiOn ? [] : (Array.isArray(exitIdxs) ? exitIdxs : []))}
                          strategyOverlays={useBundles ? null : (multiOn ? strategyOverlays : null)}
                          priceLineOverlays={priceLineOverlays.length > 0 ? priceLineOverlays : null}
                          openEntry={multiOn || useBundles ? null : (openPos?.entryPrice ?? null)}
                          openDir={openPos?.type ?? 'LONG'}
                          openPnlPct={openPnlPct}
                          emphasizeOpen={!multiOn && !useBundles && !!openPos}
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
              </div>
              </div>
            </Card.Content>
          </Card>
          </section>

          <section className="signal-reason-section" aria-labelledby="signal-reason-heading">
            <h2 id="signal-reason-heading" className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 mb-1">
              진입 근거 · 목표·손절 · 선택 전략 해석
            </h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3 leading-snug">
              멀티 전략이면 아래에 전략별로 겹친 근거가 그대로 표시됩니다. 선택한 전략({displayName})의 상세 해석은 그 아래에 이어집니다.
            </p>

            <SignalReasonPanel
              items={signalReasonPanelItems}
              title="전략별 요약 (포지션 · 거리 · 근거 태그)"
              className="mb-2"
            />

            <div className="rounded-[8px] border border-slate-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
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
              <EntryRationalePanel
                notes={entryRationale}
                strength={signalStrength}
                openPos={openPos}
                slTpDisplay={slTpDisplay}
                pnlPrice={pnlPrice}
                locked={locked}
              />
            </div>
          </section>

          {/* ── 4) 최근 시그널 리스트 ──────────── */}
          <Card>
            <Card.Header className="flex items-center justify-between">
              <div>
                <Card.Title>최근 일지</Card.Title>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">진입·청산이 일어난 순서대로 (최대 10건)</p>
              </div>
              <span className="text-[11px] text-slate-500 tabular-nums">{allSignals.length}건</span>
            </Card.Header>
            <div className="overflow-y-auto max-h-[220px]">
              <SignalList signals={recentSignalsDisplay} />
            </div>
            {hiddenCount > 0 && (
              <div className="border-t border-slate-100 dark:border-gray-800">
                <div className="relative overflow-hidden">
                  <div className="pointer-events-none select-none opacity-40" style={{ filter: 'blur(2px)' }}>
                    <SignalList signals={allSignals.slice(signalLimit, Math.min(signalLimit + 2, allSignals.length))} />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center bg-white/80 dark:bg-gray-900/80">
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium leading-snug">{UPSELL_COPY.signalTeaser}</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                      <Button variant="primary" size="sm" type="button" onClick={() => onSubscribe?.()}>{UPSELL_COPY.ctaSubscribe}</Button>
                      <Button variant="secondary" size="sm" type="button" onClick={() => onStartTrial?.(strategyId)}>{UPSELL_COPY.ctaTrialShort}</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ── 5) 성과 요약 + 최근 거래 ────── */}
          <Card>
            <Card.Header className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <Card.Title>이 전략 성과 스냅샷</Card.Title>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">지금 고른 시간봉으로 다시 계산한 추정치예요</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">누적 ROI {closedPerf.roi >= 0 ? '+' : ''}{closedPerf.roi}%</Badge>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('validation')}
                    className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    <BarChart2 size={11} />
                    검증 보기
                  </button>
                )}
              </div>
            </Card.Header>
            <Card.Content className="space-y-3 pb-3">
              <SignalPerfKpi trades={trades} closedPerf={closedPerf} lastTrade={lastTrade} />

              {/* 최근 5거래 */}
              {last5Trades.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-2">직전 체결 5건</p>
                  <div className="rounded-lg border border-slate-100 dark:border-gray-800 overflow-hidden">
                    {last5Trades.map((t, i) => (
                      <RecentTradeRow
                        key={`tr-${t.entry}-${t.exit}-${t.dir}-${t.pnl}-${t.win ? 'w' : 'l'}`}
                        trade={t}
                        isLast={i === last5Trades.length - 1}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* 면책 */}
          {!locked && (
            <p className="text-[10px] text-slate-500 dark:text-slate-600 leading-relaxed pb-6">
              이 화면은 투자 권유가 아니라, 전략이 어떻게 움직였는지 보여 주는 참고용 모의 결과입니다. 실제 매매 판단과 손익은 본인 책임이에요.
            </p>
          )}

        </main>
      </div>
    </PageShell>
  )
}

import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from 'react'
import PageShell      from '../components/ui/PageShell'
import PageHeader     from '../components/ui/PageHeader'
import Card           from '../components/ui/Card'
import Button         from '../components/ui/Button'
import Input          from '../components/ui/Input'
import Badge          from '../components/ui/Badge'
import SectionHeader  from '../components/ui/SectionHeader'
import StatCard       from '../components/ui/StatCard'
import { cn }         from '../lib/cn'
import { uploadMethodPdf } from '../lib/methodPdfStorage'
import { uploadStrategyPdf } from '../lib/strategyPdfStorage'
import {
  conditionsToEditorSelectedIds,
  formatConditionsSummary,
  DEFAULT_RISK_CONFIG,
  normalizeStrategyPayload,
  formatStrategyConditionsSummary,
} from '../lib/strategyPayload'
import { getCachedKlines } from '../lib/priceCache'
import {
  normalizePrices,
  generateSignalsFromPrices,
  calculateTradeHistory,
  calculatePerformance,
  calculateOpenPosition,
  buildStrategyConfigFromConditions,
  buildEngineConfigFromUserStrategy,
} from '../lib/strategyEngine'
import { runStrategy } from '../lib/runStrategy'
import {
  buildEngineConditionsFromEditor,
  DEFAULT_COND_PARAMS,
  extractParamMapFromConditions,
  engineConditionsToSaved,
} from '../lib/editorConditionBuilder'
import {
  canSaveNewStrategy,
  PLAN_MESSAGES,
  INITIAL_USER,
  MARKET_PIPELINE_MAX_STRATEGIES,
  hasPaidPlanFeatures,
  UPSELL_COPY,
} from '../lib/userPlan'
import {
  MIN_MARKET_TRADES,
  MIN_MARKET_PERIOD_DAYS,
  MAX_MARKET_MDD_BLOCK,
} from '../lib/strategySubmissionValidation'
import { REVIEW_STATUS } from '../lib/userStrategies'
import {
  parseStrategyCode,
  formatParseError,
  DEFAULT_STRATEGY_CODE_TEMPLATE,
  AI_PASTE_SAMPLE_CODE,
} from '../lib/strategyCodeParser'
import { buildCanonicalCodeFromPayload, tryParseBuilderCode } from '../lib/strategyCodeExport'
import StrategyCodeEditor from '../components/editor/StrategyCodeEditor'
import CandlestickChart from '../components/simulation/CandlestickChart'
import { ChartSkeleton } from '../components/ui/Skeleton'
import SectionErrorBoundary from '../components/ui/SectionErrorBoundary'
import { formatDisplayPct, formatDisplayMdd, formatDisplayWinRate } from '../lib/strategyDisplayMetrics'
import {
  ALT_BASKET_USDT_PAIRS,
  ALT_VALIDATION_MIN,
  ALT_VALIDATION_MAX,
  normalizeAltValidationSymbols,
  copy as assetUniverseCopy,
} from '../lib/assetValidationUniverse'
import { normalizeBinanceSymbol } from '../lib/marketCandles'
import { fetchBinanceUsdtSpotPairMetaCached } from '../lib/binanceUsdUniverse'

function isUuidLike(id) {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

/* ── 진입/청산 조건 그룹 ──────────────────── */
const ENTRY_CONDITIONS = [
  { id: 'ema_cross',      simpleLabel: '이동평균선 돌파 (느리게)', label: 'EMA 크로스 (20/50)',          category: '추세' },
  { id: 'ema_cross_fast', simpleLabel: '이동평균선 돌파 (빠르게)', label: 'EMA 크로스 (5/13)',           category: '추세' },
  { id: 'macd_cross',     simpleLabel: 'MACD 전환',             label: 'MACD 시그널 크로스',           category: '추세' },
  { id: 'rsi_ob_os',      simpleLabel: 'RSI 과열·침체 구간',     label: 'RSI 과매수/과매도 (70/30)',    category: '모멘텀' },
  { id: 'rsi_mid',        simpleLabel: 'RSI 중간선 돌파',       label: 'RSI 중심선 크로스 (50)',       category: '모멘텀' },
  { id: 'bb_squeeze',     simpleLabel: '좁아졌다가 터질 때',     label: '볼린저 밴드 수축 돌파',         category: '변동성' },
  { id: 'bb_touch',       simpleLabel: '밴드 끝에서 반등',     label: '볼린저 밴드 터치 반전',         category: '변동성' },
  { id: 'volume_surge',   simpleLabel: '거래량 폭발',          label: '거래량 급증 (2배+)',           category: '거래량' },
  { id: 'obv_div',        simpleLabel: '거래량 흐름 어긋남',    label: 'OBV 다이버전스',               category: '거래량' },
]

const STOP_CONDITIONS = [
  { id: 'fixed_pct',     simpleLabel: '목표 %만큼 반대로 가면 손절', label: '고정 비율 손절 (%)',    hint: '진입가 대비 X% 역방향 시 청산' },
  { id: 'trailing',      simpleLabel: '이익 줄었다면 청산 (트레일링)', label: '트레일링 스탑 (%)',     hint: '유리한 방향 최고/최저 대비 X% 되돌림 시' },
  { id: 'time_based',    simpleLabel: '일정 봉 지나면 청산',     label: '시간 기반 청산 (봉)',   hint: '진입 후 N봉 경과 시 청산' },
  { id: 'atr_stop',      simpleLabel: '변동폭(ATR) 기준 손절',   label: 'ATR 기반 손절 (배수)',  hint: 'ATR × 배수 이격 시 청산' },
]

const STOP_RULE_CONDITIONS = [
  { id: 'fixed_pct', label: '고정 %', hint: '진입가 대비 역방향 %' },
  { id: 'atr_stop', label: 'ATR 기반', hint: 'ATR × 배수' },
  { id: 'condition_expr', label: '조건식', hint: '직접 조건 입력' },
]

function newStopRule(type = 'fixed_pct') {
  return {
    id: `stop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    value: '',
    atrPeriod: '14',
    atrMult: '2',
    conditionExpr: '',
  }
}

function normalizeStopRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return [newStopRule('fixed_pct')]
  return rules.map((r, i) => ({
    id: String(r?.id ?? `stop_${i}`),
    type: String(r?.type ?? 'fixed_pct'),
    value: r?.value ?? '',
    atrPeriod: r?.atrPeriod ?? '14',
    atrMult: r?.atrMult ?? '2',
    conditionExpr: r?.conditionExpr ?? '',
  }))
}

const CONDITION_HINTS = {
  ema_cross: '빠른 EMA가 느린 EMA를 상향 돌파하면 롱, 하향 이탈하면 숏 신호.',
  ema_cross_fast: '단기·중기 EMA 크로스로 민감한 추세 전환을 잡습니다.',
  macd_cross: 'MACD 라인이 시그널을 상향/하향 돌파할 때 진입.',
  rsi_ob_os: 'RSI가 과매도 구간에서 위로, 과매수 구간에서 아래로 돌아설 때.',
  rsi_mid: 'RSI가 중심선을 상향/하향 돌파할 때.',
  bb_squeeze: '밴드 폭이 좁은 뒤 상·하단을 종가가 돌파하면 돌파 방향 진입.',
  bb_touch: '가격이 밴드 하단/상단에 터치한 뒤 반전할 때.',
  volume_surge: '거래량이 이동평균 대비 배수 이상일 때 방향성 진입.',
  obv_div: '가격과 OBV의 다이버전스(약한 프록시)로 반전을 탐지.',
}

const STRATEGY_TEMPLATES = {
  trend: {
    label: '추세 추종',
    selected: ['ema_cross', 'rsi_mid'],
    condParams: {
      ema_cross: { fastPeriod: 20, slowPeriod: 50 },
      rsi_mid: { period: 14, mid: 50 },
    },
  },
  counter: {
    label: '역추세',
    selected: ['rsi_ob_os', 'bb_touch'],
    condParams: {
      rsi_ob_os: { period: 14, oversold: 30, overbought: 70 },
      bb_touch: { period: 20, mult: 2 },
    },
  },
  volatility: {
    label: '변동성 돌파',
    selected: ['bb_squeeze', 'volume_surge'],
    condParams: {
      bb_squeeze: { period: 20, mult: 2, widthThreshold: 0.06 },
      volume_surge: { volumePeriod: 20, multiplier: 2 },
    },
  },
}

const CATEGORIES = ['추세', '모멘텀', '변동성', '거래량']

const TIMEFRAME_LABEL = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
}

const PREVIEW_PERIOD_OPTIONS = [
  { id: '1w', label: '1주' },
  { id: '1m', label: '1개월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: '1y', label: '1년' },
  { id: '3y', label: '3년' },
]

const DATA_INTERVAL_OPTIONS = [
  { id: '1m', label: '1분' },
  { id: '5m', label: '5분' },
  { id: '15m', label: '15분' },
  { id: '1h', label: '1시간' },
  { id: '4h', label: '4시간' },
  { id: '1d', label: '1일' },
]

const PERIOD_DAYS = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '3y': 1095,
}

function barsPerDayForInterval(iv) {
  const m = { '1m': 1440, '5m': 288, '15m': 96, '1h': 24, '4h': 6, '1d': 1 }
  return m[iv] ?? 24
}

/** 기간·봉 간격 → Binance klines limit (최대 1000) */
function computeKlineLimit(periodKey, interval) {
  const days = PERIOD_DAYS[periodKey] ?? 90
  const bpd = barsPerDayForInterval(interval)
  return Math.min(1000, Math.max(40, Math.ceil(days * bpd)))
}

const PREVIEW_DEBOUNCE_MS = 450
/** 코드 DSL → 엔진 실시간 실행 debounce (300~500ms 권장) */
const CODE_RUN_DEBOUNCE_MS = 300

/** 에디터 자산 → Binance klines 베이스 심볼 (ALT는 검증 목록 1종으로 미리보기) */
function klineBaseFromEditorAsset(raw, altList) {
  const a = String(raw || '').trim().toUpperCase()
  if (a === 'ALT') {
    const first = normalizeAltValidationSymbols(altList ?? [])[0]
    return (first || ALT_BASKET_USDT_PAIRS[0]).replace(/USDT$/i, '')
  }
  return a || 'BTC'
}

function EditorAltValidationSection({
  altSymDraft,
  setAltSymDraft,
  altValidationSymbols,
  setAltValidationSymbols,
  pairOptions = [],
  className = '',
}) {
  const list = normalizeAltValidationSymbols(altValidationSymbols)
  const addFromDraft = () => {
    const sym = normalizeBinanceSymbol(altSymDraft)
    if (!sym) return
    setAltValidationSymbols((prev) => normalizeAltValidationSymbols([...prev, sym]))
    setAltSymDraft('')
  }
  const q = String(altSymDraft || '').trim().toUpperCase()
  const have = new Set(list)
  let binancePick = Array.isArray(pairOptions) ? pairOptions : []
  if (q) {
    binancePick = binancePick.filter(
      (p) => p && typeof p.symbol === 'string'
        && (p.symbol.includes(q) || String(p.baseAsset || '').toUpperCase().includes(q)),
    )
  }
  binancePick = binancePick.filter((p) => p.symbol && !have.has(p.symbol)).slice(0, 60)
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
          검증용 코인 (Binance USDT · {ALT_VALIDATION_MIN}~{ALT_VALIDATION_MAX}개)
        </span>
        <span className="text-[10px] tabular-nums text-slate-500">{list.length}/{ALT_VALIDATION_MAX}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {list.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => setAltValidationSymbols((prev) => normalizeAltValidationSymbols(
              prev.filter((p) => normalizeBinanceSymbol(p) !== sym),
            ))}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-800 text-[10px] font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            {sym}
            <span className="text-slate-400" aria-hidden>×</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap items-center mt-2">
        <Input
          placeholder="예: ARBUSDT"
          value={altSymDraft}
          onChange={(e) => setAltSymDraft(e.target.value.toUpperCase())}
          className="h-8 text-[11px] flex-1 min-w-[120px]"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFromDraft() } }}
        />
        <Button type="button" variant="secondary" size="sm" className="h-8 text-[11px]" onClick={addFromDraft}>
          추가
        </Button>
      </div>
      <p className="text-[9px] text-slate-500 mt-1.5">Binance USDT 상장(거래 중) 목록 — 입력으로 검색 후 탭하여 추가</p>
      <div className="max-h-[10.5rem] overflow-y-auto mt-1 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 divide-y divide-slate-100 dark:divide-gray-800">
        {binancePick.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-slate-500 text-center">목록을 불러오는 중이거나 검색 결과가 없습니다.</p>
        ) : (
          binancePick.map((p) => (
            <button
              key={p.symbol}
              type="button"
              disabled={list.length >= ALT_VALIDATION_MAX}
              onClick={() => setAltValidationSymbols((prev) => normalizeAltValidationSymbols([...prev, p.symbol]))}
              className="w-full text-left px-2 py-1.5 text-[10px] font-mono hover:bg-slate-50 dark:hover:bg-gray-800/80 disabled:opacity-40"
            >
              {p.symbol}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function intervalFromEditorTimeframe(tf) {
  const t = String(tf || '').trim().toLowerCase()
  if (['1m', '5m', '15m', '1h', '4h', '1d'].includes(t)) return t
  return '1h'
}

function editorCodePayloadShape(risk_config) {
  return {
    name: '새 전략',
    description: '',
    tags: [],
    asset: 'BTC',
    timeframe: '1h',
    mode: 'nocode',
    riskLevel: 'mid',
    conditions: [],
    code: '',
    risk_config: { ...DEFAULT_RISK_CONFIG, ...risk_config },
  }
}

const STARTER_STRATEGY_JSON = JSON.stringify(
  editorCodePayloadShape({}),
  null,
  2,
)

/** @returns {{ ok: true, value: unknown } | { ok: false, message: string, pos?: number }} */
function tryParseStrategyJson(text) {
  const s = String(text ?? '').trim()
  if (!s) {
    return { ok: false, message: '코드 형식이 올바르지 않습니다', pos: 0 }
  }
  try {
    return { ok: true, value: JSON.parse(s) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const m = /position\s+(\d+)/i.exec(msg)
    const pos = m ? Number(m[1]) : undefined
    return { ok: false, message: '코드 형식이 올바르지 않습니다', detail: msg, pos }
  }
}

function formatEditorRiskSummary(risk) {
  if (!risk || typeof risk !== 'object') return '—'
  const parts = []
  const stopRules = Array.isArray(risk.stopRules) ? risk.stopRules : []
  if (stopRules.length > 0) {
    const ruleText = stopRules.map((r) => {
      const t = String(r?.type ?? '')
      if (t === 'fixed_pct') return `고정 ${r?.value ?? '—'}%`
      if (t === 'atr_stop') return `ATR ${r?.atrPeriod ?? 14}×${r?.atrMult ?? 2}`
      if (t === 'condition_expr') return `조건식 ${String(r?.conditionExpr ?? '').trim() || '미입력'}`
      return '기타'
    })
    parts.push(`손절 ${ruleText.join(' + ')}`)
  }
  const st = risk.stopType || 'fixed_pct'
  if (stopRules.length === 0 && st === 'fixed_pct' && risk.stopValue !== '' && risk.stopValue != null) {
    parts.push(`손절 ${risk.stopValue}%`)
  }
  if (stopRules.length === 0 && st === 'trailing' && (risk.trailingStopPct || risk.stopValue)) {
    parts.push(`트레일 ${risk.trailingStopPct || risk.stopValue}%`)
  }
  if (stopRules.length === 0 && st === 'time_based' && risk.timeExitBars !== '' && risk.timeExitBars != null) {
    parts.push(`${risk.timeExitBars}봉 후 청산`)
  }
  if (stopRules.length === 0 && st === 'atr_stop') {
    parts.push(`ATR ${risk.atrPeriod || 14}×${risk.atrMult || 2}`)
  }
  if (risk.takeProfitPct !== '' && risk.takeProfitPct != null) {
    parts.push(`익절 ${risk.takeProfitPct}%`)
  }
  if (risk.posSize !== '' && risk.posSize != null) {
    parts.push(`포지션 ${risk.posSize}%`)
  }
  if (risk.maxLossPct !== '' && risk.maxLossPct != null) {
    parts.push(`최대손실한도 ${risk.maxLossPct}%`)
  }
  return parts.length ? parts.join(' / ') : '리스크 수치 미입력'
}

function EquitySparkline({ trades, className }) {
  const pts = useMemo(() => {
    let eq = 100
    const out = [{ y: 100 }]
    for (let i = 0; i < trades.length; i++) {
      eq *= 1 + Number(trades[i].pnl) / 100
      out.push({ y: eq })
    }
    return out
  }, [trades])
  if (pts.length < 2) {
    return <p className={cn('text-[10px] text-slate-400', className)}>거래 1건 이상일 때 표시</p>
  }
  const ys = pts.map((p) => p.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const W = 220
  const H = 44
  const d = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W
    const t = maxY === minY ? 0.5 : (p.y - minY) / (maxY - minY)
    const y = H - 2 - t * (H - 4)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('w-full max-w-[220px] text-blue-600 dark:text-blue-500', className)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function CondParamRow({ id, values, onChange, onReset }) {
  const v = { ...(DEFAULT_COND_PARAMS[id] ?? {}), ...(values ?? {}) }
  const condMeta = ENTRY_CONDITIONS.find((x) => x.id === id)
  const label = condMeta?.simpleLabel ?? condMeta?.label ?? id
  const hint = CONDITION_HINTS[id]

  const FIELD = {
    ema_cross: [
      { key: 'fastPeriod', label: '빠른 EMA', ph: '예: 20', cols: 1 },
      { key: 'slowPeriod', label: '느린 EMA', ph: '예: 50', cols: 1 },
    ],
    ema_cross_fast: [
      { key: 'fastPeriod', label: '빠른 EMA', ph: '예: 5', cols: 1 },
      { key: 'slowPeriod', label: '느린 EMA', ph: '예: 13', cols: 1 },
    ],
    rsi_ob_os: [
      { key: 'period', label: 'RSI 기간', ph: '14', cols: 1 },
      { key: 'oversold', label: '과매도', ph: '30', cols: 1 },
      { key: 'overbought', label: '과매수', ph: '70', cols: 1 },
    ],
    rsi_mid: [
      { key: 'period', label: 'RSI 기간', ph: '14', cols: 1 },
      { key: 'mid', label: '중심선', ph: '50', cols: 1 },
    ],
    macd_cross: [
      { key: 'fastPeriod', label: 'Fast', ph: '12', cols: 1 },
      { key: 'slowPeriod', label: 'Slow', ph: '26', cols: 1 },
      { key: 'signalPeriod', label: 'Signal', ph: '9', cols: 1 },
    ],
    bb_touch: [
      { key: 'period', label: '기간', ph: '20', cols: 1 },
      { key: 'mult', label: '표준편차 배수', ph: '2', cols: 1 },
    ],
    bb_squeeze: [
      { key: 'period', label: '기간', ph: '20', cols: 1 },
      { key: 'mult', label: '표준편차 배수', ph: '2', cols: 1 },
      { key: 'widthThreshold', label: '수축 폭 임계', ph: '0.06', cols: 1 },
    ],
    volume_surge: [
      { key: 'volumePeriod', label: '거래량 SMA 기간', ph: '20', cols: 1 },
      { key: 'multiplier', label: '배수 threshold', ph: '2', cols: 1 },
    ],
    obv_div: [],
  }[id] ?? []

  const cols = Math.min(3, Math.max(1, FIELD.length || 1))
  const num = (key, ph) => (
    <Input
      type="number"
      className="h-8 text-[12px]"
      placeholder={ph}
      value={v[key] ?? ''}
      onChange={(e) => onChange({ [key]: e.target.value === '' ? '' : Number(e.target.value) })}
    />
  )

  return (
    <div className="rounded-lg border border-slate-100 dark:border-gray-800 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            기본값 복원
          </button>
        )}
      </div>
      {FIELD.length > 0 ? (
        <div className={cn('grid gap-2', cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {FIELD.map((f) => (
            <div key={f.key}>
              <span className="text-[10px] text-slate-400 block mb-0.5">{f.label}</span>
              {num(f.key, f.ph)}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-slate-500">추가 수치 입력 없음</p>
      )}
      {hint && <p className="text-[10px] text-slate-400 leading-relaxed">{hint}</p>}
    </div>
  )
}

export default function EditorPage({
  onSaveStrategy,
  onNavigate,
  onRunStrategy,
  initialData,
  /** 마켓/홈「전략 복사하기」진입 시 코드·메타 (App state, 에디터 이탈 시 초기화) */
  marketCopyPrefill = null,
  editingStrategyId,
  currentUser,
  userStrategies = [],
  saveLoading = false,
  saveErrorMessage = '',
  user = INITIAL_USER,
  savedStrategyCount = 0,
  canSubmitToMarket = false,
  marketPipelineCount = 0,
  maxMarketSlots = 0,
  editingStrategyStatus = null,
  editingReviewNote = '',
  userPlanKind = 'free',
  onSubscribe,
  onStartTrial,
}) {
  /* ── 기본 폼 상태 ───────────────────── */
  const [editorLevel, setEditorLevel] = useState('beginner') // beginner_mode | advanced_mode
  /** UI: 초보용 생성기 vs DSL 코드 편집 */
  const [editorMode, setEditorMode] = useState(() => 'builder') // 'builder' | 'code'
  const [strategyCode, setStrategyCode] = useState(() => DEFAULT_STRATEGY_CODE_TEMPLATE)
  const [strategyKind,   setStrategyKind]   = useState('signal') // 'signal' | 'method'
  const [mode,          setMode]          = useState('nocode')
  const [name,          setName]          = useState('')
  const [tags,          setTags]          = useState('')
  const [asset,         setAsset]         = useState('')
  const [altValidationSymbols, setAltValidationSymbols] = useState([])
  const [altSymDraft, setAltSymDraft] = useState('')
  const [binancePairMetaEditor, setBinancePairMetaEditor] = useState([])
  const [timeframe,     setTimeframe]     = useState('1h')
  const [riskLevel,     setRiskLevel]     = useState('mid')
  const [description,  setDescription]  = useState('')
  const [strategySummary, setStrategySummary] = useState('')
  const [entryLogic, setEntryLogic] = useState('')
  const [exitLogic, setExitLogic] = useState('')
  const [marketType, setMarketType] = useState('BTC')
  const [marketCondition, setMarketCondition] = useState('')
  const [riskDescription, setRiskDescription] = useState('')
  const [selected,      setSelected]      = useState([])   // 진입 조건 preset ID[]
  const [code,          setCode]          = useState(STARTER_STRATEGY_JSON)

  const [methodPdfPath, setMethodPdfPath] = useState('')
  const [methodPreviewPdfPath, setMethodPreviewPdfPath] = useState('')
  const [linkedSignalStrategyId, setLinkedSignalStrategyId] = useState('')
  const [pdfUploading, setPdfUploading] = useState(false)

  const [strategyPdfPath, setStrategyPdfPath] = useState('')
  const [strategyPreviewPdfPath, setStrategyPreviewPdfPath] = useState('')
  const [strategyPdfError, setStrategyPdfError] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [strategyPdfUrl, setStrategyPdfUrl] = useState('')

  const stratPdfInputRef = useRef(null)

  async function handleStrategyPdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfFile(file)
    if (!currentUser?.id) {
      setStrategyPdfError('로그인 후 서버 업로드가 가능합니다. 파일은 선택됨 상태로 유지됩니다.')
      return
    }
    setStrategyPdfError('')
    setPdfUploading(true)
    try {
      const { path, publicUrl } = await uploadStrategyPdf(file, { userId: currentUser.id, kind: 'full' })
      setStrategyPdfPath(path)
      setStrategyPreviewPdfPath(path)
      setStrategyPdfUrl(publicUrl ?? '')
    } catch (err) {
      setStrategyPdfError(String(err?.message ?? 'PDF 업로드 실패'))
    } finally {
      setPdfUploading(false)
      if (stratPdfInputRef.current) stratPdfInputRef.current.value = ''
    }
  }

  /* ── 리스크 설정 상태 ───────────────── */
  const [stopType,      setStopType]      = useState('fixed_pct')
  const [stopValue,     setStopValue]     = useState('')
  const [stopRules, setStopRules] = useState(() => [newStopRule('fixed_pct')])
  const [takeProfitPct, setTakeProfitPct] = useState('')
  const [posSize,       setPosSize]       = useState('')
  const [maxOpenPos,    setMaxOpenPos]    = useState('1')
  const [minSignalGap,  setMinSignalGap]  = useState('')
  const [allowReentry,  setAllowReentry]  = useState(false)
  const [trailingStopPct, setTrailingStopPct] = useState('')
  const [timeExitBars, setTimeExitBars] = useState('')
  const [atrPeriod, setAtrPeriod] = useState('14')
  const [atrMult, setAtrMult] = useState('2')
  const [maxLossPct, setMaxLossPct] = useState('')

  /* ── 저장 피드백 ──────────────────── */
  const [saveStatus,   setSaveStatus]   = useState(null)   // null | 'draft' | 'submitted' | 'error'
  const [saveError,    setSaveError]    = useState('')
  const [currentId,    setCurrentId]    = useState(null)   // 현재 편집 중인 전략 ID

  const [previewPhase, setPreviewPhase] = useState('idle')
  const [previewError, setPreviewError] = useState('')
  /** 캔들은 fetch 성공 시에만 설정; 로딩 중에는 null */
  const [previewCandles, setPreviewCandles] = useState(null)
  const [previewAltNote, setPreviewAltNote] = useState('')
  /** preset별 사용자 수치 (EMA 기간, RSI 구간 등) */
  const [condParams, setCondParams] = useState(() => ({}))
  const [backtestResult, setBacktestResult] = useState(null)
  const [backtestOpen, setBacktestOpen] = useState(false)
  const [previewCalcPending, setPreviewCalcPending] = useState(false)
  /** 미리보기·백테스트 공통: 조회 기간(상대) */
  const [previewPeriodKey, setPreviewPeriodKey] = useState('3m')
  /** 코드 모드에서 「코드 적용」 후 엔진에 넣을 정규화 payload */
  const [codePreviewPayload, setCodePreviewPayload] = useState(null)
  const [editorRenderError, setEditorRenderError] = useState('')
  const [backtestRunning, setBacktestRunning] = useState(false)

  /* ── UX: 테스트 결과 패널 바인딩 ───────────────── */
  const [testRunning, setTestRunning] = useState(false)
  const [testError, setTestError] = useState('')
  const [testResult, setTestResult] = useState(null) // { performance, trades, signals, openPos, meta }
  const [uiErrors, setUiErrors] = useState(() => ({})) // section-level errors for inline display
  const [codeAutoRunning, setCodeAutoRunning] = useState(false)
  const [codeAutoError, setCodeAutoError] = useState('')
  const [codeAutoErrorLine, setCodeAutoErrorLine] = useState(null)
  const riskConfigMemo = useMemo(
    () => ({
      stopType: String(stopRules?.[0]?.type ?? stopType ?? 'fixed_pct'),
      stopValue: stopRules?.[0]?.type === 'fixed_pct' ? (stopRules?.[0]?.value ?? stopValue) : stopValue,
      takeProfitPct,
      trailingStopPct: stopRules?.[0]?.type === 'trailing' ? (stopRules?.[0]?.value ?? trailingStopPct) : trailingStopPct,
      posSize,
      maxOpenPos,
      minSignalGap,
      allowReentry,
      timeExitBars: stopRules?.[0]?.type === 'time_based' ? (stopRules?.[0]?.value ?? timeExitBars) : timeExitBars,
      atrPeriod: stopRules?.[0]?.type === 'atr_stop' ? (stopRules?.[0]?.atrPeriod ?? atrPeriod) : atrPeriod,
      atrMult: stopRules?.[0]?.type === 'atr_stop' ? (stopRules?.[0]?.atrMult ?? atrMult) : atrMult,
      maxLossPct,
      stopRules: normalizeStopRules(stopRules),
    }),
    [
      stopType, stopValue, takeProfitPct, trailingStopPct, posSize, maxOpenPos,
      minSignalGap, allowReentry, timeExitBars, atrPeriod, atrMult, maxLossPct, stopRules,
    ],
  )

  const deferredCondParams = useDeferredValue(condParams)
  const deferredRiskConfig = useDeferredValue(riskConfigMemo)

  const editingExisting = useMemo(
    () => isUuidLike(editingStrategyId) || isUuidLike(currentId),
    [editingStrategyId, currentId],
  )

  const saveLimitReached = useMemo(
    () => !canSaveNewStrategy(user, savedStrategyCount, editingExisting),
    [user, savedStrategyCount, editingExisting],
  )

  const goMypageSubscription = useCallback(() => {
    onNavigate?.('mypage')
    try {
      sessionStorage.setItem('bb_mypage_section', 'subscription')
    } catch { /* ignore */ }
  }, [onNavigate])

  useEffect(() => {
    if (String(asset || '').toUpperCase() !== 'ALT') return
    setAltValidationSymbols((prev) => {
      const n = normalizeAltValidationSymbols(prev)
      if (n.length >= ALT_VALIDATION_MIN) return n
      return normalizeAltValidationSymbols([...ALT_BASKET_USDT_PAIRS])
    })
  }, [asset])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await fetchBinanceUsdtSpotPairMetaCached()
        if (!cancelled && Array.isArray(m)) setBinancePairMetaEditor(m)
      } catch {
        if (!cancelled) setBinancePairMetaEditor([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const [beginnerTemplateKey, setBeginnerTemplateKey] = useState('trend')

  async function beginnerCreateAndRun() {
    setSaveError('')
    const tpl = STRATEGY_TEMPLATES[beginnerTemplateKey] ?? STRATEGY_TEMPLATES.trend
    const chosenAsset = asset || 'BTC'
    const chosenTf = timeframe || '1h'
    const chosenRisk = riskLevel || 'mid'
    const displayName = name?.trim() ? name.trim() : `빠른 전략 · ${tpl.label}`
    const quick = {
      type: 'signal',
      mode: 'nocode',
      name: displayName,
      description: description?.trim() ?? '',
      strategy_summary: strategySummary?.trim() ?? '',
      entry_logic: entryLogic?.trim() ?? '',
      exit_logic: exitLogic?.trim() ?? '',
      market_condition: marketCondition?.trim() ?? '',
      risk_description: riskDescription?.trim() ?? '',
      asset: chosenAsset,
      timeframe: chosenTf,
      riskLevel: chosenRisk,
      conditions: engineConditionsToSaved(buildEngineConditionsFromEditor(tpl.selected, tpl.condParams ?? {})),
      risk_config: { ...DEFAULT_RISK_CONFIG },
      tags: [],
      ...(String(chosenAsset).toUpperCase() === 'ALT'
        ? { altValidationSymbols: normalizeAltValidationSymbols([...ALT_BASKET_USDT_PAIRS]) }
        : {}),
    }
    let saved = null
    try {
      saved = await onSaveStrategy?.(quick, 'draft')
    } catch {
      saved = null
    }
    if (!saved?.id) {
      setSaveError('전략 생성에 실패했습니다. 로그인 상태와 입력값을 확인해 주세요.')
      return
    }
    try {
      onRunStrategy?.(saved.id)
    } catch {
      onNavigate?.('signal')
    }
  }

  const conditionsForSummary = useMemo(
    () => engineConditionsToSaved(buildEngineConditionsFromEditor(selected, condParams)),
    [selected, condParams],
  )

  const klineLimit = useMemo(
    () => computeKlineLimit(previewPeriodKey, intervalFromEditorTimeframe(timeframe)),
    [previewPeriodKey, timeframe],
  )

  // NOTE: EditorPage 같은 대형 파일에서는 TDZ(temporal dead zone) 방지를 위해
  // hydrate 헬퍼를 function 선언문으로 고정한다.
  function hydrateFromNormalizedPayload(payload, opts = {}) {
    const n = normalizeStrategyPayload(payload ?? {})
    const rc = n.risk_config && typeof n.risk_config === 'object'
      ? { ...DEFAULT_RISK_CONFIG, ...n.risk_config }
      : { ...DEFAULT_RISK_CONFIG }

    const rawCode = typeof n.code === 'string' ? n.code.trim() : ''
    const builderFromCode = tryParseBuilderCode(rawCode)
    const isBuilderCode = !!builderFromCode && String(n.type ?? 'signal') !== 'method'

    let effectiveN = n
    if (isBuilderCode) {
      effectiveN = normalizeStrategyPayload({
        ...n,
        asset: builderFromCode.asset ?? n.asset,
        timeframe: builderFromCode.timeframe ?? n.timeframe,
        riskLevel: builderFromCode.riskLevel ?? n.riskLevel,
        tags: Array.isArray(builderFromCode.tags) ? builderFromCode.tags : n.tags,
        conditions: builderFromCode.conditions ?? n.conditions,
        conditionLogic: builderFromCode.conditionLogic ?? n.conditionLogic,
        risk_config: {
          ...DEFAULT_RISK_CONFIG,
          ...(builderFromCode.risk_config && typeof builderFromCode.risk_config === 'object' ? builderFromCode.risk_config : {}),
          ...rc,
        },
        entryExitSplit: !!builderFromCode.entryExitSplit,
        entryConditions: builderFromCode.entryConditions ?? [],
        exitConditions: builderFromCode.exitConditions ?? [],
        altValidationSymbols: builderFromCode.altValidationSymbols ?? n.altValidationSymbols,
      })
    }

    const rcEff = effectiveN.risk_config && typeof effectiveN.risk_config === 'object'
      ? { ...DEFAULT_RISK_CONFIG, ...effectiveN.risk_config }
      : { ...DEFAULT_RISK_CONFIG }

    const legacyBuilderCode =
      !isBuilderCode && String(n.mode) === 'nocode' && !rawCode && Array.isArray(n.conditions) && n.conditions.length > 0
        ? buildCanonicalCodeFromPayload({ ...n, mode: 'nocode' })
        : ''

    setStrategyKind(String(n.type ?? 'signal') === 'method' ? 'method' : 'signal')
    setName(String(effectiveN.name ?? ''))
    setDescription(String(effectiveN.description ?? effectiveN.desc ?? ''))
    setStrategySummary(String(n.strategy_summary ?? ''))
    setEntryLogic(String(n.entry_logic ?? ''))
    setExitLogic(String(n.exit_logic ?? ''))
    setMarketCondition(String(n.market_condition ?? ''))
    setRiskDescription(String(n.risk_description ?? ''))
    setTags(Array.isArray(effectiveN.tags) ? effectiveN.tags.join(', ') : String(effectiveN.tags ?? ''))
    setAsset(String(effectiveN.asset ?? ''))
    setAltValidationSymbols(normalizeAltValidationSymbols(effectiveN.altValidationSymbols ?? []))
    setTimeframe(String(effectiveN.timeframe ?? '1h') || '1h')
    setRiskLevel(String(effectiveN.riskLevel ?? 'mid') || 'mid')
    setSelected(conditionsToEditorSelectedIds(effectiveN.conditions ?? []))
    setCondParams(extractParamMapFromConditions(effectiveN.conditions ?? []))

    setStopType(rcEff.stopType ?? 'fixed_pct')
    setStopValue(rcEff.stopValue ?? '')
    setStopRules(normalizeStopRules(rcEff.stopRules))
    setTakeProfitPct(rcEff.takeProfitPct ?? '')
    setPosSize(rcEff.posSize ?? '')
    setMaxOpenPos(rcEff.maxOpenPos ?? '1')
    setMinSignalGap(rcEff.minSignalGap ?? '')
    setAllowReentry(!!rcEff.allowReentry)
    setTrailingStopPct(rcEff.trailingStopPct ?? '')
    setTimeExitBars(rcEff.timeExitBars ?? '')
    setAtrPeriod(rcEff.atrPeriod ?? '14')
    setAtrMult(rcEff.atrMult ?? '2')
    setMaxLossPct(rcEff.maxLossPct ?? '')

    setCurrentId(n.id ?? null)
    setMethodPdfPath(String(n.method_pdf_path ?? ''))
    setMethodPreviewPdfPath(String(n.method_pdf_preview_path ?? ''))
    setLinkedSignalStrategyId(String(n.linked_signal_strategy_id ?? ''))
    setStrategyPdfPath(String(n.strategy_pdf_path ?? ''))
    setStrategyPreviewPdfPath(String(n.strategy_pdf_preview_path ?? ''))

    if (n.mode) setMode(n.mode)

    // SSOT: code에 빌더 JSON → UI는 빌더, 편집 내용은 code에서 복원
    if (isBuilderCode && opts.updateCode !== false) {
      setEditorMode('builder')
      setMode('nocode')
      setCodePreviewPayload(null)
      setStrategyCode(rawCode)
      setCode(JSON.stringify({
        name: effectiveN.name,
        description: effectiveN.description,
        tags: effectiveN.tags,
        asset: effectiveN.asset,
        timeframe: effectiveN.timeframe,
        mode: 'nocode',
        riskLevel: effectiveN.riskLevel,
        conditions: effectiveN.conditions ?? [],
        code: rawCode,
        risk_config: rcEff,
        altValidationSymbols: normalizeAltValidationSymbols(effectiveN.altValidationSymbols ?? []),
      }, null, 2))
      return
    }

    // 코드 모드: DSL 또는 전략 JSON (빌더 JSON 아님)
    if (String(n.mode ?? '') === 'code') {
      const canonical = normalizeStrategyPayload({ ...n, mode: 'code', risk_config: rcEff })
      setCodePreviewPayload(canonical)
      if (opts.updateCode !== false) {
        setEditorMode('code')
        const raw = typeof n.code === 'string' ? n.code : ''
        if (raw.trim() && !raw.trim().startsWith('{')) {
          setStrategyCode(raw)
        } else {
          setStrategyCode(JSON.stringify(canonical, null, 2))
        }
        setCode(JSON.stringify(canonical, null, 2))
      }
    } else {
      setEditorMode('builder')
      setCodePreviewPayload(null)
      if (legacyBuilderCode && opts.updateCode !== false) {
        setStrategyCode(legacyBuilderCode)
      }
      if (opts.updateCode === true) {
        setCode(JSON.stringify({
          name: effectiveN.name,
          description: effectiveN.description,
          tags: effectiveN.tags,
          asset: effectiveN.asset,
          timeframe: effectiveN.timeframe,
          mode: n.mode ?? 'nocode',
          riskLevel: effectiveN.riskLevel,
          conditions: effectiveN.conditions ?? [],
          code: legacyBuilderCode || rawCode || '',
          risk_config: rcEff,
          altValidationSymbols: normalizeAltValidationSymbols(effectiveN.altValidationSymbols ?? []),
        }, null, 2))
      }
    }
  }

  /* 반려된 전략 불러오기 */
  useEffect(() => {
    if (!initialData) return
    try {
      hydrateFromNormalizedPayload(initialData, { updateCode: true })
    } catch (e) {
      setEditorRenderError(e?.message ? String(e.message) : '에디터 초기화 실패')
    }
    setEditorLevel('advanced')
    setSaveStatus(null)
    setSaveError('')
  }, [initialData])

  useEffect(() => {
    if (!marketCopyPrefill?.code) return
    try {
      setEditorRenderError('')
      setStrategyCode(String(marketCopyPrefill.code))
      setEditorMode('code')
      setMode('code')
      setStrategyKind('signal')
      setEditorLevel('advanced')
      const nh = String(marketCopyPrefill.nameHint ?? '').trim()
      if (nh) setName(`[복사] ${nh}`)
      const a = String(marketCopyPrefill.asset ?? '').trim()
      if (a) setAsset(a)
      const tf = String(marketCopyPrefill.timeframe ?? '').trim()
      if (tf) setTimeframe(tf)
      setSaveStatus(null)
      setSaveError('')
    } catch (e) {
      setEditorRenderError(e?.message ? String(e.message) : '에디터 초기화 실패')
    }
  }, [marketCopyPrefill])

  useEffect(() => {
    if (saveErrorMessage) setSaveError(saveErrorMessage)
  }, [saveErrorMessage])

  const selectedKey = useMemo(
    () => `${[...selected].sort().join(',')}|${asset}|${timeframe}|${previewPeriodKey}|${normalizeAltValidationSymbols(altValidationSymbols).join(',')}`,
    [selected, asset, timeframe, previewPeriodKey, altValidationSymbols],
  )

  const strategyCodeParseResult = useMemo(() => parseStrategyCode(strategyCode), [strategyCode])

  /** 코드 탭: DSL 또는 `{` 로 시작하는 JSON 전략 */
  const dslOrJsonPayload = useMemo(() => {
    if (editorMode !== 'code' || strategyKind === 'method') return null
    const t = String(strategyCode ?? '').trim()
    if (!t) return null
    if (strategyCodeParseResult.ok) {
      return normalizeStrategyPayload({
        ...strategyCodeParseResult.payload,
        name: (name || '').trim() || '새 전략',
        description: (description || '').trim(),
        asset: asset || 'BTC',
        timeframe: timeframe || '1h',
        mode: 'code',
        code: strategyCode,
        altValidationSymbols: String(asset || '').toUpperCase() === 'ALT'
          ? normalizeAltValidationSymbols(altValidationSymbols)
          : [],
      })
    }
    if (t.startsWith('{')) {
      const p = tryParseStrategyJson(strategyCode)
      if (!p.ok) return null
      return normalizeStrategyPayload({
        ...p.value,
        mode: 'code',
        name: (name || '').trim() || '새 전략',
        description: (description || '').trim(),
        asset: asset || 'BTC',
        timeframe: timeframe || '1h',
        code: strategyCode,
        altValidationSymbols: String(asset || '').toUpperCase() === 'ALT'
          ? normalizeAltValidationSymbols(altValidationSymbols)
          : [],
      })
    }
    return null
  }, [
    editorMode,
    strategyKind,
    strategyCode,
    strategyCodeParseResult,
    name,
    description,
    asset,
    timeframe,
    altValidationSymbols,
  ])

  /** Monaco 머커(빨간 밑줄) — 파싱/엔진 오류 라인 */
  const monacoErrorMarker = useMemo(() => {
    if (strategyKind === 'method' || editorMode !== 'code') return null
    const raw = String(strategyCode ?? '')
    const trimmed = raw.trim()
    if (!trimmed) {
      return { line: 1, message: '전략 코드를 입력해 주세요.' }
    }
    if (trimmed.startsWith('{')) {
      const pj = tryParseStrategyJson(raw)
      if (!pj.ok) {
        return {
          line: 1,
          message: `${pj.message}${pj.pos != null ? ` (문자 위치 ${pj.pos})` : ''}`,
        }
      }
      return null
    }
    if (!strategyCodeParseResult.ok) {
      return {
        line: strategyCodeParseResult.error?.line ?? 1,
        message: formatParseError(strategyCodeParseResult),
      }
    }
    if (codeAutoError && dslOrJsonPayload) {
      return { line: 1, message: codeAutoError }
    }
    return null
  }, [
    strategyKind,
    editorMode,
    strategyCode,
    strategyCodeParseResult,
    codeAutoError,
    dslOrJsonPayload,
  ])

  useEffect(() => {
    if (editorMode === 'builder') setMode('nocode')
    if (editorMode === 'code') setMode('code')
  }, [editorMode])

  /* ── 프리뷰 파생값 (TDZ 방지: 항상 useEffect보다 먼저 선언) ───────────── */
  const previewStrategyConfig = useMemo(() => {
    if (!previewCandles?.length) return null
    if (editorMode === 'code' && dslOrJsonPayload) {
      return buildEngineConfigFromUserStrategy(dslOrJsonPayload, { candles: previewCandles })
    }
    if (mode === 'nocode') {
      const risk_config = { ...deferredRiskConfig }
      const conditions = buildEngineConditionsFromEditor(selected, deferredCondParams)
      return buildStrategyConfigFromConditions(conditions, risk_config, {
        mode,
        timeframe,
        asset: asset || 'BTC',
        candles: previewCandles,
        lookback: 5,
      })
    }
    return null
  }, [
    previewCandles,
    editorMode,
    dslOrJsonPayload,
    mode,
    deferredRiskConfig,
    selected,
    deferredCondParams,
    timeframe,
    asset,
  ])

  const previewPrices = useMemo(() => {
    if (!previewCandles?.length) return []
    return normalizePrices(previewCandles.map((c) => ({ time: c.time, price: c.close }))) ?? []
  }, [previewCandles])

  const previewSignals = useMemo(() => {
    if (!previewStrategyConfig || previewPrices.length === 0) return []
    return generateSignalsFromPrices(previewPrices, previewStrategyConfig)
  }, [previewPrices, previewStrategyConfig])

  const previewTrades = useMemo(
    () => calculateTradeHistory(previewSignals),
    [previewSignals],
  )

  const previewPerf = useMemo(
    () => calculatePerformance(previewTrades),
    [previewTrades],
  )

  const previewLastPrice = useMemo(
    () => (previewPrices.length ? previewPrices[previewPrices.length - 1].price : 0),
    [previewPrices],
  )

  const previewOpenPos = useMemo(
    () => calculateOpenPosition(previewSignals, previewLastPrice),
    [previewSignals, previewLastPrice],
  )

  const previewRecentSignals = useMemo(() => {
    if (!previewSignals.length) return []
    return [...previewSignals]
      .sort((a, b) => safeNum(b.time, 0) - safeNum(a.time, 0))
      .slice(0, 8)
  }, [previewSignals])

  const previewRecentShort = useMemo(
    () => previewRecentSignals.slice(0, 5),
    [previewRecentSignals],
  )

  /** 미리보기 차트: 시그널 시각 → 캔들 인덱스 (테스트 결과가 있으면 그 시그널 우선) */
  const previewChartIndices = useMemo(() => {
    const signals = (testResult?.signals?.length ? testResult.signals : previewSignals) ?? []
    if (!previewCandles?.length || !signals.length) {
      return { entryIdxs: [], exitIdxs: [] }
    }
    const times = previewCandles.map((c) => +c.time)
    const entryIdxs = []
    const exitIdxs = []
    for (const s of signals) {
      const ti = times.indexOf(s.time)
      if (ti < 0) continue
      if (s.type === 'ENTRY') entryIdxs.push(ti)
      else if (s.type === 'EXIT') exitIdxs.push(ti)
    }
    return { entryIdxs, exitIdxs }
  }, [previewCandles, previewSignals, testResult?.signals])

  const previewData = useMemo(() => {
    if (previewPhase !== 'ok' || !previewCandles?.length || !previewStrategyConfig) return null
    return {
      totalTrades: previewPerf.totalTrades,
      winRate: previewPerf.winRate,
      roi: previewPerf.roi,
      mdd: previewPerf.mdd,
      recentSignals: previewRecentShort,
      openPos: previewOpenPos,
      trades: previewTrades,
    }
  }, [previewPhase, previewCandles, previewPerf, previewRecentShort, previewOpenPos, previewTrades, previewStrategyConfig])

  /* ── 코드 에디터: 실시간 실행 + 에러 피드백 (debounce) ───────────── */
  useEffect(() => {
    if (strategyKind === 'method') return undefined
    if (editorMode !== 'code') return undefined

    const raw = String(strategyCode ?? '')
    const trimmed = raw.trim()
    if (!trimmed) {
      setCodeAutoError('전략 코드를 입력해 주세요.')
      setCodeAutoErrorLine(1)
      setCodeAutoRunning(false)
      setTestResult(null)
      return undefined
    }

    // 캔들/가격 준비 전에는 실행하지 않음
    if (previewPhase !== 'ok' || !previewCandles?.length || !previewPrices.length) {
      setCodeAutoRunning(false)
      return undefined
    }

    // 파싱 오류는 즉시 표시(라인 포함), 엔진 실행은 막음
    if (!dslOrJsonPayload) {
      const isJson = trimmed.startsWith('{')
      if (isJson) {
        const p = tryParseStrategyJson(raw)
        setCodeAutoError(p.ok ? 'JSON은 유효하지만 conditions가 비어 있을 수 있습니다.' : `${p.message}${p.pos != null ? ` (문자 위치 ${p.pos})` : ''}`)
        setCodeAutoErrorLine(null)
      } else {
        setCodeAutoError(formatParseError(strategyCodeParseResult))
        setCodeAutoErrorLine(strategyCodeParseResult?.error?.line ?? null)
      }
      setCodeAutoRunning(false)
      setTestResult(null)
      return undefined
    }

    // debounce 실행
    setCodeAutoRunning(true)
    const t = window.setTimeout(() => {
      try {
        setCodeAutoError('')
        setCodeAutoErrorLine(null)

        const cfg = buildEngineConfigFromUserStrategy(dslOrJsonPayload, { candles: previewCandles })
        const pipe = runStrategy(previewCandles ?? [], null, { strategyConfig: cfg })

        setTestResult({
          performance: pipe.performance,
          trades: pipe.trades ?? [],
          signals: pipe.signals ?? [],
          openPos: calculateOpenPosition(pipe.signals ?? [], previewLastPrice),
          meta: {
            asset: asset || 'BTC',
            timeframe,
            periodKey: previewPeriodKey,
            klineLimit,
            ranAt: Date.now(),
            auto: true,
          },
        })
      } catch (e) {
        setTestResult(null)
        setCodeAutoError(e?.message ?? '실시간 실행 실패')
        setCodeAutoErrorLine(null)
      } finally {
        setCodeAutoRunning(false)
      }
    }, CODE_RUN_DEBOUNCE_MS)

    return () => clearTimeout(t)
  }, [
    editorMode,
    strategyKind,
    strategyCode,
    dslOrJsonPayload,
    strategyCodeParseResult,
    previewPhase,
    previewCandles,
    previewPrices,
    previewLastPrice,
    asset,
    timeframe,
    previewPeriodKey,
    klineLimit,
  ])

  /* ── 간편 제작: 조건·리스크 변경 시 자동 실행 (코드 탭과 동일하게 debounce) ─ */
  useEffect(() => {
    if (strategyKind === 'method') return undefined
    if (editorMode !== 'builder') return undefined
    if (mode !== 'nocode') return undefined
    if (selected.length === 0) {
      setTestResult(null)
      return undefined
    }
    if (previewPhase !== 'ok' || !previewCandles?.length || !previewPrices.length || !previewStrategyConfig) {
      return undefined
    }

    setTestRunning(true)
    const timer = window.setTimeout(() => {
      try {
        const pipe = runStrategy(previewCandles ?? [], null, { strategyConfig: previewStrategyConfig })
        setTestResult({
          performance: pipe.performance,
          trades: pipe.trades ?? [],
          signals: pipe.signals ?? [],
          openPos: calculateOpenPosition(pipe.signals ?? [], previewLastPrice),
          meta: {
            asset: asset || 'BTC',
            timeframe,
            periodKey: previewPeriodKey,
            klineLimit,
            ranAt: Date.now(),
            auto: true,
          },
        })
        setTestError('')
      } catch (e) {
        setTestResult(null)
        setTestError(e?.message ?? '미리보기 계산에 실패했습니다.')
      } finally {
        setTestRunning(false)
      }
    }, CODE_RUN_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [
    editorMode,
    strategyKind,
    mode,
    selected.length,
    previewPhase,
    previewCandles,
    previewPrices,
    previewStrategyConfig,
    previewLastPrice,
    asset,
    timeframe,
    previewPeriodKey,
    klineLimit,
  ])

  const oneLineSummary = useMemo(() => {
    const nm = String(name ?? '').trim()
    const head = nm ? `「${nm}」 · ` : ''
    const a = asset || '—'
    const tf = TIMEFRAME_LABEL[timeframe] ?? (timeframe || '—')
    if (editorMode === 'code') {
      const applied = dslOrJsonPayload
        ? formatStrategyConditionsSummary(dslOrJsonPayload)
        : '미적용'
      return `${head}${a} / ${tf} / 코드 — ${applied}`
    }
    const condStr = formatConditionsSummary(conditionsForSummary)
    const riskStr = formatEditorRiskSummary(riskConfigMemo)
    return `${head}${a} / ${tf} / ${condStr} / ${riskStr}`
  }, [name, asset, timeframe, editorMode, dslOrJsonPayload, conditionsForSummary, riskConfigMemo])

  /* 캔들만 debounce fetch — 리스크/조건 변경은 useMemo로 재계산 */
  useEffect(() => {
    let cancelled = false
    setPreviewAltNote(String(asset || '').toUpperCase() === 'ALT'
      ? (() => {
          const first = normalizeAltValidationSymbols(altValidationSymbols)[0] || ALT_BASKET_USDT_PAIRS[0]
          return `알트(ALT)는 선택한 검증 코인 각각에 백테스트한 뒤 평균·분포로 요약합니다. 미리보기 캔들은 ${first} 기준입니다.`
        })()
      : '')

    const needNocodeConds = editorMode === 'builder' && mode === 'nocode' && selected.length === 0
    const needCodePayload = editorMode === 'code' && !dslOrJsonPayload
    if (!asset || !timeframe || needNocodeConds) {
      setPreviewPhase('idle')
      setPreviewCandles(null)
      setPreviewError('')
      return
    }
    if (needCodePayload) {
      setPreviewPhase('idle')
      setPreviewCandles(null)
      setPreviewError('')
      return
    }

    setPreviewPhase('loading')
    setPreviewError('')
    setPreviewCandles(null)

    const limit = computeKlineLimit(previewPeriodKey, intervalFromEditorTimeframe(timeframe))

    const timer = setTimeout(async () => {
      try {
        const base = klineBaseFromEditorAsset(asset, altValidationSymbols)
        const interval = intervalFromEditorTimeframe(timeframe)
        const candles = await getCachedKlines(base, interval, limit)
        if (cancelled) return
        setPreviewCandles(candles)
        setPreviewPhase('ok')
      } catch (e) {
        if (cancelled) return
        setPreviewPhase('error')
        setPreviewError(e?.message ? String(e.message) : '미리보기 계산 실패')
        setPreviewCandles(null)
      }
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [editorMode, mode, asset, timeframe, selectedKey, previewPeriodKey, dslOrJsonPayload, altValidationSymbols])

  useEffect(() => {
    if (mode === 'code') {
      setPreviewCalcPending(false)
      return
    }
    const dirty = JSON.stringify(condParams) !== JSON.stringify(deferredCondParams)
      || JSON.stringify(riskConfigMemo) !== JSON.stringify(deferredRiskConfig)
    setPreviewCalcPending(!!dirty && mode === 'nocode' && !!previewCandles?.length)
  }, [condParams, deferredCondParams, riskConfigMemo, deferredRiskConfig, mode, previewCandles])

  useEffect(() => {
    if (mode === 'nocode') setCodePreviewPayload(null)
  }, [mode])
  const displayMarketStatus = editingStrategyStatus ?? 'draft'
  const statusCfg = REVIEW_STATUS[displayMarketStatus] ?? REVIEW_STATUS.draft

  const marketSlotsRemaining = useMemo(() => {
    if (!canSubmitToMarket || !maxMarketSlots) return null
    return Math.max(0, maxMarketSlots - marketPipelineCount)
  }, [canSubmitToMarket, maxMarketSlots, marketPipelineCount])

  const submissionChecklist = useMemo(() => {
    const nameOk = !!String(name ?? '').trim()
    const isMethod = strategyKind === 'method'
    const hasPdf = !!String(strategyPdfPath || '').trim() || !!String(strategyPreviewPdfPath || '').trim()
    const explainOk = isMethod
      ? !!String(description ?? '').trim()
      : (hasPdf
          ? (!!String(strategySummary ?? '').trim() && !!String(riskDescription ?? '').trim())
          : (!!String(strategySummary ?? '').trim()
              && !!String(entryLogic ?? '').trim()
              && !!String(exitLogic ?? '').trim()
              && !!String(marketCondition ?? '').trim()
              && !!String(riskDescription ?? '').trim()))
    let condOk = false
    if (!isMethod) {
      if (editorMode === 'builder') {
        condOk = selected.length > 0
      } else {
        condOk = Array.isArray(dslOrJsonPayload?.conditions) && dslOrJsonPayload.conditions.length > 0
      }
    } else {
      condOk = true
    }
    const pdfOk = !isMethod || !!String(methodPdfPath || '').trim()
    const linkOk = !isMethod || !!String(linkedSignalStrategyId || '').trim()
    const previewOk = isMethod ? true : (previewPhase === 'ok' && !!previewData)
    const tradesOk = isMethod ? true : !!(previewData && previewData.totalTrades >= MIN_MARKET_TRADES)
    return [
      { key: 'name', label: '전략명 작성 완료', ok: nameOk },
      { key: 'explain', label: '전략 설명 또는 PDF 제공', ok: explainOk },
      ...(isMethod
        ? [
            { key: 'pdf', label: 'PDF 업로드 완료', ok: pdfOk },
            { key: 'link', label: '연결 전략 선택', ok: linkOk },
          ]
        : [
            { key: 'cond', label: '진입 조건 1개 이상', ok: condOk },
            { key: 'preview', label: '미리보기(백테스트) 로드', ok: previewOk },
            { key: 'trades', label: `최소 거래 ${MIN_MARKET_TRADES}회 (미리보기 기준)`, ok: tradesOk },
          ]
      ),
      { key: 'pro', label: 'Pro 플랜(구독)', ok: canSubmitToMarket },
    ]
  }, [
    name,
    description,
    editorMode,
    selected,
    dslOrJsonPayload,
    previewPhase,
    previewData,
    canSubmitToMarket,
    strategyKind,
    methodPdfPath,
    linkedSignalStrategyId,
    strategyPdfPath,
    strategyPreviewPdfPath,
    strategySummary,
    entryLogic,
    exitLogic,
    marketCondition,
    riskDescription,
  ])

  const applyTemplate = useCallback((key) => {
    const t = STRATEGY_TEMPLATES[key]
    if (!t) return
    setSelected(t.selected)
    setCondParams(t.condParams)
    setSaveError('')
  }, [])

  const resetRiskDefaults = useCallback(() => {
    setStopType(DEFAULT_RISK_CONFIG.stopType)
    setStopValue(DEFAULT_RISK_CONFIG.stopValue)
    setStopRules([newStopRule('fixed_pct')])
    setTakeProfitPct(DEFAULT_RISK_CONFIG.takeProfitPct)
    setTrailingStopPct(DEFAULT_RISK_CONFIG.trailingStopPct)
    setPosSize(DEFAULT_RISK_CONFIG.posSize)
    setMaxOpenPos(DEFAULT_RISK_CONFIG.maxOpenPos)
    setMinSignalGap(DEFAULT_RISK_CONFIG.minSignalGap)
    setAllowReentry(DEFAULT_RISK_CONFIG.allowReentry)
    setTimeExitBars(DEFAULT_RISK_CONFIG.timeExitBars)
    setAtrPeriod(DEFAULT_RISK_CONFIG.atrPeriod)
    setAtrMult(DEFAULT_RISK_CONFIG.atrMult)
    setMaxLossPct(DEFAULT_RISK_CONFIG.maxLossPct)
  }, [])

  const resetConditionsOnly = useCallback(() => {
    setSelected([])
    setCondParams({})
  }, [])

  const conditionsForPreviewSummary = useMemo(() => {
    if (editorMode === 'code' && dslOrJsonPayload) {
      return formatStrategyConditionsSummary(dslOrJsonPayload)
    }
    return formatConditionsSummary(conditionsForSummary)
  }, [editorMode, dslOrJsonPayload, conditionsForSummary])

  const toggle = (id) => {
    setSelected((p) => {
      if (p.includes(id)) {
        setCondParams((cp) => {
          const next = { ...cp }
          delete next[id]
          return next
        })
        return p.filter((x) => x !== id)
      }
      setCondParams((cp) => ({
        ...cp,
        [id]: { ...(DEFAULT_COND_PARAMS[id] ?? {}), ...(cp[id] ?? {}) },
      }))
      return [...p, id]
    })
  }

  function patchCondParam(id, patch) {
    setCondParams((cp) => ({
      ...cp,
      [id]: { ...(DEFAULT_COND_PARAMS[id] ?? {}), ...(cp[id] ?? {}), ...(patch ?? {}) },
    }))
  }

  const strategySnapshotNocode = useMemo(() => {
    const risk_config = { ...DEFAULT_RISK_CONFIG, ...riskConfigMemo }
    return {
      name: name.trim() || '새 전략',
      description: description.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      asset: asset || 'BTC',
      timeframe: timeframe || '1h',
      mode: 'nocode',
      riskLevel,
      conditions: engineConditionsToSaved(buildEngineConditionsFromEditor(selected, condParams)),
      code: '',
      risk_config,
      altValidationSymbols: String(asset || '').toUpperCase() === 'ALT'
        ? normalizeAltValidationSymbols(altValidationSymbols)
        : [],
    }
  }, [
    name, description, tags, asset, timeframe, riskLevel, selected, condParams,
    stopType, stopValue, takeProfitPct, trailingStopPct, posSize, maxOpenPos,
    minSignalGap, allowReentry, timeExitBars, atrPeriod, atrMult, maxLossPct,
    stopRules, riskConfigMemo, altValidationSymbols,
  ])

  useEffect(() => {
    if (mode !== 'nocode' || editorMode !== 'builder') return
    const next = JSON.stringify(strategySnapshotNocode, null, 2)
    setCode((prev) => (prev === next ? prev : next))
  }, [mode, editorMode, strategySnapshotNocode])

  // hydrateFromNormalizedPayload: function 선언문으로 상단에 정의됨 (TDZ 방지)

  /* ── 공통 폼 데이터 수집 ──────────── */
  function collectData() {
    const altSymCollect = String(asset || '').toUpperCase() === 'ALT'
      ? normalizeAltValidationSymbols(altValidationSymbols)
      : []
    const risk_config = { ...DEFAULT_RISK_CONFIG, ...riskConfigMemo }
    if (mode === 'code') {
      if (dslOrJsonPayload) {
        const merged = {
          id: currentId ?? editingStrategyId ?? undefined,
          type: strategyKind,
          ...dslOrJsonPayload,
          code: strategyCode,
          strategy_summary: strategySummary.trim(),
          entry_logic: entryLogic.trim(),
          exit_logic: exitLogic.trim(),
          market_condition: marketCondition.trim(),
          market_type: marketType,
          risk_description: riskDescription.trim(),
          strategy_pdf_path: strategyPdfPath || null,
          strategy_pdf_preview_path: strategyPreviewPdfPath || null,
          strategy_pdf_url: strategyPdfUrl || null,
          strategy_preview_mode: strategyPreviewPdfPath ? 'file' : 'none',
          method_pdf_path: methodPdfPath || null,
          method_pdf_preview_path: methodPreviewPdfPath || null,
          method_preview_mode: methodPreviewPdfPath ? 'file' : 'none',
          linked_signal_strategy_id: linkedSignalStrategyId || null,
          pdf_file: pdfFile ?? null,
          altValidationSymbols: altSymCollect,
        }
        return {
          ...merged,
          code: buildCanonicalCodeFromPayload(merged),
        }
      }
      const parsed = tryParseStrategyJson(code)
      if (!parsed.ok) {
        const partial = {
          id: currentId ?? editingStrategyId ?? undefined,
          type: strategyKind,
          name,
          description: description.trim(),
          strategy_summary: strategySummary.trim(),
          entry_logic: entryLogic.trim(),
          exit_logic: exitLogic.trim(),
          market_condition: marketCondition.trim(),
          market_type: marketType,
          risk_description: riskDescription.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          asset: asset || 'BTC',
          timeframe,
          mode: 'code',
          riskLevel,
          conditions: [],
          code,
          risk_config,
          strategy_pdf_path: strategyPdfPath || null,
          strategy_pdf_preview_path: strategyPreviewPdfPath || null,
          strategy_pdf_url: strategyPdfUrl || null,
          strategy_preview_mode: strategyPreviewPdfPath ? 'file' : 'none',
          method_pdf_path: methodPdfPath || null,
          method_pdf_preview_path: methodPreviewPdfPath || null,
          method_preview_mode: methodPreviewPdfPath ? 'file' : 'none',
          linked_signal_strategy_id: linkedSignalStrategyId || null,
          pdf_file: pdfFile ?? null,
          altValidationSymbols: altSymCollect,
        }
        return {
          ...partial,
          code: buildCanonicalCodeFromPayload(partial),
        }
      }
      const n = normalizeStrategyPayload({ ...parsed.value, mode: 'code' })
      const jsonMerged = {
        id: currentId ?? editingStrategyId ?? undefined,
        type: strategyKind,
        ...n,
        code,
        strategy_summary: strategySummary.trim(),
        entry_logic: entryLogic.trim(),
        exit_logic: exitLogic.trim(),
        market_condition: marketCondition.trim(),
        market_type: marketType,
        risk_description: riskDescription.trim(),
        strategy_pdf_path: strategyPdfPath || null,
        strategy_pdf_preview_path: strategyPreviewPdfPath || null,
        strategy_pdf_url: strategyPdfUrl || null,
        strategy_preview_mode: strategyPreviewPdfPath ? 'file' : 'none',
        method_pdf_path: methodPdfPath || null,
        method_pdf_preview_path: methodPreviewPdfPath || null,
        method_preview_mode: methodPreviewPdfPath ? 'file' : 'none',
        linked_signal_strategy_id: linkedSignalStrategyId || null,
        pdf_file: pdfFile ?? null,
        altValidationSymbols: altSymCollect,
      }
      return {
        ...jsonMerged,
        code: buildCanonicalCodeFromPayload(jsonMerged),
      }
    }
    const builderPayload = {
      id: currentId ?? editingStrategyId ?? undefined,
      type: strategyKind,
      name,
      description: description.trim(),
      strategy_summary: strategySummary.trim(),
      entry_logic: entryLogic.trim(),
      exit_logic: exitLogic.trim(),
      market_condition: marketCondition.trim(),
      market_type: marketType,
      risk_description: riskDescription.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      asset: asset || 'BTC',
      timeframe,
      mode: 'nocode',
      riskLevel,
      conditions: engineConditionsToSaved(buildEngineConditionsFromEditor(selected, condParams)),
      code: '',
      risk_config,
      strategy_pdf_path: strategyPdfPath || null,
      strategy_pdf_preview_path: strategyPreviewPdfPath || null,
      strategy_pdf_url: strategyPdfUrl || null,
      strategy_preview_mode: strategyPreviewPdfPath ? 'file' : 'none',
      method_pdf_path: methodPdfPath || null,
      method_pdf_preview_path: methodPreviewPdfPath || null,
      method_preview_mode: methodPreviewPdfPath ? 'file' : 'none',
      linked_signal_strategy_id: linkedSignalStrategyId || null,
      pdf_file: pdfFile ?? null,
      altValidationSymbols: altSymCollect,
    }
    return {
      ...builderPayload,
      mode: 'code',
      code: buildCanonicalCodeFromPayload(builderPayload),
    }
  }

  /* ── 유효성 검사 ─────────────────── */
  function validate() {
    if (!name.trim()) { setSaveError('전략 이름을 입력해주세요.'); return false }
    if (strategyKind === 'method') {
      if (!description.trim()) { setSaveError('매매법 설명을 입력해주세요.'); return false }
      if (!String(methodPdfPath || '').trim()) { setSaveError('매매법 PDF를 업로드해주세요.'); return false }
      if (!String(linkedSignalStrategyId || '').trim()) { setSaveError('연결된 실행 전략을 선택해주세요.'); return false }
      setSaveError('')
      return true
    }
    const hasPdf = !!String(strategyPdfPath || '').trim() || !!String(strategyPreviewPdfPath || '').trim()
    if (!hasPdf) {
      if (!strategySummary.trim()) { setSaveError('전략 요약을 입력해주세요. (또는 PDF 업로드)'); return false }
      if (!entryLogic.trim()) { setSaveError('진입 로직을 입력해주세요. (또는 PDF 업로드)'); return false }
      if (!exitLogic.trim()) { setSaveError('청산 로직을 입력해주세요. (또는 PDF 업로드)'); return false }
      if (!marketCondition.trim()) { setSaveError('시장 설명을 입력해주세요. (또는 PDF 업로드)'); return false }
      if (!riskDescription.trim()) { setSaveError('리스크 설명을 입력해주세요. (또는 PDF 업로드)'); return false }
    } else {
      if (!strategySummary.trim()) { setSaveError('PDF가 있어도 전략 요약은 입력해주세요.'); return false }
      if (!riskDescription.trim()) { setSaveError('PDF가 있어도 리스크 설명은 입력해주세요.'); return false }
    }
    if (editorMode === 'builder' && mode === 'nocode' && selected.length === 0) {
      setSaveError('진입 조건을 하나 이상 선택해주세요.'); return false
    }
    if (String(asset || '').toUpperCase() === 'ALT') {
      const syms = normalizeAltValidationSymbols(altValidationSymbols)
      if (syms.length < ALT_VALIDATION_MIN || syms.length > ALT_VALIDATION_MAX) {
        setSaveError(`알트(ALT)는 검증용 Binance USDT 심볼을 ${ALT_VALIDATION_MIN}~${ALT_VALIDATION_MAX}개 선택해야 합니다. (현재 ${syms.length}개)`)
        return false
      }
    }
    if (mode === 'code') {
      if (!dslOrJsonPayload) {
        const t = String(strategyCode ?? '').trim()
        if (t.startsWith('{')) {
          const p = tryParseStrategyJson(strategyCode)
          if (!p.ok) {
            setSaveError(`${p.message}${p.pos != null ? ` (문자 위치 ${p.pos})` : ''}`)
            return false
          }
        } else if (!strategyCodeParseResult.ok) {
          setSaveError(formatParseError(strategyCodeParseResult))
          return false
        }
        setSaveError('코드에서 진입 조건을 만들 수 없습니다. 문법을 확인해 주세요.')
        return false
      }
      if (!Array.isArray(dslOrJsonPayload.conditions) || dslOrJsonPayload.conditions.length === 0) {
        setSaveError('진입 조건이 비어 있습니다.')
        return false
      }
    }
    setSaveError('')
    return true
  }

  function validateForTest() {
    const e = {}
    if (strategyKind === 'method') {
      e.form = '매매법(PDF)은 엔진 테스트를 실행하지 않습니다. 연결 전략으로 시그널/검증 흐름을 이용하세요.'
      return e
    }
    if (!String(asset ?? '').trim()) e.asset = '대상 자산을 선택해주세요.'
    if (String(asset || '').toUpperCase() === 'ALT') {
      const syms = normalizeAltValidationSymbols(altValidationSymbols)
      if (syms.length < ALT_VALIDATION_MIN || syms.length > ALT_VALIDATION_MAX) {
        e.asset = `검증 코인 ${ALT_VALIDATION_MIN}~${ALT_VALIDATION_MAX}개를 선택해 주세요. (현재 ${syms.length}개)`
      }
    }
    if (!String(timeframe ?? '').trim()) e.timeframe = '봉 간격을 선택해주세요.'
    if (editorMode === 'builder' && mode === 'nocode' && selected.length === 0) {
      e.entry = '진입 조건을 1개 이상 선택해주세요.'
    }
    if (editorMode === 'code') {
      const t = String(strategyCode ?? '').trim()
      if (!t) e.code = '전략 코드를 입력해 주세요.'
      else if (!dslOrJsonPayload) {
        if (t.startsWith('{')) {
          const p = tryParseStrategyJson(strategyCode)
          if (!p.ok) e.code = `${p.message}${p.pos != null ? ` (문자 위치 ${p.pos})` : ''}`
          else e.code = 'JSON에서 진입 조건(conditions)을 확인해 주세요.'
        } else {
          e.code = formatParseError(strategyCodeParseResult)
        }
      }
    }
    if (previewPhase !== 'ok' || !previewCandles?.length || !previewPrices.length || !previewStrategyConfig) {
      e.preview = '데이터를 불러오는 중입니다. 자산/봉/조건을 확인하고 잠시 후 다시 시도해 주세요.'
    }
    return e
  }

  async function handleRunTest() {
    setTestError('')
    const e = validateForTest()
    setUiErrors(e)
    if (Object.keys(e).length > 0) {
      setTestError(e.form || '입력값을 확인해 주세요.')
      return
    }
    if (!previewStrategyConfig || !previewPrices.length) {
      setTestError('자산·봉·조건을 확인한 뒤 다시 시도해 주세요.')
      return
    }
    setTestRunning(true)
    try {
      const pipe = runStrategy(previewCandles ?? [], null, { strategyConfig: previewStrategyConfig })
      setTestResult({
        performance: pipe.performance,
        trades: pipe.trades ?? [],
        signals: pipe.signals ?? [],
        openPos: calculateOpenPosition(pipe.signals ?? [], previewLastPrice),
        meta: {
          asset: asset || 'BTC',
          timeframe,
          periodKey: previewPeriodKey,
          klineLimit,
          ranAt: Date.now(),
        },
      })
      setTestError('')
    } catch (err) {
      setTestResult(null)
      setTestError(err?.message ?? '테스트 실행 실패')
    } finally {
      setTimeout(() => setTestRunning(false), 120)
    }
  }

  /* ── 임시 저장 ───────────────────── */
  async function handleDraft() {
    if (!name.trim()) { setSaveError('전략 이름을 입력해주세요.'); return }
    setSaveError('')
    const data     = collectData()
    let strategy = null
    try {
      strategy = await onSaveStrategy?.(data, 'draft')
    } catch {
      strategy = null
    }
    if (!strategy) {
      setSaveStatus('error')
      setSaveError(saveErrorMessage || '로그인 후 저장할 수 있습니다.')
      return
    }
    setCurrentId(strategy.id)
    setSaveStatus('draft')
    setTimeout(() => setSaveStatus(null), 3000)
  }

  const [submittingMarket, setSubmittingMarket] = useState(false)

  const kpi = testResult?.performance ?? null
  const recentTrades = useMemo(() => (testResult?.trades ?? []).slice(-10).reverse(), [testResult?.trades])
  const openPos = testResult?.openPos ?? null

  const warnings = useMemo(() => {
    const out = []
    if (strategyKind === 'method') {
      out.push('매매법(PDF)은 엔진 테스트 결과가 제공되지 않습니다. 연결 전략으로 실행/검증 흐름을 이용하세요.')
      return out
    }
    if (!String(name ?? '').trim()) out.push('전략 이름이 비어 있습니다.')
    if (editorMode === 'builder' && mode === 'nocode' && selected.length === 0) {
      out.push('진입 조건이 선택되지 않았습니다.')
    }
    if (kpi?.totalTrades != null && kpi.totalTrades < MIN_MARKET_TRADES) out.push(`거래 수가 적습니다 (현재 ${kpi.totalTrades}회 / 최소 ${MIN_MARKET_TRADES}회).`)
    if (kpi?.mdd != null && Number(kpi.mdd) >= MAX_MARKET_MDD_BLOCK) out.push(`MDD가 높습니다 (현재 ${kpi.mdd}% / 기준 ${MAX_MARKET_MDD_BLOCK}% 이하).`)
    if (!canSubmitToMarket) out.push('마켓 제출은 Pro(구독)에서만 가능합니다.')
    if (saveLimitReached) out.push('저장 가능한 전략 개수 제한에 도달했습니다.')
    if (editorMode === 'code' && !dslOrJsonPayload) {
      out.push('코드 에디터: DSL 문법을 확인하거나, 유효한 JSON 전략(`{` 로 시작)인지 확인해 주세요.')
    }
    return out
  }, [strategyKind, name, editorMode, mode, selected.length, kpi?.totalTrades, kpi?.mdd, canSubmitToMarket, saveLimitReached, dslOrJsonPayload])

  /* ── 마켓 제출 ───────────────────── */
  async function handleSubmit() {
    if (!validate()) return
    if (!canSubmitToMarket) {
      setSaveError(PLAN_MESSAGES.marketSubmitProOnly)
      return
    }
    const data = collectData()
    setSubmittingMarket(true)
    setSaveError('')
    let strategy = null
    try {
      strategy = await onSaveStrategy?.(data, 'submitted')
    } catch {
      strategy = null
    } finally {
      setSubmittingMarket(false)
    }
    if (!strategy) {
      setSaveStatus('error')
      setSaveError(saveErrorMessage || '제출에 실패했습니다. 조건을 확인해 주세요.')
      return
    }
    setCurrentId(strategy.id)
    setSaveStatus('submitted')
    setTimeout(() => {
      setSaveStatus(null)
      onNavigate?.('mypage')
    }, 1600)
  }

  return (
    <PageShell wide className="editor-page-shell">
      <header className="editor-page-header space-y-4">
        <PageHeader
          title={strategyKind === 'method' ? '매매법 등록' : '전략 에디터'}
          description={
            strategyKind === 'method'
              ? 'PDF와 매매 규칙을 등록합니다.'
              : '전략을 만들고 오른쪽에서 바로 확인하세요. 저장은 임시 보관, 테스트 실행은 지금 입력 기준으로 다시 계산, 마켓 제출은 검수로 이어집니다.'
          }
        />

        {strategyKind !== 'method' && (
          <div
            className="editor-mode-tabs flex w-full max-w-md rounded-[8px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-1 shadow-none"
            role="tablist"
            aria-label="제작 방식"
          >
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === 'builder'}
              onClick={() => { setEditorMode('builder'); setUiErrors((u) => ({ ...u, code: undefined })) }}
              className={cn(
                'flex-1 rounded-[6px] px-3 py-2.5 text-[13px] font-semibold transition-colors',
                editorMode === 'builder'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/50'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-gray-800/60',
              )}
            >
              간편 제작
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === 'code'}
              onClick={() => {
                setEditorMode('code')
                setUiErrors((u) => ({ ...u, code: undefined, entry: undefined }))
                if (!String(strategyCode ?? '').trim()) setStrategyCode(DEFAULT_STRATEGY_CODE_TEMPLATE)
              }}
              className={cn(
                'flex-1 rounded-[6px] px-3 py-2.5 text-[13px] font-semibold transition-colors',
                editorMode === 'code'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/50'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-gray-800/60',
              )}
            >
              코드 제작
            </button>
          </div>
        )}
      </header>

      {editorRenderError && (
        <div className="mb-4">
          <Card className="editor-card-product">
            <Card.Header>
              <Card.Title>에디터를 불러오지 못했습니다</Card.Title>
              <Card.Description>새로고침 후 다시 시도해주세요.</Card.Description>
            </Card.Header>
            <Card.Content className="space-y-2">
              <div className="rounded-[8px] border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 px-3 py-2.5">
                <p className="text-[11px] text-red-800 dark:text-red-200 whitespace-pre-wrap">{editorRenderError}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => setEditorRenderError('')}>
                  닫기
                </Button>
                <Button variant="secondary" size="sm" type="button" onClick={() => window.location.reload()}>
                  새로고침
                </Button>
              </div>
            </Card.Content>
          </Card>
        </div>
      )}

      <div
        className={cn(
          'editor-main-grid grid grid-cols-1 gap-5 items-start',
          editorMode === 'code' && strategyKind !== 'method'
            ? 'lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,480px)]'
            : 'lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)]',
        )}
      >

        <section className="editor-left min-w-0 space-y-3">
          {/* 1) 템플릿 — 간편 제작에서 먼저 고를 수 있게 상단 배치 */}
          {strategyKind !== 'method' && editorMode === 'builder' && mode === 'nocode' && (
            <Card className="editor-card-product">
              <Card.Header>
                <Card.Title>빠른 시작 · 템플릿</Card.Title>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  처음이면 아래에서 하나만 골라도 됩니다. 이름·시장은 그 다음에 바꿀 수 있어요.
                </p>
              </Card.Header>
              <Card.Content className="space-y-2.5">
                <p className="text-[11px] text-slate-500">
                  템플릿을 선택하면 <span className="font-semibold text-slate-700 dark:text-slate-300">현재 진입 조건과 숫자 값이 덮어써집니다</span>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {Object.entries(STRATEGY_TEMPLATES).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => applyTemplate(k)}
                      className="
                        text-left px-3 py-3 rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/30
                        hover:border-blue-200 hover:bg-blue-50/40 dark:hover:border-blue-900/40 dark:hover:bg-blue-950/20 transition-colors
                      "
                    >
                      <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200">{v.label}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {formatConditionsSummary(engineConditionsToSaved(buildEngineConditionsFromEditor(v.selected, v.condParams ?? {})))}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400">선택된 조건: {selected.length}개</p>
                  <Button variant="ghost" size="sm" type="button" onClick={resetConditionsOnly}>
                    조건 초기화
                  </Button>
                </div>
              </Card.Content>
            </Card>
          )}

          {/* 2) 기본 정보 — 간편/코드 공통 상단 + PDF·마켓 제출 상세 */}
          {(strategyKind === 'method' || strategyKind === 'signal') && (
          <Card className="editor-card-product">
            <Card.Header className="flex items-center justify-between gap-2">
              <Card.Title>{strategyKind === 'method' ? '기본 정보' : '전략 기본'}</Card.Title>
              <div className="flex items-center gap-2">
                <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
                {saveStatus === 'draft' && <span className="text-[11px] text-slate-500">✓ 저장됨</span>}
                {saveStatus === 'submitted' && <span className="text-[11px] text-blue-600 font-semibold">✓ 제출됨</span>}
              </div>
            </Card.Header>
            <Card.Content className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-1">
                  <label className="text-[10px] text-slate-400 block mb-1">자산</label>
                  <select
                    value={asset}
                    onChange={(e) => { setAsset(e.target.value); setUiErrors((p) => ({ ...p, asset: undefined })) }}
                    className="w-full h-8 text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                  >
                    <option value="">자산 선택</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="SOL">SOL</option>
                    <option value="ALT">알트코인</option>
                  </select>
                  {uiErrors.asset && <p className="mt-1 text-[11px] text-red-500">{uiErrors.asset}</p>}
                </div>
                <div className="sm:col-span-1">
                  <label className="text-[10px] text-slate-400 block mb-1">타임프레임</label>
                  <select
                    value={timeframe || '1h'}
                    onChange={(e) => { setTimeframe(e.target.value); setUiErrors((p) => ({ ...p, timeframe: undefined })) }}
                    className="w-full h-8 text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                  >
                    {DATA_INTERVAL_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  {uiErrors.timeframe && <p className="mt-1 text-[11px] text-red-500">{uiErrors.timeframe}</p>}
                </div>
              </div>

              {String(asset || '').toUpperCase() === 'ALT' && (
                <div className="rounded-md border border-indigo-100 dark:border-indigo-900/35 bg-indigo-50/50 dark:bg-indigo-950/25 px-3 py-2.5">
                  <p className="text-[10px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
                    {assetUniverseCopy.altBasketValidation}
                    {' '}
                    시그널 페이지에서는 차트 심볼을 자유롭게 바꿀 수 있으며, 검증 성과는 여기 선택한 코인 묶음과 별개로 표시됩니다.
                  </p>
                  <EditorAltValidationSection
                    altSymDraft={altSymDraft}
                    setAltSymDraft={setAltSymDraft}
                    altValidationSymbols={altValidationSymbols}
                    setAltValidationSymbols={setAltValidationSymbols}
                    pairOptions={binancePairMetaEditor}
                    className="mt-2 space-y-2"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">전략 이름</label>
                <Input
                  placeholder="예: BTC Trend Rider v2"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSaveError(''); setUiErrors((p) => ({ ...p, name: undefined })) }}
                />
                {uiErrors.name && <p className="mt-1 text-[11px] text-red-500">{uiErrors.name}</p>}
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  {strategyKind === 'method' ? '매매법 설명' : '전략 설명'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={strategyKind === 'method' ? 4 : 3}
                  placeholder={strategyKind === 'method'
                    ? '매매법 규칙(진입/청산/예외), 리스크 관리, 적용 시장/타임프레임, 실패 사례를 포함해 주세요.'
                    : '예: 4시간봉 추세 유지 시 진입, 횡보 시 관망'}
                  className="
                    w-full text-[11px] px-2.5 py-2 rounded-md
                    border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                    resize-none focus:outline-none focus:border-slate-400
                  "
                />
              </div>

              {strategyKind === 'signal' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">미리보기·차트 기간</label>
                    <select
                      value={previewPeriodKey}
                      onChange={(e) => setPreviewPeriodKey(e.target.value)}
                      className="w-full h-8 text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    >
                      {PREVIEW_PERIOD_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-500 self-center sm:col-span-2 leading-snug">
                    고른 봉 간격·기간으로 오른쪽 차트와 수익률이 바로 바뀝니다.
                  </p>
                </div>
              )}

              {strategyKind === 'signal' && (
                <>
                  <div className="bb-divider my-3" />
                  <p className="text-[10px] text-slate-500 mb-2">
                    간편 제작·코드 제작 동일한 순서입니다: 이름·시장 → 설명 → PDF(선택) → 아래는 마켓 제출 시 추가 입력입니다.
                  </p>

                {/* PDF — 상단에 항상 노출 */}
                <div>
                  <SectionHeader title="설명 PDF (선택)" sub="진입/청산 전략 설명 문서 · 최대 25MB" />
                  <input
                    ref={stratPdfInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleStrategyPdfUpload}
                  />
                  {strategyPdfPath ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/60 dark:bg-blue-950/20">
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 flex-1 truncate">
                        ✓ {pdfFile?.name ?? 'PDF 업로드 완료'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => { setStrategyPdfPath(''); setStrategyPreviewPdfPath(''); setStrategyPdfUrl(''); setStrategyPdfError(''); setPdfFile(null) }}
                      >
                        제거
                      </Button>
                    </div>
                  ) : pdfFile && !strategyPdfPath ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20">
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 flex-1 truncate">
                        {pdfUploading ? '업로드 중… ' : '파일 선택됨: '}{pdfFile.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => { setPdfFile(null); setStrategyPdfError(''); if (stratPdfInputRef.current) stratPdfInputRef.current.value = '' }}
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        disabled={pdfUploading}
                        onClick={() => stratPdfInputRef.current?.click()}
                      >
                        {pdfUploading ? 'PDF 업로드 중…' : 'PDF 파일 선택'}
                      </Button>
                      {!currentUser && (
                        <span className="text-[10px] text-slate-400">로그인 시 서버에 자동 업로드됩니다.</span>
                      )}
                    </div>
                  )}
                  {strategyPdfError && (
                    <p className="mt-1 text-[11px] text-red-500">{strategyPdfError}</p>
                  )}
                  <p className="mt-1.5 text-[9px] text-slate-400 leading-relaxed">
                    PDF는 검증 데이터가 아닌 설명 자료입니다. 전략 의도·적용 시장·리스크·실패 조건을 담아주세요.
                  </p>
                </div>

                  <details
                    open={false}
                    className="mt-3 rounded-lg border border-slate-100 dark:border-gray-800 bg-slate-50/40 dark:bg-gray-900/20"
                  >
                    <summary className="cursor-pointer list-none px-3 py-2.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2">
                      <span>마켓 제출 추가 입력</span>
                      <span className="text-[10px] font-normal text-slate-400">선택</span>
                    </summary>
                    <div className="space-y-3 px-3 pb-3 border-t border-slate-100 dark:border-gray-800 pt-3">

                <div className="bb-divider" />

                {/* 한 줄 요약 */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    한 줄 요약 <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="예: BTC 4시간봉 추세추종 · RSI 다이버전스 진입"
                    value={strategySummary}
                    onChange={(e) => setStrategySummary(e.target.value)}
                  />
                </div>

                {/* 진입 로직 설명 */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    진입 조건 설명
                    {!strategyPdfPath && <span className="text-red-400"> *</span>}
                    {strategyPdfPath && <span className="text-slate-400"> (PDF 있으면 생략 가능)</span>}
                  </label>
                  <textarea
                    value={entryLogic}
                    onChange={(e) => setEntryLogic(e.target.value)}
                    rows={2}
                    placeholder="어떤 조건에서 진입하는지 설명해주세요."
                    className="
                      w-full text-[11px] px-2.5 py-2 rounded-md
                      border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                      resize-none focus:outline-none focus:border-slate-400
                    "
                  />
                </div>

                {/* 청산 로직 설명 */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    청산 조건 설명
                    {!strategyPdfPath && <span className="text-red-400"> *</span>}
                    {strategyPdfPath && <span className="text-slate-400"> (PDF 있으면 생략 가능)</span>}
                  </label>
                  <textarea
                    value={exitLogic}
                    onChange={(e) => setExitLogic(e.target.value)}
                    rows={2}
                    placeholder="손절·익절·청산 조건을 설명해주세요."
                    className="
                      w-full text-[11px] px-2.5 py-2 rounded-md
                      border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                      resize-none focus:outline-none focus:border-slate-400
                    "
                  />
                </div>

                {/* 적용 시장 */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    적용 시장
                    {!strategyPdfPath && <span className="text-red-400"> *</span>}
                    {strategyPdfPath && <span className="text-slate-400"> (PDF 있으면 생략 가능)</span>}
                  </label>
                  <select
                    value={marketType}
                    onChange={(e) => {
                      setMarketType(e.target.value)
                      if (e.target.value !== '기타') setMarketCondition(e.target.value)
                      else setMarketCondition('')
                    }}
                    className="
                      w-full text-[11px] px-2.5 py-2 rounded-md
                      border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                      focus:outline-none focus:border-slate-400
                    "
                  >
                    <option value="">시장 선택…</option>
                    <option value="BTC">BTC (Bitcoin)</option>
                    <option value="ETH">ETH (Ethereum)</option>
                    <option value="SOL">SOL (Solana)</option>
                    <option value="BNB">BNB (BNB Chain)</option>
                    <option value="XRP">XRP (Ripple)</option>
                    <option value="ADA">ADA (Cardano)</option>
                    <option value="DOGE">DOGE (Dogecoin)</option>
                    <option value="AVAX">AVAX (Avalanche)</option>
                    <option value="DOT">DOT (Polkadot)</option>
                    <option value="LINK">LINK (Chainlink)</option>
                    <option value="기타">기타 (직접 입력)</option>
                  </select>
                  {marketType === '기타' && (
                    <Input
                      className="mt-1.5"
                      placeholder="예: MATIC/USDT 4H 추세 시장"
                      value={marketCondition}
                      onChange={(e) => setMarketCondition(e.target.value)}
                    />
                  )}
                </div>

                {/* 리스크 설명 */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    리스크 설명 <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={riskDescription}
                    onChange={(e) => setRiskDescription(e.target.value)}
                    rows={2}
                    placeholder="이 전략이 실패하는 조건, 사용자가 알아야 할 리스크를 솔직하게 작성해주세요."
                    className="
                      w-full text-[11px] px-2.5 py-2 rounded-md
                      border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                      resize-none focus:outline-none focus:border-slate-400
                    "
                  />
                </div>

                    </div>
                  </details>
                </>
              )}
            </Card.Content>
          </Card>
          )}

          {/* 4) 진입 조건 카드 */}
          {strategyKind !== 'method' && editorMode === 'builder' && mode === 'nocode' && (
            <Card className="overflow-hidden">
              <Card.Header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Card.Title>진입 조건</Card.Title>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug max-w-[520px]">
                    켜두면 롱·숏 신호가 생깁니다. 여러 개를 켜면 조건을 함께 만족할 때만 진입합니다.
                  </p>
                </div>
                <Badge variant="info" className="shrink-0">{selected.length}개</Badge>
              </Card.Header>
              <Card.Content className="p-0">
                {uiErrors.entry && (
                  <div className="px-3 pt-3">
                    <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 px-3 py-2">
                      <p className="text-[11px] text-red-700 dark:text-red-300">{uiErrors.entry}</p>
                    </div>
                  </div>
                )}
                {CATEGORIES.map((cat) => (
                  <div key={cat}>
                    <p className="bb-kpi-label px-3 pt-3 pb-1">{cat}</p>
                    {ENTRY_CONDITIONS.filter((c) => c.category === cat).map((c) => {
                      const on = selected.includes(c.id)
                      return (
                        <div key={c.id} className={cn(
                          'border-b border-slate-50 dark:border-gray-800/60 last:border-b-0',
                          on ? 'bg-blue-50/60 dark:bg-blue-950/20' : '',
                        )}>
                          <button
                            type="button"
                            onClick={() => { toggle(c.id); setUiErrors((p) => ({ ...p, entry: undefined })) }}
                            className={cn(
                              'w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
                              !on && 'hover:bg-slate-50/70 dark:hover:bg-gray-800/30',
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn(
                                'w-4 h-4 rounded-lg border flex items-center justify-center text-[10px] font-mono',
                                on
                                  ? 'border-blue-500 bg-blue-600 text-white'
                                  : 'border-slate-200 dark:border-gray-700 text-slate-400',
                              )}>
                                {on ? '✓' : ''}
                              </span>
                              <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {c.simpleLabel ?? c.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {on ? '설정' : '선택'}
                            </span>
                          </button>
                          {on && (
                            <div className="px-3 pb-3">
                              <CondParamRow
                                id={c.id}
                                values={condParams[c.id]}
                                onChange={(patch) => patchCondParam(c.id, patch)}
                                onReset={() => patchCondParam(c.id, { ...(DEFAULT_COND_PARAMS[c.id] ?? {}) })}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* 5) 청산 / 손절 / 익절 카드 + 포지션/리스크 */}
          {strategyKind !== 'method' && editorMode === 'builder' && mode === 'nocode' && (
            <Card>
              <Card.Header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Card.Title>목표 수익 · 손절 · 포지션 크기</Card.Title>
                  <p className="text-[10px] text-slate-500 mt-0.5">익절·손절은 진입가 대비 %로 잡습니다. 아래는 한 가지 손절 방식만 골라요.</p>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-pre-wrap sm:text-right">{formatEditorRiskSummary(riskConfigMemo)}</span>
              </Card.Header>
              <Card.Content className="space-y-3">
                <div>
                  <SectionHeader title="손절 규칙" sub="여러 개 허용" />
                  <div className="space-y-2">
                    {normalizeStopRules(stopRules).map((rule) => (
                      <div key={rule.id} className="rounded-lg border border-slate-200 dark:border-gray-800 p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={rule.type}
                            onChange={(e) => setStopRules((prev) => normalizeStopRules(prev).map((x) => x.id === rule.id ? { ...x, type: e.target.value } : x))}
                            className="h-8 text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                          >
                            {STOP_RULE_CONDITIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                          <span className="text-[10px] text-slate-400 flex-1">{STOP_RULE_CONDITIONS.find((x) => x.id === rule.type)?.hint ?? ''}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={normalizeStopRules(stopRules).length <= 1}
                            onClick={() => setStopRules((prev) => normalizeStopRules(prev).filter((x) => x.id !== rule.id))}
                          >
                            삭제
                          </Button>
                        </div>
                        {rule.type === 'fixed_pct' && (
                          <Input
                            type="number"
                            placeholder="예: 2"
                            value={rule.value}
                            onChange={(e) => setStopRules((prev) => normalizeStopRules(prev).map((x) => x.id === rule.id ? { ...x, value: e.target.value } : x))}
                          />
                        )}
                        {rule.type === 'atr_stop' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              type="number"
                              placeholder="ATR 기간"
                              value={rule.atrPeriod}
                              onChange={(e) => setStopRules((prev) => normalizeStopRules(prev).map((x) => x.id === rule.id ? { ...x, atrPeriod: e.target.value } : x))}
                            />
                            <Input
                              type="number"
                              placeholder="ATR 배수"
                              value={rule.atrMult}
                              onChange={(e) => setStopRules((prev) => normalizeStopRules(prev).map((x) => x.id === rule.id ? { ...x, atrMult: e.target.value } : x))}
                            />
                          </div>
                        )}
                        {rule.type === 'condition_expr' && (
                          <Input
                            placeholder="예: close < ema50 && rsi < 35"
                            value={rule.conditionExpr}
                            onChange={(e) => setStopRules((prev) => normalizeStopRules(prev).map((x) => x.id === rule.id ? { ...x, conditionExpr: e.target.value } : x))}
                          />
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setStopRules((prev) => [...normalizeStopRules(prev), newStopRule('fixed_pct')])}
                    >
                      손절 규칙 추가
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">익절 (%)</label>
                    <Input type="number" placeholder="예: 6" value={takeProfitPct} onChange={(e) => setTakeProfitPct(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">최대 손실 허용 (누적 %)</label>
                    <Input type="number" placeholder="비우면 미사용" value={maxLossPct} onChange={(e) => setMaxLossPct(e.target.value)} />
                  </div>
                </div>

                <div className="bb-divider pt-3" />

                <div>
                  <SectionHeader title="한 번에 얼마나 넣을지" sub="자본 대비 비율" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">포지션 크기 (자본의 %)</label>
                      <Input type="number" placeholder="예: 10" value={posSize} onChange={(e) => setPosSize(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">최대 동시 포지션</label>
                      <select
                        value={maxOpenPos}
                        onChange={(e) => setMaxOpenPos(e.target.value)}
                        className="h-8 w-full text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                      >
                        {['1', '2', '3', '5'].map((v) => (
                          <option key={v} value={v}>{v}개</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">최소 진입 간격 (봉 수)</label>
                      <Input type="number" min={0} placeholder="비우면 1" value={minSignalGap} onChange={(e) => setMinSignalGap(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={allowReentry}
                        onChange={(e) => setAllowReentry(e.target.checked)}
                        className="accent-slate-900 w-3.5 h-3.5"
                      />
                      청산 직후 같은 방향 재진입 허용
                    </label>
                  </div>
                </div>

                <Button variant="ghost" size="sm" type="button" className="self-start" onClick={resetRiskDefaults}>
                  리스크 기본값 복원
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* 코드 에디터: DSL (또는 `{` 로 시작하는 JSON 블록) */}
          {strategyKind !== 'method' && editorMode === 'code' && (
            <Card className="editor-card-product flex flex-col border border-slate-200/90 dark:border-slate-700 min-h-0 rounded-[8px]">
              <div className="shrink-0 px-3 pt-3 pb-0">
                <div className="rounded-[8px] border border-slate-200/90 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5">
                  <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-snug">
                    외부 에디터에서 작성한 코드를 붙여넣을 수 있습니다. 오른쪽에서 결과가 갱신됩니다.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setStrategyCode(AI_PASTE_SAMPLE_CODE)
                        setUiErrors((p) => ({ ...p, code: undefined }))
                      }}
                    >
                      샘플 코드 삽입
                    </Button>
                  </div>
                </div>
              </div>
              <Card.Header className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div>
                  <Card.Title>전략 코드</Card.Title>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    DSL 섹션(entry / risk 등) 또는 {'{'} 로 시작하는 JSON 전략
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setStrategyCode(DEFAULT_STRATEGY_CODE_TEMPLATE)}
                  >
                    기본 템플릿
                  </Button>
                  <Badge variant={codeAutoError ? 'warning' : codeAutoRunning ? 'info' : 'default'}>
                    {codeAutoError ? '오류' : codeAutoRunning ? '실행 중' : '준비됨'}
                  </Badge>
                </div>
              </Card.Header>
              {uiErrors.code && (
                <div className="mx-3 mb-0 px-2.5 py-2 rounded-lg text-[11px] shrink-0 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300">
                  {uiErrors.code}
                </div>
              )}
              {codeAutoError && (
                <div className="mx-3 mb-0 px-2.5 py-2 rounded-lg text-[11px] shrink-0 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300">
                  {codeAutoError}
                </div>
              )}
              {!dslOrJsonPayload && strategyCode.trim() && (
                <div className="mx-3 mb-0 px-2.5 py-2 rounded-lg text-[11px] shrink-0 bg-amber-50/90 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {String(strategyCode ?? '').trim().startsWith('{')
                    ? (() => {
                        const pj = tryParseStrategyJson(strategyCode)
                        return pj.ok
                          ? 'JSON은 유효하지만 conditions가 비어 있을 수 있습니다.'
                          : `${pj.message}${pj.pos != null ? ` (문자 위치 ${pj.pos})` : ''}`
                      })()
                    : formatParseError(strategyCodeParseResult)}
                </div>
              )}
              <Card.Content className="flex-1 p-0 min-h-0 flex flex-col px-3 pb-3 pt-0">
                <p className="text-[10px] text-slate-500 mb-1 px-0.5">
                  <kbd className="px-1 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px]">Ctrl</kbd>
                  +<kbd className="px-1 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px]">Space</kbd> 자동완성 · 오류 줄에 마우스를 올리면 이유가 보입니다.
                </p>
                <p className="text-[10px] text-slate-500 mb-2 px-0.5 border-l-2 border-blue-200 dark:border-blue-900/50 pl-2">
                  외부 AI에서 생성한 전략 코드를 붙여넣고, 필요하면 직접 고친 뒤 오른쪽에서 수치를 확인하세요.
                </p>
                <StrategyCodeEditor
                  value={strategyCode}
                  onChange={(v) => {
                    setStrategyCode(v)
                    setUiErrors((p) => ({ ...p, code: undefined }))
                  }}
                  errorMarker={monacoErrorMarker}
                  height={editorMode === 'code' ? 520 : 400}
                />
              </Card.Content>
            </Card>
          )}
        </section>

        {/* ── 우측: 결과 패널 (항상 표시, sticky) ───────────── */}
        <aside className="editor-right min-w-0 w-full xl:sticky xl:top-4 self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <SectionErrorBoundary title="결과 미리보기 오류" fallbackDescription="미리보기 계산 중 문제가 생겼습니다. 다시 시도하거나 입력을 확인해 주세요.">
          <Card className="editor-card-product">
            <Card.Header className="flex items-start justify-between gap-2">
              <div>
                <Card.Title>결과 프리뷰</Card.Title>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  자산·조건·기간이 바뀌면 왼쪽 입력과 동일한 설정으로 미리보기가 갱신됩니다. 테스트 버튼은 그 시점 스냅샷을 고정해 두고 싶을 때 쓰면 됩니다.
                </p>
                <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 border-l-2 border-blue-200 dark:border-blue-900/50 pl-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">상태 요약 · </span>
                  {oneLineSummary || '이름·조건·자산을 채우면 여기에 한 줄로 요약됩니다.'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="default">{asset || '—'} · {TIMEFRAME_LABEL[timeframe] ?? timeframe}</Badge>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDraft}
                    disabled={saveLoading || submittingMarket || !currentUser || saveLimitReached}
                  >
                    저장
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRunTest}
                    disabled={testRunning || strategyKind === 'method'}
                  >
                    {testRunning ? '실행 중…' : '테스트'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={saveLoading || submittingMarket || saveLimitReached || !currentUser}
                  >
                    {submittingMarket ? '제출 중…' : '마켓 제출'}
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="space-y-3">
              {(previewError || testError) && (
                <div className="rounded-[8px] border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/25 px-3 py-2.5 space-y-1">
                  {previewError && <p className="text-[11px] text-red-700 dark:text-red-300">{previewError}</p>}
                  {testError && <p className="text-[11px] text-red-700 dark:text-red-300">{testError}</p>}
                </div>
              )}

              {/* 차트 — 데이터 있으면 표시, 없으면 placeholder */}
              {strategyKind !== 'method' && (
                <div>
                  <SectionHeader
                    title="차트 미리보기"
                    sub={
                      testResult
                        ? `${Array.isArray(testResult.signals) ? testResult.signals.length : 0}건 시그널 · 테스트 스냅샷`
                        : previewPhase === 'ok'
                          ? '자동 미리보기 · 진입·청산 마커'
                          : '가격과 시그널'
                    }
                  />
                  {previewCandles?.length > 0 && previewPhase === 'ok' ? (
                    <div className="rounded-[8px] border border-slate-200 dark:border-gray-800 overflow-hidden bg-slate-50/30 dark:bg-gray-950/20 h-[220px]">
                      <CandlestickChart
                        candles={previewCandles}
                        entries={previewChartIndices.entryIdxs}
                        exits={previewChartIndices.exitIdxs}
                        openEntry={(testResult?.openPos ?? previewOpenPos)?.entryPrice ?? null}
                        openDir={(testResult?.openPos ?? previewOpenPos)?.type ?? 'LONG'}
                        openPnlPct={(testResult?.openPos ?? previewOpenPos)?.pnlPct ?? null}
                        emphasizeOpen={Boolean(testResult?.openPos ?? previewOpenPos)}
                        strategyName={name?.trim() || '미리보기'}
                      />
                    </div>
                  ) : (
                    <div className="rounded-[8px] border border-dashed border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/20 h-[200px] flex flex-col items-center justify-center px-4 text-center">
                      <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400">
                        {previewPhase === 'loading' ? '차트 데이터 불러오는 중…' : '여기에 캔들과 시그널이 표시됩니다'}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500 leading-relaxed max-w-[280px]">
                        {editorMode === 'builder'
                          ? '자산과 진입 조건을 정하면 자동으로 계산돼요.'
                          : '자산·코드가 유효하면 자동 실행됩니다. 붙여넣은 뒤에도 바로 반영됩니다.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* KPI — 항상 4칸 */}
              <div>
                <SectionHeader
                  title="성과 요약"
                  sub={testResult
                    ? `최근 ${testResult.meta?.klineLimit ?? klineLimit}봉 · ${PREVIEW_PERIOD_OPTIONS.find((x) => x.id === previewPeriodKey)?.label ?? previewPeriodKey}`
                    : '테스트 실행 후 숫자가 채워집니다'}
                />
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    label="수익률"
                    value={testResult ? formatDisplayPct(kpi?.roi) : '—'}
                    valueClassName={testResult && Number(kpi?.roi ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : testResult ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}
                    className="rounded-[8px] border-slate-200 dark:border-gray-700 shadow-none"
                  />
                  <StatCard
                    label="MDD"
                    value={testResult ? formatDisplayMdd(kpi?.mdd) : '—'}
                    trend={testResult ? 'down' : undefined}
                    valueClassName={testResult ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}
                    className="rounded-[8px] border-red-200/70 dark:border-red-900/40 shadow-none"
                  />
                  <StatCard
                    label="승률"
                    value={testResult ? formatDisplayWinRate(kpi?.winRate) : '—'}
                    className="rounded-[8px] border-slate-200 dark:border-gray-700 shadow-none"
                  />
                  <StatCard
                    label="거래 수"
                    value={testResult ? `${kpi?.totalTrades ?? 0}` : '—'}
                    className="rounded-[8px] border-slate-200 dark:border-gray-700 shadow-none"
                  />
                </div>
              </div>

              {/* 최근 거래 */}
              <div>
                <SectionHeader title="최근 거래" sub="최근 10건" />
                {!testResult ? (
                  <p className="text-[11px] text-slate-500 border border-dashed border-slate-200 dark:border-gray-700 rounded-[8px] px-3 py-3">아직 결과 없음 · 테스트 실행 또는 자동 계산을 기다려 주세요</p>
                ) : recentTrades.length === 0 ? (
                  <p className="text-[11px] text-slate-500">아직 체결된 거래가 없습니다</p>
                ) : (
                  <div className="border border-slate-200 dark:border-gray-800 rounded-[8px] overflow-hidden">
                    {recentTrades.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 border-slate-50 dark:border-gray-800/60">
                        <Badge variant={t.dir === 'LONG' ? 'long' : 'short'} className="text-[9px]">
                          {t.dir}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-500 tabular-nums flex-1 truncate">
                          {t.entryTime ?? t.entry ?? '—'} → {t.exitTime ?? t.exit ?? '—'}
                        </span>
                        <span className={cn('text-[11px] font-mono font-bold tabular-nums', t.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                          {t.pnl >= 0 ? '+' : ''}{t.pnl}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 현재 포지션 */}
              <div>
                <SectionHeader title="현재 포지션" sub="마지막 가격 기준" />
                <div className="rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5">
                  {!testResult ? (
                    <p className="text-[11px] text-slate-500">결과가 없습니다</p>
                  ) : !openPos ? (
                    <p className="text-[11px] text-slate-500">오픈 포지션 없음</p>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={openPos.type === 'LONG' ? 'long' : 'short'}>{openPos.type}</Badge>
                      <span className={cn('text-[12px] font-mono font-bold tabular-nums', openPos.pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {openPos.pnlPct >= 0 ? '+' : ''}{openPos.pnlPct}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 경고/검증 */}
              <div>
                <SectionHeader title="경고 · 검증 상태" sub="제출 전 확인" />
                {warnings.length === 0 ? (
                  <p className="text-[11px] text-slate-500">특이사항 없음</p>
                ) : (
                  <div className="rounded-[8px] border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2.5">
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900 dark:text-amber-200">
                      {warnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                    {!canSubmitToMarket && (
                      <button
                        type="button"
                        onClick={goMypageSubscription}
                        className="mt-2 text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        Pro 플랜 안내 →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!hasPaidPlanFeatures(user) && testResult && (
                <div className="rounded-[8px] border border-slate-200 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-800/25 px-3 py-3 space-y-2">
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    {UPSELL_COPY.editorAfterTest}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-snug">
                    {UPSELL_COPY.fullAccessHint}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      onClick={() => onSubscribe?.()}
                    >
                      {UPSELL_COPY.ctaSubscribe}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => onStartTrial?.()}
                    >
                      {UPSELL_COPY.ctaTrial}
                    </Button>
                  </div>
                </div>
              )}
            </Card.Content>
          </Card>
          </SectionErrorBoundary>
        </aside>
      </div>

    </PageShell>
  )
}

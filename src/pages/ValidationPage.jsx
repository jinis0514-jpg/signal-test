import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, Lock, FileText, TrendingDown, TrendingUp, Waves, CircleHelp } from 'lucide-react'
import PageShell    from '../components/ui/PageShell'
import PageHeader   from '../components/ui/PageHeader'
import Card         from '../components/ui/Card'
import Badge, { dirVariant } from '../components/ui/Badge'
import Button       from '../components/ui/Button'
import Skeleton, { ChartSkeleton } from '../components/ui/Skeleton'
import EmptyState   from '../components/ui/EmptyState'
import SectionErrorBoundary from '../components/ui/SectionErrorBoundary'
import { cn }       from '../lib/cn'
import {
  VAL_STRATEGIES,
  PERIODS,
  TIMEFRAME_TO_KLINES_INTERVAL,
} from '../data/validationMockData'
import { STRATEGIES as SIM_STRATEGIES, CHART_DATA } from '../data/simulationMockData'
import { isSimLocked, PLAN_MESSAGES, navigateToSubscriptionSection } from '../lib/userPlan'
import { isUserStrategyId, getUserStrategyById, ASSET_TO_SIM_ID } from '../lib/userStrategies'
import { getCachedKlines } from '../lib/priceCache'
import {
  normalizePrices,
  generateSignalsFromPrices,
  calculateTradeHistory,
  calculatePerformance,
  buildEngineConfigFromUserStrategy,
  buildCatalogStrategyEngineConfig,
} from '../lib/strategyEngine'
import { runStrategy } from '../lib/runStrategy'
import {
  filterCandlesByPeriod,
  extendedPerf,
} from '../lib/validationMetrics'
import { buildValidationImprovementHints } from '../lib/validationImprovementHints'
import { buildRetentionRiskAlerts } from '../lib/retentionAlerts'
import CandlestickChart from '../components/simulation/CandlestickChart'
import EquityCurve from '../components/validation/EquityCurve'
import { KPI } from '../components/validation/ValidationUi'
import RealTradeVerificationStack, { VerificationTierPill } from '../components/validation/RealTradeVerificationStack'
import { buildRealTradeVerificationView } from '../lib/realTradeVerificationUi'
import { computeRecentRoiPct } from '../lib/marketStrategy'
import { formatDisplayPct, formatDisplayMdd, formatDisplayWinRate, formatDisplayTradeCount } from '../lib/strategyDisplayMetrics'
import { computeStrategyStatus, TRUST_LEVEL } from '../lib/strategyTrust'
import { panelBase, panelSoft, panelPositive, panelWarning, panelDanger, panelEmphasis } from '../lib/panelStyles'
import { evaluateStrategyWithMarket } from '../lib/strategyEvaluator'
import {
  getAssetClassFromStrategy,
  getValidationPairsForAssetClass,
  resolveAltValidationPairs,
  ALT_BASKET_LABEL_DETAIL,
  ALT_VALIDATION_MIN,
  copy as assetCopy,
} from '../lib/assetValidationUniverse'
import { runAggregatedValidationForPairs } from '../lib/altBasketBacktest'
import { buildAltValidationResult } from '../lib/altValidationPresentation'
import { safeArray } from '../lib/safeValues'
import { groupByEntryCombo } from '../lib/tradeComboMetrics'
import { buildStrategyBreakdown } from '../lib/strategyBreakdown'
import StrategyBreakdownSection from '../components/validation/StrategyBreakdownSection'
import { buildStrategyRiskBreakdown } from '../lib/strategyRiskBreakdown'
import StrategyRiskBreakdownSection from '../components/validation/StrategyRiskBreakdownSection'
import { classifyMarketState } from '../lib/marketStateEngine'
import { buildStrategyScenario, getScenarioSummary } from '../lib/strategyScenarioEngine'
import { computeTrustScore, getTrustGrade } from '../lib/strategyTrustScore'

const PERIOD_RATIO = { '3M': 0.25, '6M': 0.5, 'YTD': 0.18, '1Y': 1.0, '3Y': 1.0, 'ALL': 1.0 }

function fmtMd(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}`
}

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function fmtPct(v, digits = 1) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
}

function fmtTs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Date(n).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function holdingLabel(entryTime, exitTime) {
  const a = Number(entryTime)
  const b = Number(exitTime)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return '—'
  const ms = b - a
  const hours = ms / 3600000
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`
  return `${Math.max(1, Math.round(hours / 24))}d`
}

function maxConsecutiveLosses(trades) {
  if (!Array.isArray(trades)) return 0
  let cur = 0
  let best = 0
  for (const t of trades) {
    const pnl = Number(t.pnl)
    if (!Number.isFinite(pnl)) continue
    if (pnl < 0) {
      cur += 1
      best = Math.max(best, cur)
    } else {
      cur = 0
    }
  }
  return best
}

function topTradeConcentration(trades, topN = 5) {
  if (!Array.isArray(trades)) return null
  const pnls = trades.map((t) => Number(t.pnl)).filter((p) => Number.isFinite(p))
  if (!pnls.length) return null
  const total = pnls.reduce((a, b) => a + b, 0)
  if (Math.abs(total) < 1e-9) return 0
  const sorted = [...pnls].sort((a, b) => Math.abs(b) - Math.abs(a))
  const top = sorted.slice(0, Math.max(1, topN)).reduce((a, b) => a + b, 0)
  return +((top / total) * 100).toFixed(1)
}

function recentWeakening(trades, window = 12) {
  if (!Array.isArray(trades)) return null
  const list = trades.filter((t) => Number.isFinite(Number(t.pnl)))
  if (list.length < window * 2) return null
  const a = list.slice(-window).reduce((s, t) => s + Number(t.pnl), 0)
  const b = list.slice(-(window * 2), -window).reduce((s, t) => s + Number(t.pnl), 0)
  return {
    recentSum: +a.toFixed(2),
    prevSum: +b.toFixed(2),
    weakened: a < b,
  }
}

function computeEntryConfidence(trade, strategyConfig) {
  // deterministic heuristic (0~100). "맹신 방지": 근거가 부족하거나 변동성이 높을수록 점수 낮게.
  const conds = Array.isArray(strategyConfig?.conditions) ? strategyConfig.conditions.length : 0
  const hasNote = String(trade?.entryNote ?? '').trim().length > 0
  const base = 48 + Math.min(20, conds * 3) + (hasNote ? 8 : 0)
  const exitReason = String(trade?.exitReason ?? '')
  const penalty = exitReason === 'stop' ? 10 : exitReason === 'atr' ? 6 : 0
  return Math.max(0, Math.min(100, Math.round(base - penalty)))
}

function classifyRegime(candles, idx) {
  // 매우 단순/설명 가능한 분류: N봉 수익률 기반 추세 + rolling range 기반 변동성
  const look = 24
  if (!candles?.length || idx < look) return { trend: '횡보장', vol: '저변동성' }
  const a = candles[idx - look]?.close
  const b = candles[idx]?.close
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return { trend: '횡보장', vol: '저변동성' }
  const ret = ((b - a) / a) * 100
  const trend = ret > 2.0 ? '상승장' : ret < -2.0 ? '하락장' : '횡보장'

  let hi = -Infinity
  let lo = Infinity
  for (let i = idx - look; i <= idx; i++) {
    hi = Math.max(hi, candles[i]?.high ?? -Infinity)
    lo = Math.min(lo, candles[i]?.low ?? Infinity)
  }
  const rangePct = (hi - lo) / a * 100
  const vol = rangePct >= 4.0 ? '고변동성' : '저변동성'
  return { trend, vol }
}

function computeMfeMaePct(trade, candles, entryIdx, exitIdx) {
  if (!candles?.length) return { mfe: null, mae: null }
  if (entryIdx == null || exitIdx == null) return { mfe: null, mae: null }
  const e = Number(trade.entry)
  if (!Number.isFinite(e) || e <= 0) return { mfe: null, mae: null }
  const dir = trade.dir
  let best = -Infinity
  let worst = Infinity
  for (let i = entryIdx; i <= exitIdx; i++) {
    const c = candles[i]
    if (!c) continue
    const hi = Number(c.high)
    const lo = Number(c.low)
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue
    if (dir === 'LONG') {
      best = Math.max(best, (hi - e) / e * 100)
      worst = Math.min(worst, (lo - e) / e * 100)
    } else {
      best = Math.max(best, (e - lo) / e * 100)
      worst = Math.min(worst, (e - hi) / e * 100)
    }
  }
  if (!Number.isFinite(best) || !Number.isFinite(worst)) return { mfe: null, mae: null }
  return { mfe: +best.toFixed(2), mae: +worst.toFixed(2) }
}

/* 빈 배열 방어용 기본 항목 */
const FALLBACK_VAL_STRATEGY = { id: 'btc-trend', name: 'BTC 트렌드', asset: 'BTCUSDT', symbol: 'BTCUSDT' }
const FALLBACK_SIM_STRATEGY = { id: 'btc-trend', timeframe: '1h' }
const SAFE_VAL = VAL_STRATEGIES.length > 0 ? VAL_STRATEGIES : [FALLBACK_VAL_STRATEGY]
const SAFE_SIM = (arr) => arr.length > 0 ? arr : [FALLBACK_SIM_STRATEGY]

export default function ValidationPage({
  onNavigate,
  onGoSimulation,
  selectedStrategyId,
  user,
  onStartTrial,
  userStrategies = [],
}) {
  const [strategyId, setStrategyId] = useState(
    () => {
      const defaultId = SAFE_VAL[0].id
      if (!selectedStrategyId) return defaultId
      if (isUserStrategyId(selectedStrategyId)) return selectedStrategyId
      return SAFE_VAL.find((s) => s.id === selectedStrategyId)
        ? selectedStrategyId
        : defaultId
    },
  )
  const [period, setPeriod] = useState('1Y')
  const [selectedTradeId, setSelectedTradeId] = useState(null)
  const [tradeDateFrom, setTradeDateFrom] = useState('')
  const [tradeDateTo, setTradeDateTo] = useState('')
  const [tradeQuery, setTradeQuery] = useState('')
  const [tradeSideFilter, setTradeSideFilter] = useState('ALL')
  const [tradeSort, setTradeSort] = useState('latest')
  const [validationNavSection, setValidationNavSection] = useState('summary')
  /** 카탈로그 전략만, 최대 3개 — 검증 탭「전략 비교」표용 */
  const [comparePickIds, setComparePickIds] = useState([])

  const userStrat = isUserStrategyId(strategyId)
    ? (userStrategies.find((s) => s.id === strategyId) ?? getUserStrategyById(strategyId))
    : null

  useEffect(() => {
    setValidationNavSection('summary')
  }, [strategyId])

  useEffect(() => {
    if (userStrat) setComparePickIds([])
  }, [userStrat])

  const [validationPrices, setValidationPrices] = useState([])
  const [validationCandles, setValidationCandles] = useState([])
  const [validationLoading, setValidationLoading] = useState(true)
  const [validationError, setValidationError] = useState('')
  /** ALT 바스켓: 멀티 심볼 백테스트 후 primaryPipe + 평균 성과 */
  const [basketRun, setBasketRun] = useState(null)

  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: ['btc-trend'] }

  const mockValId = userStrat
    ? (ASSET_TO_SIM_ID[userStrat.asset] ?? SAFE_VAL[0].id)
    : strategyId

  const effectiveId = SAFE_VAL.some((s) => s.id === mockValId) ? mockValId : SAFE_VAL[0].id

  const locked = isSimLocked(effectiveId, u)
  const strategy = SAFE_VAL.find((s) => s.id === effectiveId) ?? SAFE_VAL[0] ?? FALLBACK_VAL_STRATEGY
  const simMeta = SAFE_SIM(SIM_STRATEGIES).find((s) => s.id === effectiveId) ?? SAFE_SIM(SIM_STRATEGIES)[0]

  const validationAssetClass = useMemo(() => {
    if (userStrat) return getAssetClassFromStrategy(userStrat)
    const sid = strategy?.id ?? ''
    if (sid === 'alt-basket') return 'ALT'
    const sym = String(strategy?.symbol ?? 'BTCUSDT').toUpperCase()
    if (sym.startsWith('ETH')) return 'ETH'
    if (sym.startsWith('SOL')) return 'SOL'
    return 'BTC'
  }, [userStrat, strategy?.id, strategy?.symbol])

  const validationStrategyLike = useMemo(() => {
    if (userStrat) return userStrat
    if (validationAssetClass === 'ALT') return { asset: 'ALT' }
    return { asset: validationAssetClass }
  }, [userStrat, validationAssetClass])

  const { pairs: validationPairs, error: validationPairsError } = useMemo(
    () => resolveAltValidationPairs(validationStrategyLike),
    [validationStrategyLike],
  )

  const isAltBasketValidation = validationAssetClass === 'ALT'
  const primaryValidationPair = validationPairs[0] ?? 'BTCUSDT'

  const interval = useMemo(() => {
    return TIMEFRAME_TO_KLINES_INTERVAL[simMeta.timeframe] ?? '1h'
  }, [simMeta.timeframe])

  useEffect(() => {
    let cancelled = false

    async function loadValidationData() {
      try {
        setValidationLoading(true)
        setValidationError('')
        setValidationCandles([])
        setValidationPrices([])
        setBasketRun(null)

        if (isAltBasketValidation) {
          const pErr = validationPairsError
          const pairs = validationPairs
          if (pErr || pairs.length < ALT_VALIDATION_MIN) {
            if (!cancelled) {
              setValidationError(
                pErr
                  || `ALT 검증에는 Binance USDT 심볼을 ${ALT_VALIDATION_MIN}개 이상 선택해야 합니다.`,
              )
              setValidationCandles([])
              setValidationPrices([])
              setBasketRun(null)
              setValidationLoading(false)
            }
            return
          }
          const agg = await runAggregatedValidationForPairs({
            pairs,
            interval,
            limit: 500,
            period,
            makeRunStrategyArgs: (aligned, sym) => {
              if (userStrat) {
                return [null, { strategyConfig: buildEngineConfigFromUserStrategy(userStrat, { candles: aligned }) }]
              }
              return [
                null,
                {
                  strategyConfig: buildCatalogStrategyEngineConfig(
                    { id: effectiveId, symbol: sym, timeframe: simMeta.timeframe },
                    { candles: aligned },
                  ),
                },
              ]
            },
          })
          if (cancelled) return
          if (!agg.primaryCandles.length) {
            setValidationError('ALT 바스켓 캔들을 불러오지 못했습니다.')
            setValidationLoading(false)
            return
          }
          setValidationCandles(agg.primaryCandles)
          setValidationPrices(
            agg.primaryCandles.map((c) => ({
              time: c.time,
              price: c.close,
            })),
          )
          setBasketRun({
            primaryPipe: agg.primaryPipe,
            averagedPerf: agg.averagedPerf,
            recent7dAvg: agg.recent7dAvg,
            recent30dAvg: agg.recent30dAvg,
            basketDetail: agg.basketDetail,
            validationResult: agg.validationResult
              ?? buildAltValidationResult(agg.averagedPerf, agg.basketDetail),
          })
          setValidationLoading(false)
          return
        }

        const singlePair = validationPairs[0] ?? getValidationPairsForAssetClass(validationAssetClass)[0] ?? 'BTCUSDT'
        const candles = await getCachedKlines(singlePair, interval, 500)
        if (cancelled) return

        setValidationCandles(candles)
        setValidationPrices(
          candles.map((c) => ({
            time: c.time,
            price: c.close,
          })),
        )
      } catch (e) {
        if (!cancelled) {
          console.error('Validation klines load failed:', e)
          setValidationError(e?.message ?? '검증 데이터 조회 실패')
          setValidationCandles([])
          setValidationPrices([])
        }
      } finally {
        if (!cancelled) setValidationLoading(false)
      }
    }

    loadValidationData()

    return () => {
      cancelled = true
    }
  }, [
    isAltBasketValidation,
    validationPairs,
    validationPairsError,
    primaryValidationPair,
    interval,
    period,
    userStrat,
    effectiveId,
    simMeta.timeframe,
    validationAssetClass,
  ])

  /** 시뮬레이션 CHART_DATA 기반 폴백 (엔진 입력용 숫자 시리즈) */
  const fallbackMockPrices = useMemo(() => {
    const ch = CHART_DATA[effectiveId]
    if (!ch?.prices?.length) return []
    return ch.prices.map((p, i) => ({ time: i, price: p }))
  }, [effectiveId])

  const effectivePrices = useMemo(() => {
    if (validationPrices.length > 0) return validationPrices
    if (validationLoading) return []
    return fallbackMockPrices.length ? fallbackMockPrices : []
  }, [validationPrices, validationLoading, fallbackMockPrices])

  const hasExchangeData = validationPrices.length > 0 && !validationError
  const useMockFallback = !validationLoading && validationPrices.length === 0 && fallbackMockPrices.length > 0

  /** 기간 슬라이스: 실데이터는 캔들 타임스탬프, 폴백은 비율 슬라이스 */
  const engineInputPrices = useMemo(() => {
    if (!effectivePrices.length) return []
    if (hasExchangeData && validationCandles.length > 0) {
      const ref = validationCandles[validationCandles.length - 1].time
      const filtered = filterCandlesByPeriod(validationCandles, period, ref)
      return filtered.map((c) => ({ time: c.time, price: c.close }))
    }
    const ratio = PERIOD_RATIO[period] ?? 1
    return ratio >= 1 ? [...effectivePrices] : effectivePrices.slice(Math.floor(effectivePrices.length * (1 - ratio)))
  }, [effectivePrices, hasExchangeData, validationCandles, period])

  /** 엔진 입력과 동일 기간의 OHLCV (조건·거래량 지표용) */
  const engineCandlesAligned = useMemo(() => {
    if (!hasExchangeData || !validationCandles.length) return undefined
    const ref = validationCandles[validationCandles.length - 1].time
    return filterCandlesByPeriod(validationCandles, period, ref)
  }, [hasExchangeData, validationCandles, period])

  const strategyConfig = useMemo(() => {
    if (userStrat) {
      return buildEngineConfigFromUserStrategy(userStrat, { candles: engineCandlesAligned })
    }
    return buildCatalogStrategyEngineConfig(
      { id: effectiveId, symbol: primaryValidationPair, timeframe: simMeta.timeframe },
      { candles: engineCandlesAligned },
    )
  }, [userStrat, engineCandlesAligned, effectiveId, primaryValidationPair, simMeta.timeframe])

  const enginePrices = useMemo(
    () => normalizePrices(engineInputPrices),
    [engineInputPrices],
  )

  const candlesForStrategy = useMemo(() => {
    if (engineCandlesAligned?.length) return engineCandlesAligned
    if (!engineInputPrices.length) return []
    return engineInputPrices.map((p) => ({
      time: p.time,
      open: p.price,
      high: p.price,
      low: p.price,
      close: p.price,
      volume: 0,
    }))
  }, [engineCandlesAligned, engineInputPrices])

  const { pipe, pipeError } = useMemo(() => {
    if (!enginePrices.length || !candlesForStrategy.length) return { pipe: null, pipeError: '' }
    if (isAltBasketValidation) {
      if (!basketRun?.primaryPipe) return { pipe: null, pipeError: '' }
      return {
        pipe: {
          ...basketRun.primaryPipe,
          performance: {
            ...basketRun.averagedPerf,
            totalTrades: basketRun.averagedPerf.totalTrades,
          },
        },
        pipeError: '',
      }
    }
    try {
      return {
        pipe: runStrategy(candlesForStrategy, null, { strategyConfig }),
        pipeError: '',
      }
    } catch (e) {
      return { pipe: null, pipeError: String(e?.message ?? e ?? '엔진 실행 실패') }
    }
  }, [enginePrices, strategyConfig, candlesForStrategy, isAltBasketValidation, basketRun])

  const engineTrades = Array.isArray(pipe?.trades) ? pipe.trades : []
  const engineSignals = Array.isArray(pipe?.signals) ? pipe.signals : []

  // pipe.performance는 runStrategy → runEnginePipeline과 동일한 성과 산출
  const perf = pipe?.performance ?? { roi: 0, winRate: 0, totalTrades: 0, mdd: 0 }

  const ext = useMemo(
    () => extendedPerf(engineTrades),
    [engineTrades],
  )

  const lastPrice = enginePrices.length ? enginePrices[enginePrices.length - 1].price : 0

  const pd = useMemo(() => ({
    roi: safeNum(perf?.roi, 0),
    winRate: safeNum(perf?.winRate, 0),
    mdd: safeNum(perf?.mdd, 0),
    trades: safeNum(perf?.totalTrades, 0),
    sharpe: safeNum(ext?.sharpe, 0),
    profitFactor: safeNum(ext?.profitFactor, 0),
    avgWin: safeNum(ext?.avgWin, 0),
    avgLoss: safeNum(ext?.avgLoss, 0),
  }), [perf, ext])

  const toggleComparePick = (id) => {
    if (!id || id === 'alt-basket') return
    setComparePickIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  const strategyCompareRows = useMemo(() => {
    if (userStrat || isAltBasketValidation || !comparePickIds.length) return []
    if (!candlesForStrategy.length) return []
    return comparePickIds.map((cid) => {
      const meta = SAFE_VAL.find((s) => s.id === cid)
      const simRow = SAFE_SIM(SIM_STRATEGIES).find((s) => s.id === cid) ?? SAFE_SIM(SIM_STRATEGIES)[0]
      const cfg = buildCatalogStrategyEngineConfig(
        { id: cid, symbol: primaryValidationPair, timeframe: simRow.timeframe },
        { candles: engineCandlesAligned },
      )
      try {
        const p = runStrategy(candlesForStrategy, null, { strategyConfig: cfg })
        const perf = p?.performance ?? {}
        const roi = safeNum(perf.roi, 0)
        const winRate = safeNum(perf.winRate, 0)
        const mdd = safeNum(perf.mdd, 0)
        const trades = safeNum(perf.totalTrades, 0)
        const live30 = computeRecentRoiPct(
          Array.isArray(p?.trades) ? p.trades : [],
          engineCandlesAligned?.length ? { endTime: engineCandlesAligned[engineCandlesAligned.length - 1].time } : {},
          30,
        )
        const st = computeStrategyStatus({ performance: perf, backtestMeta: {} })
        const score = computeTrustScore({
          matchRate: 0,
          verifiedReturn: 0,
          liveReturn30d: live30 ?? 0,
          maxDrawdown: Math.abs(mdd),
          tradeCount: trades,
          hasRealVerification: false,
        })
        const tg = getTrustGrade(score)
        return {
          id: cid,
          name: meta?.name ?? cid,
          type: meta?.type ?? '—',
          roi,
          winRate,
          mdd,
          status: st,
          trustLabel: tg.label,
        }
      } catch (e) {
        return {
          id: cid,
          name: meta?.name ?? cid,
          type: meta?.type ?? '—',
          error: String(e?.message ?? e ?? '계산 실패'),
        }
      }
    })
  }, [
    userStrat,
    isAltBasketValidation,
    comparePickIds,
    candlesForStrategy,
    primaryValidationPair,
    engineCandlesAligned,
  ])

  const recent7d = useMemo(() => {
    if (basketRun) return basketRun.recent7dAvg
    return computeRecentRoiPct(
      engineTrades,
      engineCandlesAligned?.length ? { endTime: engineCandlesAligned[engineCandlesAligned.length - 1].time } : {},
      7,
    )
  }, [basketRun, engineTrades, engineCandlesAligned])

  const recent30d = useMemo(() => {
    if (basketRun) return basketRun.recent30dAvg
    return computeRecentRoiPct(
      engineTrades,
      engineCandlesAligned?.length ? { endTime: engineCandlesAligned[engineCandlesAligned.length - 1].time } : {},
      30,
    )
  }, [basketRun, engineTrades, engineCandlesAligned])

  const altValidationView = useMemo(() => {
    if (!basketRun) return null
    return basketRun.validationResult
      ?? buildAltValidationResult(basketRun.averagedPerf, basketRun.basketDetail)
  }, [basketRun])

  const strategyStatus = useMemo(
    () => computeStrategyStatus({ performance: pipe?.performance ?? {}, backtestMeta: { endTime: engineCandlesAligned?.at?.(-1)?.time, timeframe: interval } }),
    [pipe?.performance, engineCandlesAligned, interval],
  )

  /** 마지막 엔진 시그널 기준 포지션 (백테스트 구간 끝 시점) */
  const currentPositionLabel = useMemo(() => {
    if (!engineSignals?.length) return '대기'
    const last = engineSignals[engineSignals.length - 1]
    const d = String(last?.dir ?? '').toUpperCase()
    if (d === 'LONG' || d === 'BUY') return 'LONG'
    if (d === 'SHORT' || d === 'SELL') return 'SHORT'
    return '대기'
  }, [engineSignals])

  const stats2 = useMemo(() => {
    const pnls = engineTrades.map((t) => Number(t.pnl)).filter((p) => Number.isFinite(p))
    const wins = pnls.filter((p) => p > 0)
    const losses = pnls.filter((p) => p < 0)
    const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0
    const rr = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : null
    return {
      avgWin: +avgWin.toFixed(2),
      avgLoss: +avgLoss.toFixed(2),
      rr: rr != null ? +rr.toFixed(2) : null,
      maxLosingStreak: maxConsecutiveLosses(engineTrades),
      topConcentration: topTradeConcentration(engineTrades, 5),
      weakening: recentWeakening(engineTrades, 12),
    }
  }, [engineTrades])

  const comboRows = useMemo(() => groupByEntryCombo(engineTrades).slice(0, 12), [engineTrades])

  const candleIndexByTime = useMemo(() => {
    const map = new Map()
    const cs = engineCandlesAligned ?? []
    for (let i = 0; i < cs.length; i++) map.set(cs[i].time, i)
    return map
  }, [engineCandlesAligned])

  const tradeRows = useMemo(() => {
    const cs = engineCandlesAligned ?? []
    return engineTrades.map((t, i) => {
      const entryIdx = candleIndexByTime.get(t.entryTime) ?? null
      const exitIdx = candleIndexByTime.get(t.exitTime) ?? null
      const mfeMae = computeMfeMaePct(t, cs, entryIdx, exitIdx)
      const reg = entryIdx != null ? classifyRegime(cs, entryIdx) : { trend: '—', vol: '—' }
      return {
        id: t.id ?? String(i + 1),
        i,
        dir: t.dir,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        entry: t.entry,
        exit: t.exit,
        pnl: t.pnl,
        win: t.win,
        exitReason: t.exitReason,
        entryNote: t.entryNote,
        exitNote: t.exitNote,
        holding: holdingLabel(t.entryTime, t.exitTime),
        entryIdx,
        exitIdx,
        mfe: mfeMae.mfe,
        mae: mfeMae.mae,
        trend: reg.trend,
        vol: reg.vol,
        confidence: computeEntryConfidence(t, strategyConfig),
      }
    })
  }, [engineTrades, engineCandlesAligned, candleIndexByTime, strategyConfig])

  const strategyBreakdown = useMemo(
    () => buildStrategyBreakdown({
      trades: tradeRows,
      performance: {
        winRate: pd.winRate,
        mdd: pd.mdd,
        roi: pd.roi,
        totalTrades: pd.trades,
      },
      comboRows,
      assetHint: validationAssetClass === 'ALT' ? 'ALT' : '',
    }),
    [tradeRows, comboRows, pd.winRate, pd.mdd, pd.roi, pd.trades, validationAssetClass],
  )

  const strategyRiskBreakdown = useMemo(
    () => buildStrategyRiskBreakdown({
      trades: engineTrades,
      tradeRows,
      performance: {
        mdd: pd.mdd,
        winRate: pd.winRate,
        totalTrades: pd.trades,
      },
    }),
    [engineTrades, tradeRows, pd.mdd, pd.winRate, pd.trades],
  )

  const liveTracking = useMemo(() => {
    if (!Array.isArray(tradeRows) || tradeRows.length === 0) {
      return {
        roi: null,
        recent7d: null,
        recent30d: null,
        trend: '데이터 부족',
        status: '대기',
        count: 0,
      }
    }
    const sampleN = Math.max(6, Math.floor(tradeRows.length * 0.35))
    const liveRows = tradeRows.slice(-sampleN)
    const roi = liveRows.reduce((s, t) => s + safeNum(t.pnl, 0), 0)
    const now = Date.now()
    const d7 = now - 7 * 24 * 3600000
    const d30 = now - 30 * 24 * 3600000
    const recent7dLive = liveRows
      .filter((t) => Number(t.exitTime) >= d7)
      .reduce((s, t) => s + safeNum(t.pnl, 0), 0)
    const recent30dLive = liveRows
      .filter((t) => Number(t.exitTime) >= d30)
      .reduce((s, t) => s + safeNum(t.pnl, 0), 0)
    const trend = recent7dLive >= 0 ? '상승 유지' : '약화 경고'
    const status = recent7dLive >= 0 ? '유효' : '주의'
    return {
      roi: +roi.toFixed(2),
      recent7d: +recent7dLive.toFixed(2),
      recent30d: +recent30dLive.toFixed(2),
      trend,
      status,
      count: liveRows.length,
    }
  }, [tradeRows])

  const validationMarketState = useMemo(() => {
    const cs = validationCandles
    if (!Array.isArray(cs) || cs.length < 4) {
      return classifyMarketState({
        btcChange24h: 0,
        ethChange24h: 0,
        avgRangePct: 0,
      })
    }
    const end = Number(cs[cs.length - 1]?.close)
    const start = Number(cs[Math.max(0, cs.length - 24)]?.close)
    const ch = Number.isFinite(end) && Number.isFinite(start) && start !== 0
      ? ((end - start) / start) * 100
      : 0
    let volSum = 0
    let volN = 0
    for (let i = 1; i < cs.length; i += 1) {
      const prev = Number(cs[i - 1]?.close)
      const cur = Number(cs[i]?.close)
      if (Number.isFinite(prev) && Number.isFinite(cur) && prev !== 0) {
        volSum += Math.abs((cur - prev) / prev) * 100
        volN += 1
      }
    }
    const avgRangePct = volN > 0 ? volSum / volN : Math.abs(ch) * 0.4
    return classifyMarketState({
      btcChange24h: ch,
      ethChange24h: ch * 0.85,
      avgRangePct,
    })
  }, [validationCandles])

  const validationTrustScore = useMemo(
    () => computeTrustScore({
      matchRate: 0,
      verifiedReturn: 0,
      liveReturn30d: Number(recent30d ?? 0),
      maxDrawdown: pd.mdd,
      tradeCount: pd.trades,
      hasRealVerification: false,
    }),
    [pd, recent30d],
  )

  const validationScenario = useMemo(() => {
    const r7 = recent7d != null && Number.isFinite(Number(recent7d))
      ? Number(recent7d)
      : Number(liveTracking.recent7d ?? 0)
    return buildStrategyScenario(
      {
        ...strategy,
        trustScore: validationTrustScore,
        recentRoi7d: r7,
        maxDrawdown: pd.mdd,
      },
      validationMarketState,
    )
  }, [strategy, validationTrustScore, recent7d, liveTracking, pd.mdd, validationMarketState])

  const validationScenarioSummary = useMemo(
    () => getScenarioSummary(validationScenario),
    [validationScenario],
  )

  const regimePerformanceRows = useMemo(() => {
    const buckets = [
      { key: '상승장', list: tradeRows.filter((t) => t.trend === '상승장') },
      { key: '하락장', list: tradeRows.filter((t) => t.trend === '하락장') },
      { key: '횡보장', list: tradeRows.filter((t) => t.trend === '횡보장') },
      { key: '고변동성', list: tradeRows.filter((t) => t.vol === '고변동성') },
      { key: '저변동성', list: tradeRows.filter((t) => t.vol === '저변동성') },
    ]
    return buckets.map((b) => {
      const trades = b.list
      const pnl = trades.reduce((s, t) => s + safeNum(t.pnl, 0), 0)
      const wins = trades.filter((t) => safeNum(t.pnl, 0) >= 0).length
      const winRate = trades.length ? (wins / trades.length) * 100 : null
      let interpretation = '표본 부족'
      if (trades.length >= 4) {
        interpretation = pnl >= 0 ? '현재 전략 우호' : '현재 전략 비우호'
      }
      return {
        key: b.key,
        pnl: +pnl.toFixed(2),
        trades: trades.length,
        winRate: winRate == null ? null : +winRate.toFixed(1),
        interpretation,
      }
    })
  }, [tradeRows])

  const filteredTradeRows = useMemo(() => {
    const q = String(tradeQuery ?? '').trim().toLowerCase()
    const fromTs = tradeDateFrom ? new Date(`${tradeDateFrom}T00:00:00`).getTime() : null
    const toTs = tradeDateTo ? new Date(`${tradeDateTo}T23:59:59`).getTime() : null
    const base = tradeRows.filter((t) => {
      const entryTs = Number(t.entryTime)
      if (fromTs != null && Number.isFinite(entryTs) && entryTs < fromTs) return false
      if (toTs != null && Number.isFinite(entryTs) && entryTs > toTs) return false
      if (tradeSideFilter !== 'ALL' && t.dir !== tradeSideFilter) return false
      if (!q) return true
      const hay = [
        t.dir,
        t.entryNote,
        t.exitReason,
        t.exitNote,
        t.trend,
        t.vol,
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
    return [...base].sort((a, b) => {
      const ta = Number(a.entryTime) || 0
      const tb = Number(b.entryTime) || 0
      return tradeSort === 'latest' ? tb - ta : ta - tb
    })
  }, [tradeRows, tradeQuery, tradeDateFrom, tradeDateTo, tradeSideFilter, tradeSort])

  const selectedTrade = useMemo(() => {
    if (!selectedTradeId) return null
    return tradeRows.find((t) => String(t.id) === String(selectedTradeId)) ?? null
  }, [selectedTradeId, tradeRows])

  const selectedTradeChart = useMemo(() => {
    if (!selectedTrade || !engineCandlesAligned?.length) return null
    const cs = engineCandlesAligned
    const e = selectedTrade.entryIdx
    const x = selectedTrade.exitIdx
    if (e == null || x == null) return null
    const pad = 18
    const start = Math.max(0, e - pad)
    const end = Math.min(cs.length - 1, x + pad)
    const slice = cs.slice(start, end + 1)
    const entryRel = e - start
    const exitRel = x - start
    return { slice, entryRel, exitRel }
  }, [selectedTrade, engineCandlesAligned])

  const roi1YHint = useMemo(() => {
    try {
      if (!hasExchangeData || !validationCandles.length) return null
      if (typeof generateSignalsFromPrices !== 'function') return null
      if (typeof calculateTradeHistory !== 'function') return null
      const ref = validationCandles[validationCandles.length - 1].time
      const y1 = filterCandlesByPeriod(validationCandles, '1Y', ref)
      if (!y1.length) return null
      const series = y1.map((c) => ({ time: c.time, price: c.close }))
      const sig = generateSignalsFromPrices(normalizePrices(series), strategyConfig)
      const tr = calculateTradeHistory(sig)
      const roi = calculatePerformance(tr)?.roi
      return roi ?? null
    } catch {
      return null
    }
  }, [hasExchangeData, validationCandles, strategyConfig])

  /* 자본 곡선 (누적 PnL 시리즈) */
  const equitySeries = useMemo(() => {
    if (!engineTrades.length) return []
    let eq = 0
    return engineTrades.map((t) => {
      eq += safeNum(t.pnl, 0)
      return +eq.toFixed(2)
    })
  }, [engineTrades])

  const equityXLabels = useMemo(() => {
    if (engineTrades.length < 2) return []
    const step = Math.max(1, Math.floor(engineTrades.length / 6))
    return engineTrades
      .map((t, i) => ({ idx: i, time: t.exitTime }))
      .filter((_, i) => i % step === 0 || i === engineTrades.length - 1)
      .map(({ idx, time }) => ({ idx, label: fmtMd(Number(time)) }))
  }, [engineTrades])

  const winCount = tradeRows.filter((t) => t.win).length
  const lossCount = tradeRows.length - winCount

  const periodCandleCount = hasExchangeData && validationCandles.length
    ? filterCandlesByPeriod(
        validationCandles,
        period,
        validationCandles[validationCandles.length - 1].time,
      ).length
    : engineInputPrices.length

  const showMetrics = !validationLoading && engineInputPrices.length > 0

  const improvementHints = useMemo(
    () => buildValidationImprovementHints(pd),
    [pd],
  )

  const riskAlerts = useMemo(
    () => buildRetentionRiskAlerts({
      mdd: pd.mdd,
      totalTrades: pd.trades,
      recentTrades: engineTrades,
    }),
    [pd.mdd, pd.trades, engineTrades],
  )

  const realTradeView = useMemo(() => buildRealTradeVerificationView(effectiveId), [effectiveId])

  const verificationBacktestSummary = useMemo(() => {
    const periodLabel = PERIODS[period]?.label ?? period
    const roiStr = formatDisplayPct(pd.roi)
    const mddStr = formatDisplayMdd(pd.mdd)
    const wrStr = formatDisplayWinRate(pd.winRate)
    const trStr = formatDisplayTradeCount(pd.trades)
    const evidence = `${periodLabel} 구간 · 누적 ${roiStr} · 승률 ${wrStr} · MDD ${mddStr} · 거래 ${trStr}`

    if (strategyStatus === TRUST_LEVEL.DANGER) {
      return { panelClass: panelDanger, title: '백테스트는 강하지만 라이브·실전 요건은 더 지켜봐야 합니다.', evidence }
    }
    if (strategyStatus === TRUST_LEVEL.CAUTION) {
      return { panelClass: panelWarning, title: '라이브 구간은 양호하나 표본·실전 일치는 더 필요합니다.', evidence }
    }
    if (pd.roi < 0 || pd.winRate < 45) {
      return { panelClass: panelSoft, title: '선택 구간 백테스트만으로는 보수적으로 보는 편이 낫습니다.', evidence }
    }
    return { panelClass: panelEmphasis, title: '선택 구간 백테스트 성과는 양호합니다.', evidence }
  }, [pd, strategyStatus, period])

  const validationStrategyEvaluation = useMemo(() => {
    const base = userStrat ?? strategy
    const payload = {
      ...base,
      totalReturnPct: pd.roi,
      winRate: pd.winRate,
      maxDrawdown: Math.abs(pd.mdd),
      tradeCount: pd.trades,
      recentRoi7d: recent7d ?? 0,
      matchRate: safeNum(base.matchRate ?? base.match_rate, 0),
      hasRealVerification: Boolean(base.hasRealVerification),
    }
    return evaluateStrategyWithMarket(payload, { volatilityLabel: '', marketTrend: '' })
  }, [userStrat, strategy, pd, recent7d])

  const topAuxiliary = useMemo(() => {
    const items = []
    for (const a of riskAlerts) {
      items.push({ key: `r-${a.key}`, tone: a.level === 'danger' ? 'danger' : 'warning', text: a.text })
    }
    for (const s of improvementHints?.suggestions ?? []) {
      items.push({ key: `h-${s}`, tone: 'hint', text: s })
    }
    if (!items.length) return null
    const panelClass = items.some((i) => i.tone === 'danger')
      ? panelDanger
      : items.some((i) => i.tone === 'warning')
        ? panelWarning
        : panelSoft
    return { panelClass, items }
  }, [riskAlerts, improvementHints])

  const showCompareBar = !userStrat && !isAltBasketValidation && comparePickIds.length > 0

  return (
    <PageShell className={cn('validation-page', showCompareBar && 'pb-16')}>

      <PageHeader
        title="검증"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <select
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                className="
                  h-8 pl-2.5 pr-7 text-[12px] font-semibold
                  bg-white dark:bg-gray-900
                  border border-slate-200 dark:border-gray-700
                  rounded-lg appearance-none cursor-pointer
                  text-slate-700 dark:text-slate-300
                  focus:outline-none focus:border-slate-400
                "
              >
                {userStrategies.length > 0 && (
                  <optgroup label="내 전략">
                    {userStrategies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="마켓 전략">
                  {SAFE_VAL.map((s) => {
                    const sLocked = isSimLocked(s.id, u)
                    return (
                      <option key={s.id} value={s.id}>
                        {sLocked ? '🔒 ' : ''}{s.name}
                      </option>
                    )
                  })}
                </optgroup>
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-0 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {Object.entries(PERIODS).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={cn(
                    'px-3 h-8 text-[12px] font-semibold transition-colors border-l first:border-l-0 border-slate-200 dark:border-gray-700',
                    period === key
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:bg-gray-900 dark:text-slate-500 dark:hover:bg-gray-800',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button variant="secondary" size="sm" type="button" onClick={() => onGoSimulation?.(strategyId)}>
              체험하기
            </Button>
          </div>
        }
      />

      {!userStrat && !isAltBasketValidation && (
        <div className={cn(panelSoft, 'mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5')}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">전략 비교 풀</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {comparePickIds.length === 0
                ? '비교할 전략을 추가하세요 (최대 3개). 2개 이상이면 표로 나란히 확인할 수 있습니다.'
                : comparePickIds.length < 2
                  ? '전략 비교를 위해 2개 이상 선택하세요.'
                  : `${comparePickIds.length}개 선택됨 · 아래 「전략 비교」탭에서 표를 확인하세요.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-[11px]"
              onClick={() => toggleComparePick(effectiveId)}
            >
              {comparePickIds.includes(effectiveId) ? '현재 전략 제외' : '현재 전략 추가'}
            </Button>
            <Button
              type="button"
              variant={comparePickIds.length >= 2 ? 'primary' : 'ghost'}
              size="sm"
              className="text-[11px]"
              disabled={comparePickIds.length < 2}
              onClick={() => setValidationNavSection('compare')}
            >
              비교 탭 열기
            </Button>
          </div>
        </div>
      )}

      {pipeError && (
        <div className={cn(panelDanger, 'mb-4 p-4')}>
          <p className="text-[11px] font-semibold text-red-800 dark:text-red-200">엔진 계산 오류</p>
          <p className="mt-1 text-[11px] text-red-700 dark:text-red-300 whitespace-pre-wrap">{pipeError}</p>
        </div>
      )}

      {isAltBasketValidation && (
        <div className={cn(panelSoft, 'mb-4 p-4')}>
          <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">ALT 바스켓 검증</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {assetCopy.altBasketValidation} ({ALT_BASKET_LABEL_DETAIL})
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            검증 코인:
            {' '}
            <span className="font-mono">{validationPairs.join(', ')}</span>
            . 캔들은 {primaryValidationPair} 기준 표시 · 상단 KPI는 코인별 평균입니다.
          </p>
        </div>
      )}

      {userStrat && (
        <div className={cn(panelSoft, 'mb-6 p-4 flex flex-wrap items-center gap-x-2 gap-y-1')}>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            내 전략: {userStrat.name}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            — {strategy.name} · {hasExchangeData ? '실제 klines 검증' : '샘플 가격 시리즈'}
          </span>
        </div>
      )}

      {locked && (
        <div className={cn(panelSoft, 'mb-6 flex items-start gap-3 p-4')}>
          <Lock size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
              이 전략의 백테스트 데이터는 체험 후 확인 가능합니다
            </p>
            <p className="text-[12px] text-slate-400">
              {PLAN_MESSAGES.validationLocked}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onStartTrial?.(effectiveId)}
            >
              7일 무료 체험
            </Button>
            <button
              type="button"
              className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => navigateToSubscriptionSection(onNavigate)}
            >
              플랜 비교 · 업그레이드
            </button>
          </div>
        </div>
      )}

      {validationLoading && (
        <div className={cn(panelSoft, 'mb-6 flex items-center gap-2 p-4')}>
          <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
          <span className="text-[11px] text-slate-600 dark:text-slate-400">실제 검증 데이터 불러오는 중...</span>
        </div>
      )}

      {validationError && !validationLoading && (
        <div className={cn(panelDanger, 'mb-6 p-4 text-[11px] text-red-700 dark:text-red-300')}>
          검증 데이터 조회 실패 — 아래 지표는 시뮬레이션 CHART_DATA 폴백으로 계산됩니다.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        <nav
          className="lg:w-52 shrink-0 border border-slate-200 dark:border-gray-700 rounded-xl p-2 bg-white dark:bg-gray-900/40"
          aria-label="검증 섹션"
        >
          <ul className="space-y-0.5">
            {[
              { id: 'summary', label: '전체 요약' },
              { id: 'backtest', label: '백테스트' },
              { id: 'live', label: '라이브 검증' },
              { id: 'realtrade', label: '실거래 인증' },
              { id: 'compare', label: '전략 비교' },
              { id: 'strategy', label: '전략 해부' },
              { id: 'risk', label: '리스크 해부' },
            ].map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setValidationNavSection(item.id)}
                  className={cn(
                    'w-full text-left rounded-lg px-3 py-2 text-[12px] font-medium transition-colors',
                    validationNavSection === item.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-gray-800',
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">

      {validationNavSection === 'realtrade' && (
        <RealTradeVerificationStack
          view={realTradeView}
          className={cn(locked && 'opacity-30 pointer-events-none select-none')}
        />
      )}

      {!validationLoading && engineInputPrices.length === 0 && (
        <div className="mb-6">
          <EmptyState
            title="검증할 데이터가 없습니다"
            description="다른 전략을 선택하거나 시그널 페이지에서 먼저 실행해 주세요."
            action={(
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('market')}>
                  전략마켓
                </Button>
                <Button variant="primary" size="sm" type="button" onClick={() => onNavigate?.('signal')}>
                  시그널
                </Button>
              </div>
            )}
          />
        </div>
      )}

      {validationNavSection === 'summary' && showMetrics && (
        <SectionErrorBoundary>
          <div className={cn('validation-summary mb-6', locked && 'opacity-30 pointer-events-none select-none')}>
            <div className="mb-2">
              <h2 className="product-section-h">전체 요약</h2>
            </div>
            <div className="space-y-4">
              <div className={cn(verificationBacktestSummary.panelClass, 'p-4')}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  검증 요약
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {verificationBacktestSummary.title}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {verificationBacktestSummary.evidence}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KPI
                  label="누적 수익률"
                  value={formatDisplayPct(pd.roi)}
                  type={pd.roi >= 0 ? 'positive' : 'negative'}
                  sub="선택 기간 누적 성과"
                />
                <KPI label="MDD" value={formatDisplayMdd(pd.mdd)} type="negative" sub="낮을수록 안정적" />
                <KPI label="승률" value={formatDisplayWinRate(pd.winRate)} sub="참고" />
                <KPI label="거래 수" value={formatDisplayTradeCount(pd.trades)} sub="표본" />
              </div>
              {realTradeView && (
                <div className={cn(panelPositive, 'p-4')}>
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">실거래 인증 상태</p>
                  <div className="mt-2">
                    <VerificationTierPill uiTier={realTradeView.uiTier} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {realTradeView.summaryLines.conclusion}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-snug">
                    {realTradeView.summaryLines.evidence}
                  </p>
                </div>
              )}
              <div
                className={cn(
                  validationStrategyEvaluation.tone === 'positive'
                    ? 'p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20'
                    : validationStrategyEvaluation.tone === 'warning'
                      ? 'p-4 rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20'
                      : cn(panelBase, 'p-4'),
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">짧은 결론</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {validationStrategyEvaluation.verdict}
                </p>
              </div>
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* [1] 백테스트·라이브: 요약 → KPI → 보조 해석 (실거래 블록은 상단 고정) */}
      {validationNavSection === 'backtest' && (
      <SectionErrorBoundary>
      <div className={cn('validation-top mb-6', locked && 'opacity-30 pointer-events-none select-none')}>
        <div className="mb-2">
          <h2 className="product-section-h">백테스트·라이브 성과 요약</h2>
        </div>
        {showMetrics && (
        <div className="space-y-4">
          <div className={cn(verificationBacktestSummary.panelClass, 'p-4')}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Backtest / Live summary
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {verificationBacktestSummary.title}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {verificationBacktestSummary.evidence}
            </p>
          </div>

          <div
            className={cn(
              validationStrategyEvaluation.tone === 'positive'
                ? 'p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20'
                : validationStrategyEvaluation.tone === 'warning'
                  ? 'p-4 rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20'
                  : cn(panelBase, 'p-4'),
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Strategy Evaluation
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {validationStrategyEvaluation.verdict}
            </p>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-300">요약: </span>
                {validationStrategyEvaluation.summary}
              </p>
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-300">강점: </span>
                {validationStrategyEvaluation.strength}
              </p>
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-300">약점: </span>
                {validationStrategyEvaluation.weakness}
              </p>
              {Boolean(validationStrategyEvaluation.currentFit) && (
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">현재 적합성: </span>
                  {validationStrategyEvaluation.currentFit}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPI
            label="누적 수익률"
            value={formatDisplayPct(pd.roi)}
            type={pd.roi >= 0 ? 'positive' : 'negative'}
            sub={`선택 기간 누적 성과${isAltBasketValidation ? ' · 코인별 평균' : ''}`}
          />
          <KPI label="MDD" value={formatDisplayMdd(pd.mdd)} type="negative" sub={isAltBasketValidation ? '낮을수록 안정적 · 바스켓 평균' : '낮을수록 안정적'} />
          <KPI label="승률" value={formatDisplayWinRate(pd.winRate)} sub="60% 이상이면 안정적인 편" />
          <KPI label="거래 수" value={formatDisplayTradeCount(pd.trades)} sub="표본이 많을수록 신뢰도 상승" />
          </div>
        {isAltBasketValidation && altValidationView && (
          <div className={cn(panelSoft, 'p-4')}>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              ALT · 코인별 분포
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              상단 KPI는 평균 · 아래는 개별 심볼 요약입니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-gray-900/50 px-2 py-1.5">
                <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">최고 ROI</p>
                <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {altValidationView.best?.symbol}
                  {' '}
                  <span className="tabular-nums">{fmtPct(altValidationView.best?.roi)}</span>
                </p>
              </div>
              <div className="rounded-md border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-gray-900/50 px-2 py-1.5">
                <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">최저 ROI</p>
                <p className="font-mono font-semibold text-red-700 dark:text-red-400">
                  {altValidationView.worst?.symbol}
                  {' '}
                  <span className="tabular-nums">{fmtPct(altValidationView.worst?.roi)}</span>
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-600 dark:text-slate-400">
              성과 편차(ROI 표준편차):
              {' '}
              <span className="font-semibold tabular-nums">{altValidationView.roiStd}%</span>
              {' · '}
              <span className="font-semibold">{altValidationView.varianceLabel}</span>
              <span className="text-slate-500"> (낮음·보통·높음)</span>
            </p>
            <p className="mt-1.5 text-[9px] text-slate-500">개별 수익률·MDD·승률</p>
            <ul className="mt-1 space-y-0.5 max-h-[160px] overflow-y-auto text-[10px] font-mono">
              {safeArray(altValidationView.perSymbol).map((row) => (
                <li key={row.symbol} className="flex flex-col gap-0.5 border-b border-slate-100 dark:border-gray-800 pb-1">
                  <span className="flex justify-between gap-2">
                    <span>{row.symbol}</span>
                    <span className="tabular-nums">{fmtPct(row.roi)}</span>
                  </span>
                  <span className="text-[9px] text-slate-500 flex justify-between gap-2">
                    <span>
                      MDD
                      {formatDisplayMdd(row.mdd)}
                    </span>
                    <span>
                      승률
                      {formatDisplayWinRate(row.winRate)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KPI
            label="최근 7일"
            value={recent7d == null ? '—' : fmtPct(recent7d)}
            type={recent7d == null ? undefined : Number(recent7d) >= 0 ? 'positive' : 'negative'}
            sub="엔진 기준 짧은 구간 성과"
          />
          <KPI
            label="최근 30일"
            value={recent30d == null ? '—' : fmtPct(recent30d)}
            type={recent30d == null ? undefined : Number(recent30d) >= 0 ? 'positive' : 'negative'}
            sub="엔진 기준 중기 구간 성과"
          />
          <div className={cn(panelBase, 'flex flex-col gap-2 p-4')}>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">현재 상태</p>
            <div className="mt-2">
              <Badge variant={dirVariant(currentPositionLabel === '대기' ? null : currentPositionLabel)} className="text-[12px]">
                {currentPositionLabel}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">구간 끝 시점 시그널</p>
          </div>
          <KPI label="검증 상태(참고)" value={strategyStatus} sub="엔진·데이터 조건 요약" />
          <KPI label="검증 기간" value={PERIODS[period]?.label ?? period} sub={`${periodCandleCount}개 캔들 기준`} />
          </div>

          {topAuxiliary && (
            <div className={cn(topAuxiliary.panelClass, 'p-4')}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                해석 · 주의
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {topAuxiliary.items.map((i) => (
                  <li key={i.key}>{i.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        )}
      </div>
      </SectionErrorBoundary>
      )}

      {/* [2] 최근 성과 추적 (등록 이후) */}
      {validationNavSection === 'live' && (
      <SectionErrorBoundary>
      <section className={cn('mb-5', locked && 'opacity-30 pointer-events-none select-none')}>
        <h3 className="product-section-h mb-2">최근 성과 추적 (등록 이후)</h3>
        <div className={cn(panelSoft, 'p-4')}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            등록 이후 샘플 구간의 방향성 요약입니다.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI label="등록 이후 누적" value={liveTracking.roi == null ? '—' : fmtPct(liveTracking.roi)} type={liveTracking.roi == null ? undefined : liveTracking.roi >= 0 ? 'positive' : 'negative'} sub={`최근 ${liveTracking.count}건 기준`} />
            <KPI label="최근 7일" value={liveTracking.recent7d == null ? '—' : fmtPct(liveTracking.recent7d)} type={liveTracking.recent7d == null ? undefined : liveTracking.recent7d >= 0 ? 'positive' : 'negative'} sub="짧은 구간 누적 손익" />
            <KPI label="최근 30일" value={liveTracking.recent30d == null ? '—' : fmtPct(liveTracking.recent30d)} type={liveTracking.recent30d == null ? undefined : liveTracking.recent30d >= 0 ? 'positive' : 'negative'} sub="중기 구간 누적 손익" />
            <KPI label="성과 방향" value={liveTracking.trend} sub="최근 구간 대비 추세" />
            <KPI label="현재 상태" value={liveTracking.status} type={liveTracking.status === '유효' ? 'positive' : liveTracking.status === '주의' ? 'negative' : undefined} sub={liveTracking.status === '유효' ? '비교적 안정적입니다' : liveTracking.status === '주의' ? '주의가 필요합니다' : '추가 확인이 필요합니다'} />
          </div>
        </div>
      </section>
      </SectionErrorBoundary>
      )}

      {/* [3] 자본곡선 */}
      {validationNavSection === 'backtest' && (
      <SectionErrorBoundary>
      {!locked && equitySeries.length >= 2 && (
        <section className="equity-section mb-5">
          <div className={cn(panelBase, 'overflow-hidden')}>
            <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">자본 곡선</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                거래 누적 PnL · 빨간 구간은 최대 낙폭(MDD)
              </p>
            </div>
            <div className="p-3">
              <div className="h-[200px]">
                <EquityCurve equity={equitySeries} xLabels={equityXLabels} />
              </div>
            </div>
            <p className="px-4 pb-3 text-xs text-slate-500 dark:text-slate-400">
              {engineTrades.length}건 기준 엔진 산출
            </p>
          </div>
        </section>
      )}
      {!locked && validationLoading && equitySeries.length === 0 && (
        <section className="equity-section mb-5">
          <div className={cn(panelBase, 'overflow-hidden')}>
            <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">자본 곡선</h3>
            </div>
            <div className="px-3 py-8 flex items-center justify-center">
              <span className="text-[11px] text-slate-400">데이터 로딩 중…</span>
            </div>
          </div>
        </section>
      )}
      </SectionErrorBoundary>
      )}

      {/* [3b] 전략 해부 — 서술형 (성과 맥락) */}
      {validationNavSection === 'strategy' && (
      <SectionErrorBoundary>
        <div className={cn('mb-6', locked && 'opacity-30 pointer-events-none select-none')}>
          <StrategyBreakdownSection breakdown={strategyBreakdown} />
        </div>
      </SectionErrorBoundary>
      )}

      {validationNavSection === 'live' && (
      <SectionErrorBoundary>
        <div className={cn('mb-6', locked && 'opacity-30 pointer-events-none select-none')}>
          <div
            className={
              validationScenario.confidence === '높음'
                ? 'rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20'
                : validationScenario.confidence === '주의'
                  ? 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20'
                  : 'rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70'
            }
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Strategy Scenario
            </p>
            <h3 className="mt-2 product-section-h">지금 시장에서의 시나리오</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              과거 백테스트 맥락을 바탕으로, 현재 캔들 구간에서의 참고용 해석입니다.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {validationScenarioSummary}
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p>기대 시나리오: {validationScenario.primaryScenario}</p>
              <p>위험 시나리오: {validationScenario.riskScenario}</p>
              <p>행동 가이드: {validationScenario.actionGuide}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-black/20 dark:text-slate-200">
                신뢰도: {validationScenario.confidence}
              </span>
              <span className="text-[11px] text-slate-400">
                시장 분류: {validationMarketState.marketTrend} · 변동성 {validationMarketState.volatilityLabel}
              </span>
            </div>
          </div>
        </div>
      </SectionErrorBoundary>
      )}

      {/* [3c] 리스크 해부 */}
      {validationNavSection === 'risk' && (
      <SectionErrorBoundary>
        <div className={cn('mb-6', locked && 'opacity-30 pointer-events-none select-none')}>
          <StrategyRiskBreakdownSection risk={strategyRiskBreakdown} />
        </div>
      </SectionErrorBoundary>
      )}

      {/* [4] 전략 비교 표 + 손익 구조 해부 */}
      {validationNavSection === 'compare' && (
      <>
      <SectionErrorBoundary>
      <section className={cn('mb-6', locked && 'opacity-30 pointer-events-none select-none')}>
        <div className="mb-3">
          <h3 className="product-section-h">선택 전략 비교</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            동일 검증 구간·심볼에서 엔진을 다시 돌린 결과입니다. (카탈로그 전략만)
          </p>
        </div>
        {userStrat || isAltBasketValidation ? (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-200 dark:border-gray-700 px-3 py-3">
            내 전략·ALT 바스켓 모드에서는 카탈로그 나란히 비교 대신, 상단 요약·백테스트 탭을 이용해 주세요.
          </p>
        ) : comparePickIds.length < 2 ? (
          <p className="text-[12px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-3">
            전략 비교를 위해 2개 이상 선택하세요. 상단 드롭다운으로 전략을 바꾼 뒤 「현재 전략 추가」를 누르거나, 같은 방식으로 풀을 채워 주세요.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead className="bg-slate-50 dark:bg-gray-900/60 text-left">
                <tr>
                  {['전략', '수익률', '승률', 'MDD', '타입', '상태', '신뢰(참고)'].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {strategyCompareRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.error ? '—' : `${row.roi >= 0 ? '+' : ''}${row.roi.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.error ? '—' : `${row.winRate.toFixed(1)}%`}</td>
                    <td className="px-3 py-2 tabular-nums text-red-600 dark:text-red-400">
                      {row.error ? '—' : `-${Math.abs(row.mdd).toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.type}</td>
                    <td className="px-3 py-2">{row.error ? '—' : row.status}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.error ?? row.trustLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </SectionErrorBoundary>

      <SectionErrorBoundary>
      <section className={cn('breakdown-grid', locked && 'opacity-30 pointer-events-none select-none')}>
        <div className="mb-3">
          <h3 className="product-section-h">손익 구조와 해석</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">현재 선택된 단일 전략 기준 거래 통계입니다.</p>
        </div>

        {/* 첫 줄: 핵심 해부 지표 4개 */}
        <div className="grid-4 mb-0">
          <Card>
            <Card.Content className="py-3 px-3 flex flex-col gap-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">평균 수익</p>
              <p className="text-[20px] font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
                +{stats2.avgWin}%
              </p>
              <p className="mt-1.5 text-[9px] text-slate-400">수익 거래 평균</p>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content className="py-3 px-3 flex flex-col gap-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">평균 손실</p>
              <p className="text-[20px] font-bold font-mono tabular-nums text-red-500 leading-none">
                {stats2.avgLoss}%
              </p>
              <p className="mt-1.5 text-[9px] text-slate-400">손실 거래 평균</p>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content className="py-3 px-3 flex flex-col gap-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">손익비</p>
              <p className="text-[20px] font-bold font-mono tabular-nums text-slate-800 dark:text-slate-200 leading-none">
                {stats2.rr ?? '—'}
              </p>
              <p className="mt-1.5 text-[9px] text-slate-400">
                {stats2.rr == null ? '—' : stats2.rr >= 1.5 ? '양호 (1.5 이상)' : stats2.rr >= 1 ? '보통' : '주의 (1 미만)'}
              </p>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content className="py-3 px-3 flex flex-col gap-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">연속 손실 최대</p>
              <p className="text-[20px] font-bold font-mono tabular-nums text-slate-800 dark:text-slate-200 leading-none">
                {stats2.maxLosingStreak}회
              </p>
              <p className="mt-1.5 text-[9px] text-slate-400">
                {stats2.maxLosingStreak >= 5 ? '주의 구간 존재' : '연속 손실 적음'}
              </p>
            </Card.Content>
          </Card>
        </div>

        {/* 둘째 줄: 보조 해석 지표 3개 */}
        <div className="grid-3 mt-3">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between gap-2">
                <Card.Title className="text-[12px]">상위 거래 집중도</Card.Title>
                <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="일부 큰 거래에 수익이 몰렸는지 확인합니다.">
                  <CircleHelp size={13} />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">상위 5개 거래의 수익 기여 비중</p>
            </Card.Header>
            <Card.Content className="py-3 px-3">
              <p className={cn(
                'text-[22px] font-bold font-mono tabular-nums leading-none mb-1',
                stats2.topConcentration != null && stats2.topConcentration > 60
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-800 dark:text-slate-200',
              )}>
                {stats2.topConcentration == null ? '—' : `${stats2.topConcentration}%`}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug">
                {stats2.topConcentration == null
                  ? '데이터 없음'
                  : stats2.topConcentration > 60
                    ? '특정 거래 의존도 높음'
                    : '수익 분산 양호'}
              </p>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <div className="flex items-center justify-between gap-2">
                <Card.Title className="text-[12px]">최근 성과 약화 여부</Card.Title>
                <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="과거 대비 최근 성과가 둔화되는지 점검합니다.">
                  <CircleHelp size={13} />
                </button>
              </div>
            </Card.Header>
            <Card.Content className="py-3 px-3">
              {stats2.weakening ? (
                <>
                  <p className={cn(
                    'text-[13px] font-bold font-mono tabular-nums leading-none mb-1.5',
                    stats2.weakening.weakened ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
                  )}>
                    {stats2.weakening.weakened ? '약화 감지' : '유지 / 개선'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    최근 {stats2.weakening.recentSum}% / 직전 {stats2.weakening.prevSum}%
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-slate-400 leading-snug">표본 부족 (24회 미만)</p>
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <div className="flex items-center justify-between gap-2">
                <Card.Title className="text-[12px]">근거 조합 성과</Card.Title>
                <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="어떤 진입 근거 조합이 더 잘 작동했는지 보여줍니다.">
                  <CircleHelp size={13} />
                </button>
              </div>
            </Card.Header>
            <Card.Content className="py-2 px-0 overflow-x-auto">
              {comboRows.length === 0 ? (
                <p className="text-[11px] text-slate-500 px-3">근거 데이터가 없습니다.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-gray-800">
                      {['근거', 'N', '승률', '평균'].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {comboRows.slice(0, 5).map((r) => (
                      <tr key={r.key} className="hover:bg-slate-50 dark:hover:bg-gray-800/30">
                        <td className="px-2 py-1.5 text-[10px] text-slate-700 dark:text-slate-300 max-w-[100px] truncate">{r.key}</td>
                        <td className="px-2 py-1.5 text-[10px] font-mono text-slate-500">{r.n}</td>
                        <td className="px-2 py-1.5 text-[10px] font-mono text-slate-500">{r.winRate}%</td>
                        <td className="px-2 py-1.5 text-[10px] font-mono text-slate-500">{fmtPct(r.avg, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card.Content>
          </Card>
        </div>
      </section>
      </SectionErrorBoundary>

      {/* [5] 시장 상황별 성과 */}
      <SectionErrorBoundary>
      <section className={cn('market-regime', locked && 'opacity-30 pointer-events-none select-none')}>
        <h3 className="product-section-h mb-3">시장 상황별 성과</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          {regimePerformanceRows.map((r) => (
            <Card key={r.key}>
              <Card.Content className="px-3 py-3">
                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  {r.key === '상승장' ? <TrendingUp size={12} /> : r.key === '하락장' ? <TrendingDown size={12} /> : r.key === '횡보장' ? <Waves size={12} /> : null}
                  {r.key}
                </p>
                <p className={cn('mt-1 text-[18px] font-bold font-mono tabular-nums', r.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                  {fmtPct(r.pnl, 2)}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  승률 {r.winRate == null ? '—' : `${r.winRate}%`} · 거래 {r.trades}건
                </p>
                <p className="text-[10px] mt-1 font-medium text-slate-600 dark:text-slate-300">{r.interpretation}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>
      </SectionErrorBoundary>

      {/* [6] 전체 거래 로그 */}
      <SectionErrorBoundary>
      <section className="trades-log">
      <Card className={locked ? 'opacity-30 pointer-events-none select-none' : ''}>
        <Card.Header className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Card.Title className="product-section-h text-[15px] sm:text-base">전체 거래 로그</Card.Title>
            <Badge variant="default">{filteredTradeRows.length}건</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={tradeDateFrom} onChange={(e) => setTradeDateFrom(e.target.value)} className="h-8 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[11px]" />
            <input type="date" value={tradeDateTo} onChange={(e) => setTradeDateTo(e.target.value)} className="h-8 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[11px]" />
            <select value={tradeSideFilter} onChange={(e) => setTradeSideFilter(e.target.value)} className="h-8 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[11px]">
              <option value="ALL">전체</option>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
            <select value={tradeSort} onChange={(e) => setTradeSort(e.target.value)} className="h-8 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[11px]">
              <option value="latest">최근순</option>
              <option value="oldest">오래된순</option>
            </select>
            <input
              type="text"
              value={tradeQuery}
              onChange={(e) => setTradeQuery(e.target.value)}
              placeholder="근거/청산이유 검색"
              className="h-8 w-[160px] rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-[11px]"
            />
          </div>
        </Card.Header>
        {isAltBasketValidation && (
          <div className="px-4 pb-2">
            <p className="text-[10px] text-amber-900/90 dark:text-amber-200/95 leading-relaxed">
              바스켓 모드: 체결 로그는 {primaryValidationPair} 기준 예시이며, 상단 요약 KPI는 {validationPairs.length}종 평균입니다.
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800">
                {['날짜', '포지션', '진입 시점', '청산 시점', '수익률', '보유 시간', '진입 근거 요약', '청산 이유 요약', '진입 신뢰도', 'MFE', 'MAE', '시장'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {Array.isArray(filteredTradeRows) && filteredTradeRows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTradeId(String(t.id))}
                  className={cn(
                    'cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/30',
                    String(selectedTradeId) === String(t.id) && 'bg-blue-50/60 dark:bg-blue-950/20',
                  )}
                >
                  <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">{fmtMd(t.entryTime)}</td>
                  <td className="px-3 py-2.5"><Badge variant={t.dir === 'LONG' ? 'long' : 'short'}>{t.dir}</Badge></td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">{fmtTs(t.entryTime)}</td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500 whitespace-nowrap">{fmtTs(t.exitTime)}</td>
                  <td className={cn('px-3 py-2.5 text-[11px] font-mono font-bold tabular-nums', safeNum(t.pnl, 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                    {safeNum(t.pnl, 0) >= 0 ? '+' : ''}{safeNum(t.pnl, 0).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500">{t.holding}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-600 dark:text-slate-400 max-w-[280px] truncate">{t.entryNote || '—'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{t.exitReason}{t.exitNote ? ` · ${t.exitNote}` : ''}</td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-slate-700 dark:text-slate-300">{t.confidence}</td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500">{t.mfe == null ? '—' : fmtPct(t.mfe, 2)}</td>
                  <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500">{t.mae == null ? '—' : fmtPct(t.mae, 2)}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{t.trend} / {t.vol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!Array.isArray(filteredTradeRows) || filteredTradeRows.length === 0) && showMetrics && (
          <div className="px-3 py-8 text-center">
            <p className="text-[12px] text-slate-400">해당 기간 거래 없음</p>
          </div>
        )}
      </Card>
      </section>
      </SectionErrorBoundary>

      {/* [7] 개별 거래 상세 */}
      <SectionErrorBoundary>
      {selectedTrade && (
        <div className={cn('mt-6', locked && 'opacity-30 pointer-events-none select-none')}>
          <Card>
            <Card.Header className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <Card.Title className="text-[13px]">개별 거래 상세</Card.Title>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {fmtTs(selectedTrade.entryTime)} → {fmtTs(selectedTrade.exitTime)} · {selectedTrade.dir} · {selectedTrade.holding}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={safeNum(selectedTrade.pnl, 0) >= 0 ? 'success' : 'danger'}>
                  {safeNum(selectedTrade.pnl, 0) >= 0 ? '+' : ''}{safeNum(selectedTrade.pnl, 0).toFixed(2)}%
                </Badge>
                <Button variant="ghost" size="sm" type="button" onClick={() => setSelectedTradeId(null)}>
                  닫기
                </Button>
              </div>
            </Card.Header>
            <Card.Content className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
              <div className="rounded-lg border border-slate-100 dark:border-gray-800 p-2">
                {selectedTradeChart ? (
                  <div className="h-[320px]">
                    <CandlestickChart
                      candles={selectedTradeChart.slice}
                      entries={[selectedTradeChart.entryRel]}
                      exits={[selectedTradeChart.exitRel]}
                      openEntry={selectedTrade.entry}
                      openDir={selectedTrade.dir}
                      emphasizeOpen={false}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">차트를 표시할 캔들 데이터가 없습니다.</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">당시 근거</p>
                  <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedTrade.entryNote || '—'}</p>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">청산 이유</p>
                  <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedTrade.exitReason}{selectedTrade.exitNote ? ` · ${selectedTrade.exitNote}` : ''}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">MFE</p>
                    <p className="text-[12px] font-mono font-bold text-slate-700 dark:text-slate-300">{selectedTrade.mfe == null ? '—' : fmtPct(selectedTrade.mfe, 2)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">MAE</p>
                    <p className="text-[12px] font-mono font-bold text-slate-700 dark:text-slate-300">{selectedTrade.mae == null ? '—' : fmtPct(selectedTrade.mae, 2)}</p>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      )}
      </SectionErrorBoundary>
      </>
      )}

      {/* [8] 백테스트 결과 (참고 자료) */}
      {validationNavSection === 'backtest' && (
      <SectionErrorBoundary>
      {!locked && (
        <section className="mt-6">
          <Card>
            <Card.Header>
              <Card.Title className="product-section-h text-[15px]">백테스트 결과</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="백테스트 ROI" value={formatDisplayPct(pd.roi)} type={pd.roi >= 0 ? 'positive' : 'negative'} sub="선택 기간 누적 성과" />
                <KPI label="백테스트 MDD" value={formatDisplayMdd(pd.mdd)} type="negative" sub="낮을수록 안정적" />
                <KPI label="백테스트 승률" value={formatDisplayWinRate(pd.winRate)} sub="60% 이상이면 안정적인 편" />
                <KPI label="백테스트 거래 수" value={formatDisplayTradeCount(pd.trades)} sub="표본이 많을수록 신뢰도 상승" />
              </div>
              <div className={cn(panelBase, 'overflow-hidden')}>
                <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">누적 손익 곡선</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">동일 엔진 기준 참고용</p>
                </div>
                <div className="p-3">
                  {equitySeries.length >= 2 ? (
                    <div className="h-[180px]">
                      <EquityCurve equity={equitySeries} xLabels={equityXLabels} />
                    </div>
                  ) : (
                    <div className="h-[180px] flex items-center justify-center text-[12px] text-slate-500">백테스트 자본곡선 데이터 없음</div>
                  )}
                </div>
                <p className="px-4 pb-3 text-xs text-slate-500 dark:text-slate-400">
                  {equitySeries.length >= 2 ? `${engineTrades.length}건 기준` : '데이터 없음'}
                </p>
              </div>
            </Card.Content>
          </Card>
        </section>
      )}
      </SectionErrorBoundary>
      )}

      {/* [9] 설명 자료 / 최종 판단 */}
      {validationNavSection === 'strategy' && (
      <SectionErrorBoundary>
      {!locked && (
        <section className="pdf-section mt-6">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <Card.Title className="product-section-h text-[15px]">전략 설명 자료</Card.Title>
                </div>
                {userStrat?.strategy_pdf_url && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(String(userStrat.strategy_pdf_url), '_blank', 'noopener,noreferrer')}
                  >
                    <FileText size={12} className="mr-1 inline" />
                    PDF 새 탭에서 열기
                  </Button>
                )}
              </div>
            </Card.Header>
            <Card.Content className="text-[11px] text-slate-600 dark:text-slate-400 space-y-3">
              {/* strategy_pdf_url 없고 path만 있는 경우 안내 */}
              {!userStrat?.strategy_pdf_url && (userStrat?.strategy_pdf_path || userStrat?.strategy_pdf_preview_path) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 dark:border-gray-800 bg-slate-50/40 dark:bg-gray-800/20">
                  <FileText size={14} className="text-slate-500 shrink-0" />
                  <span>PDF가 등록되어 있으나 공개 URL이 없습니다.</span>
                </div>
              )}

              {/* 텍스트 설명 3열 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">한 줄 요약</p>
                  <p className="text-[11px] whitespace-pre-wrap">{userStrat?.strategy_summary ?? userStrat?.description ?? '—'}</p>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">적용 시장</p>
                  <p className="text-[11px] whitespace-pre-wrap">{userStrat?.market_condition ?? userStrat?.market_type ?? '—'}</p>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">리스크</p>
                  <p className="text-[11px] whitespace-pre-wrap">{userStrat?.risk_description ?? '—'}</p>
                </div>
              </div>

              {/* 진입·청산 조건 */}
              {(userStrat?.entry_logic || userStrat?.exit_logic) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {userStrat?.entry_logic && (
                    <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">진입 조건</p>
                      <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{userStrat.entry_logic}</p>
                    </div>
                  )}
                  {userStrat?.exit_logic && (
                    <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">청산 조건</p>
                      <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{userStrat.exit_logic}</p>
                    </div>
                  )}
                </div>
              )}
            </Card.Content>
          </Card>
        </section>
      )}
      </SectionErrorBoundary>
      )}

      {/* 9) 최종 판단 박스 — 국면·취약점 요약 */}
      {validationNavSection === 'risk' && (
      <SectionErrorBoundary>
      {!locked && (
        <section className="final-judgement mt-6 mb-10">
          <Card>
            <Card.Header>
              <Card.Title className="product-section-h text-[15px]">최종 판단</Card.Title>
            </Card.Header>
            <Card.Content className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
              <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">강한 시장</p>
                <p className="text-slate-700 dark:text-slate-300">
                  {(() => {
                    const buckets = ['상승장', '하락장', '횡보장'].map((k) => {
                      const sum = tradeRows.filter((t) => t.trend === k).reduce((s, t) => s + safeNum(t.pnl, 0), 0)
                      return { k, sum }
                    }).sort((a, b) => b.sum - a.sum)
                    return buckets[0]?.k ?? '—'
                  })()}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">약한 시장</p>
                <p className="text-slate-700 dark:text-slate-300">
                  {(() => {
                    const buckets = ['상승장', '하락장', '횡보장'].map((k) => {
                      const sum = tradeRows.filter((t) => t.trend === k).reduce((s, t) => s + safeNum(t.pnl, 0), 0)
                      return { k, sum }
                    }).sort((a, b) => a.sum - b.sum)
                    return buckets[0]?.k ?? '—'
                  })()}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 px-3 py-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">현재 사용 적합성</p>
                <p className="text-slate-700 dark:text-slate-300 font-semibold">
                  {stats2.weakening?.weakened ? '주의 (최근 성과 약화)' : strategyStatus === TRUST_LEVEL.DANGER ? '주의 (리스크 높음)' : '양호'}
                </p>
              </div>
              <div className="rounded-lg border border-red-200/90 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/25 px-3 py-2.5">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">주의 리스크</p>
                <p className="text-red-700 dark:text-red-300">
                  {stats2.topConcentration != null && stats2.topConcentration > 60
                    ? '수익이 일부 거래에 집중'
                    : stats2.maxLosingStreak >= 5
                      ? '연속 손실 구간 큼'
                      : pd.mdd <= -20
                        ? '낙폭(MDD) 부담'
                        : '리스크 보통'}
                </p>
              </div>
            </Card.Content>
          </Card>
        </section>
      )}
      </SectionErrorBoundary>
      )}

        </div>
      </div>

      <SectionErrorBoundary>
      {!locked && !['pro', 'premium'].includes(String(u.plan ?? '').toLowerCase()) && (
        <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
              선택 기간 누적 ROI{' '}
              <span className="text-emerald-600 dark:text-emerald-400">{formatDisplayPct(pd.roi)}</span>
              {roi1YHint != null && (
                <span className="text-slate-500 font-normal">
                  {' '}(최근 1년 슬라이스 ROI {formatDisplayPct(roi1YHint)})
                </span>
              )}
            </p>
            <p className="text-[12px] text-slate-500 dark:text-slate-500 mt-0.5">
              지표는 strategyEngine·klines(또는 CHART_DATA 폴백) 기준입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoSimulation?.(strategyId)}
            className="
              flex-shrink-0 h-8 px-3 text-[12px] font-semibold rounded-lg whitespace-nowrap
              bg-slate-900 text-white hover:bg-slate-700
              dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300
              hover:scale-[1.02] active:scale-[0.98]
              transition-all
            "
          >
            지금 바로 체험하기
          </button>
        </div>
      )}
      </SectionErrorBoundary>

      {showCompareBar && (
        <div
          className={cn(
            'fixed bottom-0 left-0 right-0 z-[35] border-t border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2.5',
            'dark:border-gray-700 dark:bg-gray-950/90',
          )}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {comparePickIds.map((id) => {
                const label = SAFE_VAL.find((s) => s.id === id)?.name ?? id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleComparePick(id)}
                    className="max-w-[200px] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-gray-700"
                    title="클릭하여 제외"
                  >
                    {label}
                    <span className="ml-1 text-slate-400">×</span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {comparePickIds.length < 2 && (
                <span className="text-[11px] text-amber-700 dark:text-amber-300">2개 이상 선택 시 비교 가능</span>
              )}
              <Button
                type="button"
                size="sm"
                variant={comparePickIds.length >= 2 ? 'primary' : 'secondary'}
                disabled={comparePickIds.length < 2}
                className="text-[11px]"
                onClick={() => setValidationNavSection('compare')}
              >
                비교하기
              </Button>
            </div>
          </div>
        </div>
      )}

    </PageShell>
  )
}


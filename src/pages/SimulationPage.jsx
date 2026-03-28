import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, Activity, TrendingUp, TrendingDown, Lock } from 'lucide-react'
import PageShell    from '../components/ui/PageShell'
import Card         from '../components/ui/Card'
import Badge        from '../components/ui/Badge'
import Button       from '../components/ui/Button'
import StatCard     from '../components/ui/StatCard'
import MockChart         from '../components/simulation/MockChart'
import CandlestickChart  from '../components/simulation/CandlestickChart'
import SignalList   from '../components/simulation/SignalList'
import { cn }       from '../lib/cn'
import {
  STRATEGIES,
  CHART_DATA,
  STATUS_CONFIG,
  RUNNING_STATUS_CONFIG,
} from '../data/simulationMockData'
import {
  isSimLocked, getSignalLimit, FREE_SIM_ID,
  getTrialUrgencyClass, getTrialUrgencyBg,
} from '../lib/userPlan'
import { seededRng, strToSeed } from '../lib/seedRandom'
import { isUserStrategyId, getUserStrategyById, ASSET_TO_SIM_ID } from '../lib/userStrategies'
import {
  normalizePrices,
  generateSignalsFromPrices,
  calculateTradeHistory,
  calculateOpenPosition,
  calculatePerformance,
} from '../lib/strategyEngine'
import { getDisplayPrice, getKlines } from '../lib/priceService'

/* 현재 시각 → "MM/DD HH:MM" 문자열 */
function fmtNow() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ── 최근 거래 성과 바 ───────────────────────── */
function PerfBars({ trades }) {
  if (!trades?.length) return (
    <div className="h-8 flex items-center">
      <span className="text-[10px] text-slate-400">데이터 없음</span>
    </div>
  )
  return (
    <div className="flex items-end gap-0.5 h-8">
      {trades.map((t, i) => {
        const hPct = Math.min(100, Math.max(16, Math.abs(t.pnl) * 12))
        return (
          <div
            key={i}
            title={`${t.dir} ${t.pnl >= 0 ? '+' : ''}${t.pnl}%`}
            style={{ height: `${hPct}%` }}
            className={cn('flex-1 rounded-[1px]', t.win ? 'bg-emerald-400' : 'bg-red-400')}
          />
        )
      })}
    </div>
  )
}

/* ── 최근 거래 이력 행 ─────────────────────── */
function RecentTradeRow({ trade, isLast }) {
  const pnlPos = trade.pnl >= 0
  return (
    <div className={cn(
      'flex items-center gap-3 px-3.5 py-2',
      !isLast && 'border-b border-slate-100 dark:border-gray-800',
    )}>
      <Badge variant={trade.dir === 'LONG' ? 'success' : 'danger'}>{trade.dir}</Badge>
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
        pnlPos ? 'text-emerald-600' : 'text-red-500',
      )}>
        {pnlPos ? '+' : ''}{trade.pnl}%
      </span>
      <span className={cn('text-[10px] font-bold', trade.win ? 'text-emerald-500' : 'text-red-400')}>
        {trade.win ? '✓' : '✗'}
      </span>
    </div>
  )
}

/* ── 현재 포지션 셀 ─────────────────────────── */
function PosCell({ label, children, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-2.5 px-2', className)}>
      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1.5">
        {label}
      </span>
      {children}
    </div>
  )
}

/** 시뮬레이션 현재가 표시 (KRW 우선, 없으면 USD, 없으면 fallback 숫자) */
function formatSimulationPrice(meta, fallbackNum) {
  if (meta?.krwPrice != null) {
    return `₩${Math.round(meta.krwPrice).toLocaleString()}`
  }
  if (meta?.usdPrice != null) {
    return `$${meta.usdPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
  }
  if (fallbackNum != null && Number.isFinite(fallbackNum)) {
    return fallbackNum.toLocaleString()
  }
  return '—'
}

/** STRATEGIES.timeframe → Binance klines interval */
const TIMEFRAME_TO_KLINES_INTERVAL = {
  '1H': '1h',
  '2H': '2h',
  '4H': '4h',
  '1D': '1d',
}

/* ── SimulationPage ──────────────────────────── */
export default function SimulationPage({ initialStrategyId, user, onStartTrial, onSubscribe, userStrategies = [] }) {
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: ['btc-trend'] }

  const [strategyId, setStrategyId] = useState(
    () => {
      if (!initialStrategyId) return STRATEGIES[0].id
      /* user 전략 ID면 그대로 저장 (표시용), mock 데이터는 별도 계산 */
      if (isUserStrategyId(initialStrategyId)) return initialStrategyId
      return STRATEGIES.find((s) => s.id === initialStrategyId)
        ? initialStrategyId
        : STRATEGIES[0].id
    },
  )
  /* 전략별 구독 상태를 덮어쓸 수 있는 로컬 상태 (CTA mock) */
  const [userStatus, setUserStatus] = useState({})

  /* 외부에서 전략 ID가 바뀌면 (마켓 → 모의투자 이동 시) 동기화 */
  useEffect(() => {
    if (!initialStrategyId) return
    if (isUserStrategyId(initialStrategyId)) {
      setStrategyId(initialStrategyId)
    } else if (STRATEGIES.find((s) => s.id === initialStrategyId)) {
      setStrategyId(initialStrategyId)
    }
  }, [initialStrategyId])

  /* user 전략이면 해당 자산에 맞는 mock 전략 ID로 fallback */
  const userStrat      = isUserStrategyId(strategyId)
    ? (userStrategies.find((s) => s.id === strategyId) ?? getUserStrategyById(strategyId))
    : null
  const mockStrategyId = userStrat
    ? (ASSET_TO_SIM_ID[userStrat.asset] ?? STRATEGIES[0].id)
    : strategyId

  const locked      = isSimLocked(mockStrategyId, u)
  const signalLimit = getSignalLimit(u)
  const trialDays   = u.trialDaysLeft

  const strategy        = STRATEGIES.find((s) => s.id === mockStrategyId) ?? STRATEGIES[0]
  const assetSymbol = useMemo(() => {
    const fromSymbol = strategy?.symbol && String(strategy.symbol).replace(/USDT$/i, '')
    return (userStrat?.asset || strategy?.asset || fromSymbol || 'BTC').toUpperCase()
  }, [userStrat?.asset, strategy?.asset, strategy?.symbol])

  /** klines 조회용 심볼 (Binance USDT — getKlines 내부에서 정규화) */
  const klinesSymbol = useMemo(() => {
    if (userStrat?.asset) return String(userStrat.asset).trim().toUpperCase()
    if (strategy?.symbol) return String(strategy.symbol).trim().toUpperCase()
    return 'BTCUSDT'
  }, [userStrat?.asset, strategy?.symbol])

  const klinesInterval = useMemo(() => {
    const tf = strategy?.timeframe
    return TIMEFRAME_TO_KLINES_INTERVAL[tf] ?? '1h'
  }, [strategy?.timeframe])

  const chart           = CHART_DATA[mockStrategyId]
  const [chartCandles, setChartCandles] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState('')

  const effectivePrices = useMemo(() => {
    if (chartCandles.length > 0) {
      return chartCandles.map((c) => ({ time: c.time, price: c.close }))
    }
    return chart?.prices ?? []
  }, [chartCandles, chart?.prices, mockStrategyId])

  const effectiveStatus = userStatus[mockStrategyId] ?? strategy.status ?? 'not_started'
  const statusCfg       = STATUS_CONFIG[effectiveStatus]   ?? STATUS_CONFIG.not_started
  const runningCfg      = RUNNING_STATUS_CONFIG[strategy.runningStatus] ?? RUNNING_STATUS_CONFIG.stopped

  /* ── 엔진 실행 (초기 1회 계산) ───────────────── */
  const strategyConfig = useMemo(() => {
    /* user 전략은 아직 파싱 없음 → 기본값 */
    return { lookback: 5, mode: 'trend' }
  }, [])

  const enginePrices = useMemo(
    () => normalizePrices(effectivePrices),
    [effectivePrices],
  )

  const engineSignals = useMemo(
    () => generateSignalsFromPrices(enginePrices, strategyConfig),
    [enginePrices, strategyConfig],
  )

  const trades = useMemo(
    () => calculateTradeHistory(engineSignals),
    [engineSignals],
  )

  const perf = useMemo(
    () => calculatePerformance(trades),
    [trades],
  )

  /* 시드 기반 고정 초기값 — 현재가/변동률은 유지, ROI/Win은 엔진 결과 사용 */
  const liveData = useMemo(() => {
    const rng = seededRng(strToSeed(mockStrategyId))
    const r   = (amp) => (rng() * 2 - 1) * amp
    const lastPrice = enginePrices.length ? enginePrices[enginePrices.length - 1].price : strategy.currentPrice
    return {
      basePrice:      Math.round(lastPrice * (1 + r(0.0012))),
      priceChangePct: +(strategy.priceChangePct + r(0.07)).toFixed(2),
      roi:            +(perf.roi).toFixed(1),
      winRate:        +(perf.winRate).toFixed(1),
      mdd:            +(perf.mdd).toFixed(1),
      totalTrades:    perf.totalTrades,
    }
  }, [mockStrategyId, perf, enginePrices]) // eslint-disable-line react-hooks/exhaustive-deps

  /* 폴백용 기준가 (mock 엔진 마지막 봉 근처) */
  const [currentPrice, setCurrentPrice] = useState(() => liveData.basePrice)
  const [marketPrice, setMarketPrice] = useState(null)
  const [marketPriceMeta, setMarketPriceMeta] = useState({
    usdPrice: null,
    krwPrice: null,
    krwSource: null,
    changePercent: null,
  })

  const displayPrice = marketPrice ?? currentPrice ?? liveData.basePrice
  const pnlPrice = marketPriceMeta.usdPrice ?? currentPrice ?? liveData.basePrice

  /* 차트 마커용 봉 인덱스 (mock은 time===인덱스, klines는 타임스탬프 → 엔진 시리즈로 매핑) */
  const entryIdxs = useMemo(
    () => engineSignals
      .filter((s) => s.type === 'ENTRY')
      .map((s) => enginePrices.findIndex((p) => p.time === s.time))
      .filter((i) => i >= 0),
    [engineSignals, enginePrices],
  )
  const exitIdxs = useMemo(
    () => engineSignals
      .filter((s) => s.type === 'EXIT')
      .map((s) => enginePrices.findIndex((p) => p.time === s.time))
      .filter((i) => i >= 0),
    [engineSignals, enginePrices],
  )

  /* UI 호환 시그널 형태로 변환 (SignalList는 LONG/SHORT/EXIT를 사용) */
  const baseSignals = useMemo(() => {
    const tradeByEntryTime = new Map(trades.map((t) => [t.entryTime, t]))
    const ui = engineSignals.map((s) => {
      if (s.type === 'ENTRY') {
        const tr = tradeByEntryTime.get(s.time)
        const pnlStr = tr ? `${tr.pnl >= 0 ? '+' : ''}${tr.pnl.toFixed(1)}%` : null
        return {
          id: s.id,
          type: s.direction,         // LONG | SHORT
          price: s.price,
          time: `t=${s.time}`,
          open: !!s.open,
          pnl: tr ? pnlStr : null,
          note: s.note,
          timeIdx: s.time,
        }
      }
      return {
        id: s.id,
        type: 'EXIT',
        price: s.price,
        time: `t=${s.time}`,
        open: false,
        pnl: null,
        note: s.note,
        timeIdx: s.time,
      }
    })

    /* 최신순 */
    return ui.sort((a, b) => (b.timeIdx ?? 0) - (a.timeIdx ?? 0))
  }, [engineSignals, trades])

  /* 시그널 상태 (제한/렌더를 위한 state) */
  const [dynamicSignals, setDynamicSignals] = useState(() => baseSignals)

  /* 전략 변경 시 기준가 리셋 */
  useEffect(() => {
    setCurrentPrice(liveData.basePrice)
  }, [mockStrategyId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* 엔진 시그널 목록이 바뀌면 시그널 UI 동기화 (klines 로드 포함) */
  useEffect(() => {
    setDynamicSignals(baseSignals)
  }, [baseSignals])

  /* 실제 klines → chartCandles (전략 심볼·봉 간격 변경 시 재조회) */
  useEffect(() => {
    let cancelled = false
    setChartCandles([])
    setChartError('')
    setChartLoading(true)

    async function loadChart() {
      try {
        const klines = await getKlines(klinesSymbol, klinesInterval, 100)
        if (cancelled) return

        setChartCandles(
          klines.map((k) => ({
            time: k.time,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
          })),
        )
      } catch (e) {
        if (!cancelled) {
          console.error('Simulation klines load failed:', e)
          setChartError(e?.message ?? '차트 데이터 조회 실패')
          setChartCandles([])
        }
      } finally {
        if (!cancelled) setChartLoading(false)
      }
    }

    loadChart()

    return () => {
      cancelled = true
    }
  }, [klinesSymbol, klinesInterval])

  /* 실제 시세 polling (자산 기준, 최초 즉시 + 주기 갱신) */
  useEffect(() => {
    let cancelled = false

    async function loadPrice() {
      try {
        const data = await getDisplayPrice(assetSymbol)
        if (cancelled) return

        setMarketPrice(data.krwPrice ?? data.usdPrice ?? null)
        setMarketPriceMeta({
          usdPrice: data.usdPrice ?? null,
          krwPrice: data.krwPrice ?? null,
          krwSource: data.krwSource ?? null,
          changePercent: data.changePercent ?? null,
        })
      } catch (e) {
        console.error('Simulation price load failed:', e)
      }
    }

    loadPrice()
    const id = setInterval(loadPrice, 4000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [assetSymbol])

  /* 시그널 제한 적용 */
  const allSignals  = dynamicSignals
  const signals     = signalLimit === Infinity ? allSignals : allSignals.slice(0, signalLimit)
  const hiddenCount = allSignals.length - signals.length

  /* 오픈 포지션 계산 (엔진 signals 기준, USD 시세로 진입가와 동일 스케일) */
  const openPos = useMemo(
    () => calculateOpenPosition(engineSignals, pnlPrice || (enginePrices.at(-1)?.price ?? 0)),
    [engineSignals, pnlPrice, enginePrices],
  )

  const openSignal = openPos ? { type: openPos.type, price: openPos.entryPrice, note: '엔진 포지션', open: true } : null
  const openPnlPct = openPos?.pnlPct ?? null

  const roiSign   = liveData.roi >= 0 ? '+' : ''
  const displayChangePct = marketPriceMeta.changePercent ?? liveData.priceChangePct
  const priceSign = displayChangePct >= 0 ? '+' : ''

  /* CTA 클릭 핸들러 */
  function handleCTA() {
    if (effectiveStatus === 'not_started') {
      setUserStatus((prev) => ({ ...prev, [mockStrategyId]: 'active' }))
      if (u.plan === 'free') onStartTrial?.(mockStrategyId)
    } else if (effectiveStatus === 'active' || effectiveStatus === 'expired') {
      setUserStatus((prev) => ({ ...prev, [mockStrategyId]: 'subscribed' }))
      onSubscribe?.()
    }
  }

  /* 표시용 전략명 — user 전략이면 user 전략명 우선 */
  const displayName = userStrat?.name ?? strategy.name

  return (
    <PageShell>

      {/* ── 전략 상태 바 ─────────────────────── */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-gray-800">

        {/* 전략 선택 */}
        <div className="relative">
          <select
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            className="
              h-7 pl-2.5 pr-6 text-[11px] font-semibold
              bg-white dark:bg-gray-900
              border border-slate-200 dark:border-gray-700
              rounded-[2px] appearance-none cursor-pointer
              text-slate-700 dark:text-slate-300
              focus:outline-none focus:border-slate-400
            "
          >
              {/* 내 전략 옵션 그룹 */}
            {userStrategies.length > 0 && (
              <optgroup label="내 전략">
                {userStrategies.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="마켓 전략">
              {STRATEGIES.map((s) => {
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

        {/* 구독 상태 */}
        <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>

        {/* 운영 상태 */}
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', runningCfg.color)} />
          <span className="text-[10px] text-slate-500 dark:text-slate-500">{runningCfg.label}</span>
        </div>

        {/* 구분선 */}
        <div className="w-px h-3.5 bg-slate-200 dark:bg-gray-700" />

        {/* ROI + 승률 */}
        <span className={cn(
          'text-[11px] font-mono font-bold tabular-nums',
          liveData.roi >= 0 ? 'text-emerald-600' : 'text-red-500',
        )}>
          ROI {roiSign}{liveData.roi}%
        </span>
        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
          Win {liveData.winRate}%
        </span>

        {/* 구분선 */}
        <div className="w-px h-3.5 bg-slate-200 dark:bg-gray-700" />

        {/* 현재가 (실제 시세: KRW 가능 시 원화 + 거래소, 아니면 USD) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-slate-400">{strategy.symbol}</span>
          {marketPriceMeta.krwPrice != null ? (
            <>
              <span className="text-[12px] font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                ₩{Math.round(marketPriceMeta.krwPrice).toLocaleString()}
              </span>
              {marketPriceMeta.krwSource && (
                <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                  {marketPriceMeta.krwSource === 'upbit' ? 'UPBIT' : 'BITHUMB'}
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {formatSimulationPrice(marketPriceMeta, displayPrice)}
            </span>
          )}
          <span className={cn(
            'text-[10px] font-mono tabular-nums',
            displayChangePct >= 0 ? 'text-emerald-600' : 'text-red-500',
          )}>
            {priceSign}{displayChangePct}%
          </span>
        </div>

        {/* 오픈 포지션 현재 수익 */}
        {openSignal && openPnlPct !== null && (
          <>
            <div className="w-px h-3.5 bg-slate-200 dark:bg-gray-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400">오픈</span>
              <span className={cn(
                'text-[11px] font-mono font-bold tabular-nums',
                openPnlPct >= 0 ? 'text-emerald-600' : 'text-red-500',
              )}>
                {openPnlPct >= 0 ? '+' : ''}{openPnlPct}%
              </span>
              {openPnlPct >= 0
                ? <TrendingUp size={11} className="text-emerald-500" />
                : <TrendingDown size={11} className="text-red-500" />
              }
            </div>
          </>
        )}

        {/* 체험 남은 일수 — 긴박감 배지 */}
        {u.plan === 'trial' && trialDays > 0 && (
          <div className={cn(
            'flex flex-col items-center px-2 py-0.5 rounded-[2px] border',
            getTrialUrgencyBg(trialDays),
          )}>
            <span className={cn('text-[10px] font-semibold tabular-nums leading-none', getTrialUrgencyClass(trialDays))}>
              체험 {trialDays}일 남음
            </span>
            {trialDays <= 3 && (
              <span className="text-[8px] text-slate-400 leading-none mt-[1px]">
                종료 후 잠금
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* CTA */}
        {effectiveStatus === 'subscribed' ? (
          <Badge variant="info">구독 중</Badge>
        ) : (
          <Button variant={statusCfg.ctaVariant} size="sm" onClick={handleCTA}>
            {statusCfg.cta}
          </Button>
        )}
      </div>

      {/* ── 내 전략 시뮬레이션 안내 배너 ────── */}
      {userStrat && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40 rounded-[2px]">
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
            내 전략: {userStrat.name}
          </span>
          <span className="text-[10px] text-blue-400 dark:text-blue-600">
            — {strategy.asset ?? userStrat.asset} 데이터 기반 시뮬레이션
          </span>
        </div>
      )}

      {/* ── 현재 포지션 패널 ─────────────────── */}
      {!locked && (
        <div className="mb-3 grid grid-cols-5 border border-slate-200 dark:border-gray-700 rounded-[2px] overflow-hidden bg-white dark:bg-gray-900">
          {/* 방향 */}
          <PosCell label="방향" className="border-r border-slate-100 dark:border-gray-800">
            {openSignal
              ? <Badge variant={openSignal.type === 'LONG' ? 'success' : 'danger'} className="text-[11px]">
                  {openSignal.type}
                </Badge>
              : <span className="text-[12px] font-semibold text-slate-400">대기 중</span>
            }
          </PosCell>

          {/* 진입가 */}
          <PosCell label="진입가" className="border-r border-slate-100 dark:border-gray-800">
            <span className="text-[14px] font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {openSignal ? openSignal.price.toLocaleString() : '—'}
            </span>
          </PosCell>

          {/* 현재가 (실시간) */}
          <PosCell label="현재가" className="border-r border-slate-100 dark:border-gray-800">
            <span className="text-[14px] font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatSimulationPrice(marketPriceMeta, displayPrice)}
            </span>
          </PosCell>

          {/* 현재 손익 */}
          <PosCell label="현재 손익" className="border-r border-slate-100 dark:border-gray-800">
            {openPnlPct !== null
              ? <span className={cn(
                  'text-[16px] font-mono font-bold tabular-nums',
                  openPnlPct >= 0 ? 'text-emerald-600' : 'text-red-500',
                )}>
                  {openPnlPct >= 0 ? '+' : ''}{openPnlPct}%
                </span>
              : <span className="text-[13px] text-slate-400">—</span>
            }
          </PosCell>

          {/* 포지션 상태 */}
          <PosCell label="포지션 상태">
            <span className={cn(
              'text-[12px] font-semibold',
              openSignal ? 'text-emerald-600' : 'text-slate-400',
            )}>
              {openSignal ? '진입 중' : '대기 중'}
            </span>
            {openSignal && (
              <span className="text-[9px] text-slate-400 mt-0.5 text-center leading-tight">
                {openSignal.note}
              </span>
            )}
          </PosCell>
        </div>
      )}

      {/* ── 잠긴 전략 업그레이드 배너 ──────── */}
      {locked && (
        <div className="mb-3 flex items-start gap-3 px-4 py-3 bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 rounded-[2px]">
          <Lock size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
              이 전략은 체험 또는 구독 후 이용 가능합니다
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              7일 무료 체험을 시작하면 모든 전략의 실시간 시그널을 확인할 수 있습니다.
              {strategyId !== FREE_SIM_ID && (
                <> 지금 바로{' '}
                  <button
                    onClick={() => setStrategyId(FREE_SIM_ID)}
                    className="text-blue-500 hover:text-blue-700 underline underline-offset-2"
                  >
                    무료 전략으로 돌아가기
                  </button>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <Button variant="primary" size="sm" onClick={() => onStartTrial?.(strategyId)}>
              7일 무료 체험 시작
            </Button>
            <button
              onClick={onSubscribe}
              className="text-[9px] text-slate-400 hover:text-slate-600 text-center transition-colors"
            >
              바로 구독하기
            </button>
          </div>
        </div>
      )}

      {/* ── 메인 3열 ────────────────────────── */}
      <div className={cn('grid grid-cols-[180px_1fr_188px] gap-2 mb-3', locked && 'opacity-30 pointer-events-none select-none')}>

        {/* 좌측: 전략 정보 */}
        <div className="flex flex-col gap-2">

          <Card className="flex-1">
            <Card.Header>
              <div className="flex items-center gap-1.5">
                <Activity size={10} className="text-slate-400 flex-shrink-0" />
                <Card.Title className="truncate">{strategy.name}</Card.Title>
              </div>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-relaxed">
                {strategy.description}
              </p>

              <div className="flex flex-col gap-1.5">
                {[
                  { label: 'ROI',      value: `${roiSign}${liveData.roi}%`,  cls: liveData.roi >= 0 ? 'text-emerald-600' : 'text-red-500' },
                  { label: 'Win Rate', value: `${liveData.winRate}%`,         cls: 'text-slate-700 dark:text-slate-300' },
                  { label: 'MDD',      value: `−${liveData.mdd}%`,           cls: 'text-red-500' },
                  { label: 'Trades',   value: String(liveData.totalTrades),  cls: 'text-slate-600 dark:text-slate-400' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">{label}</span>
                    <span className={cn('text-[12px] font-bold font-mono tabular-nums', cls)}>{value}</span>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>

          {/* 최근 성과 바 */}
          <Card>
            <Card.Header><Card.Title>최근 성과</Card.Title></Card.Header>
            <Card.Content>
              <p className="text-[9px] text-slate-400 mb-2 uppercase tracking-widest font-bold">
                최근 {trades?.length ?? 0}회 거래
              </p>
              <PerfBars trades={(trades ?? []).slice(0, 5).map((t) => ({
                dir: t.dir,
                entry: t.entry,
                exit: t.exit,
                pnl: t.pnl,
                win: t.win,
              }))} />
            </Card.Content>
          </Card>
        </div>

        {/* 중앙: 차트 */}
        <Card className="flex flex-col">
          <Card.Header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Card.Title>{strategy.symbol} · {strategy.timeframe}</Card.Title>
              <Badge variant="info">{strategy.type}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-0 h-0 border-l-[3.5px] border-r-[3.5px] border-b-[6px] border-l-transparent border-r-transparent border-b-emerald-500" />
                  <span className="text-[9px] text-slate-400">진입</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-amber-400 rounded-[1px]" />
                  <span className="text-[9px] text-slate-400">청산</span>
                </div>
              </div>
              <span className="text-[12px] font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {formatSimulationPrice(marketPriceMeta, displayPrice)}
              </span>
            </div>
          </Card.Header>

          <Card.Content className="flex-1 py-3">
            <div className="h-[240px]">
              {chartLoading ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">차트 불러오는 중...</span>
                </div>
              ) : chartError ? (
                <div className="h-full flex items-center justify-center px-2 text-center">
                  <span className="text-xs text-red-500">차트 데이터 조회 실패</span>
                </div>
              ) : chartCandles.length > 0 ? (
                <CandlestickChart
                  candles={chartCandles}
                  entries={entryIdxs}
                  exits={exitIdxs}
                  openEntry={openSignal?.price ?? null}
                  openDir={openSignal?.type ?? 'LONG'}
                />
              ) : effectivePrices.length > 0 ? (
                <MockChart
                  prices={effectivePrices.map((p) => (typeof p === 'object' && p !== null ? p.price : p))}
                  entries={entryIdxs}
                  exits={exitIdxs}
                  openEntry={openSignal?.price ?? null}
                  openDir={openSignal?.type ?? 'LONG'}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-slate-300 dark:text-slate-700">차트 데이터 없음</span>
                </div>
              )}
            </div>
          </Card.Content>

          <Card.Footer className="flex items-center justify-between">
            {openSignal ? (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400">오픈 포지션</span>
                <Badge variant={openSignal.type === 'LONG' ? 'success' : 'danger'}>
                  {openSignal.type}
                </Badge>
                <span className="text-[9px] font-mono text-slate-500 tabular-nums">
                  {openSignal.price.toLocaleString()} 진입
                </span>
                {openPnlPct !== null && (
                  <span className={cn(
                    'text-[10px] font-bold font-mono tabular-nums',
                    openPnlPct >= 0 ? 'text-emerald-600' : 'text-red-500',
                  )}>
                    {openPnlPct >= 0 ? '+' : ''}{openPnlPct}%
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[9px] text-slate-400 font-mono">
                {effectivePrices.length > 0 ? `${effectivePrices.length}봉 · ${strategy.timeframe}` : '—'}
              </span>
            )}
            <span className={cn(
              'text-[10px] font-mono font-bold tabular-nums',
              displayChangePct >= 0 ? 'text-emerald-600' : 'text-red-500',
            )}>
              {priceSign}{displayChangePct}%
            </span>
          </Card.Footer>
        </Card>

        {/* 우측: 시그널 리스트 */}
        <Card className="flex flex-col">
          <Card.Header className="flex items-center justify-between">
            <Card.Title>시그널 이력</Card.Title>
            <span className="text-[9px] text-slate-400">{allSignals.length}건</span>
          </Card.Header>

          <div className="overflow-y-auto" style={{ maxHeight: 192 }}>
            <SignalList signals={signals} />
          </div>

          {/* 블러 처리된 잠긴 시그널 미리보기 */}
          {hiddenCount > 0 && (
            <div className="border-t border-slate-100 dark:border-gray-800">
              <div className="relative overflow-hidden">
                {/* 블러 미리보기 */}
                <div className="pointer-events-none select-none opacity-35" style={{ filter: 'blur(3px)' }}>
                  <SignalList
                    signals={allSignals.slice(signalLimit, Math.min(signalLimit + 2, allSignals.length))}
                  />
                </div>
                {/* 잠금 오버레이 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/75 dark:bg-gray-900/75">
                  <Lock size={11} className="text-slate-400" />
                  <p className="text-[9px] text-slate-500 font-medium">
                    {hiddenCount}개 시그널이 잠겨 있습니다
                  </p>
                  <button
                    onClick={() => onStartTrial?.(strategyId)}
                    className="text-[10px] font-semibold text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    실시간 시그널 받기 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {effectiveStatus !== 'subscribed' && (
            <Card.Footer>
              <div className="flex flex-col gap-1">
                <Button
                  variant={statusCfg.ctaVariant}
                  size="sm"
                  className="w-full justify-center"
                  onClick={handleCTA}
                >
                  {statusCfg.cta}
                </Button>
                {statusCfg.ctaSub && (
                  <p className="text-[8px] text-slate-400 text-center leading-tight">
                    {statusCfg.ctaSub}
                  </p>
                )}
              </div>
            </Card.Footer>
          )}
        </Card>
      </div>

      {/* 구독 유도 안내 (비구독자에게만) */}
      {!locked && effectiveStatus !== 'subscribed' && (
        <p className="text-[9px] text-slate-400 text-center mb-2">
          이 전략의 전체 성과는{' '}
          <button
            onClick={handleCTA}
            className="text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors"
          >
            구독 후 확인 가능
          </button>
          합니다
        </p>
      )}

      {/* ── 하단 성과 요약 ───────────────────── */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        <StatCard
          label="총 ROI"
          value={`${roiSign}${liveData.roi}%`}
          sub="체험 시작 이후"
          trend={liveData.roi >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="총 거래 횟수"
          value={String(liveData.totalTrades)}
          sub={`${strategy.symbol} 기준`}
        />
        <StatCard
          label="승률"
          value={`${liveData.winRate}%`}
          sub="Win Rate"
        />
        <StatCard
          label="최대 낙폭"
          value={`−${liveData.mdd}%`}
          sub="Max Drawdown"
          trend="down"
        />
      </div>

      {/* ── 최근 거래 이력 ───────────────────── */}
      {(trades?.length ?? 0) > 0 && (
        <Card>
          <Card.Header className="flex items-center justify-between">
            <Card.Title>최근 거래 이력</Card.Title>
            <div className="flex items-center gap-2">
              {/* 승/패 요약 */}
              {(() => {
                const wins   = trades.filter((t) => t.win).length
                const losses = trades.length - wins
                return (
                  <>
                    <span className="text-[9px] text-emerald-600 font-semibold">{wins}승</span>
                    <span className="text-[9px] text-slate-400">/</span>
                    <span className="text-[9px] text-red-500 font-semibold">{losses}패</span>
                  </>
                )
              })()}
              <span className="text-[9px] text-slate-400">최근 {trades.length}회</span>
            </div>
          </Card.Header>
          <div>
            {trades.map((t, i) => (
              <RecentTradeRow
                key={i}
                trade={t}
                isLast={i === trades.length - 1}
              />
            ))}
          </div>
        </Card>
      )}

    </PageShell>
  )
}

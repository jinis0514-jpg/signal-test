import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import PageShell    from '../components/ui/PageShell'
import Card         from '../components/ui/Card'
import Badge        from '../components/ui/Badge'
import Button       from '../components/ui/Button'
import StatCard     from '../components/ui/StatCard'
import EquityCurve  from '../components/validation/EquityCurve'
import MonthlyBar   from '../components/validation/MonthlyBar'
import { cn }       from '../lib/cn'
import {
  VAL_STRATEGIES,
  PERIODS,
  TIMEFRAME_TO_KLINES_INTERVAL,
} from '../data/validationMockData'
import { STRATEGIES as SIM_STRATEGIES, CHART_DATA } from '../data/simulationMockData'
import { isSimLocked } from '../lib/userPlan'
import { isUserStrategyId, getUserStrategyById, ASSET_TO_SIM_ID } from '../lib/userStrategies'
import { getKlines } from '../lib/priceService'
import {
  normalizePrices,
  generateSignalsFromPrices,
  calculateTradeHistory,
  calculatePerformance,
  calculateOpenPosition,
} from '../lib/strategyEngine'
import {
  filterCandlesByPeriod,
  buildEquitySeriesFromTrades,
  buildEquityXLabels,
  monthlyPnLFromTrades,
  extendedPerf,
} from '../lib/validationMetrics'

const sign = (v) => (v >= 0 ? '+' : '')

const strategyConfig = { lookback: 5, mode: 'trend' }

const PERIOD_RATIO = { '3M': 0.25, '6M': 0.5, 'YTD': 0.18, '1Y': 1.0, '3Y': 1.0, 'ALL': 1.0 }

function fmtMd(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}`
}

function MetricRow({ label, value, cls }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-gray-800 last:border-0">
      <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">{label}</span>
      <span className={cn('text-[11px] font-bold font-mono tabular-nums', cls)}>{value}</span>
    </div>
  )
}

function TradeRow({ trade, idx }) {
  const isPos = trade.pnl >= 0
  return (
    <tr className={cn(
      'hover:bg-slate-50 dark:hover:bg-gray-800/40',
      idx % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-gray-800/20',
    )}>
      <td className="px-3 py-1.5 text-[9px] font-mono text-slate-400">{String(trade.id).padStart(2, '0')}</td>
      <td className="px-3 py-1.5">
        <Badge variant={trade.dir === 'LONG' ? 'success' : 'danger'}>{trade.dir}</Badge>
      </td>
      <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500 tabular-nums">{trade.eDate}</td>
      <td className="px-3 py-1.5 font-mono text-[10px] text-slate-700 dark:text-slate-300 tabular-nums">
        {trade.ePrice.toLocaleString()}
      </td>
      <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500 tabular-nums">{trade.xDate}</td>
      <td className="px-3 py-1.5 font-mono text-[10px] text-slate-700 dark:text-slate-300 tabular-nums">
        {trade.xPrice.toLocaleString()}
      </td>
      <td className="px-3 py-1.5 text-[10px] font-mono text-slate-400 tabular-nums">{trade.days}d</td>
      <td className={cn(
        'px-3 py-1.5 font-mono font-bold text-[11px] tabular-nums',
        isPos ? 'text-emerald-600' : 'text-red-500',
      )}>
        {sign(trade.pnl)}{trade.pnl.toFixed(2)}%
      </td>
      <td className="px-3 py-1.5 text-center">
        <span className={cn('text-[11px] font-bold', trade.win ? 'text-emerald-500' : 'text-red-400')}>
          {trade.win ? '✓' : '✗'}
        </span>
      </td>
    </tr>
  )
}

export default function ValidationPage({ onGoSimulation, selectedStrategyId, user, onStartTrial, userStrategies = [] }) {
  const [strategyId, setStrategyId] = useState(
    () => {
      if (!selectedStrategyId) return VAL_STRATEGIES[0].id
      if (isUserStrategyId(selectedStrategyId)) return selectedStrategyId
      return VAL_STRATEGIES.find((s) => s.id === selectedStrategyId)
        ? selectedStrategyId
        : VAL_STRATEGIES[0].id
    },
  )
  const [period, setPeriod] = useState('1Y')

  const [validationPrices, setValidationPrices] = useState([])
  const [validationCandles, setValidationCandles] = useState([])
  const [validationLoading, setValidationLoading] = useState(true)
  const [validationError, setValidationError] = useState('')

  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: ['btc-trend'] }

  const userStrat = isUserStrategyId(strategyId)
    ? (userStrategies.find((s) => s.id === strategyId) ?? getUserStrategyById(strategyId))
    : null
  const mockValId = userStrat
    ? (ASSET_TO_SIM_ID[userStrat.asset] ?? VAL_STRATEGIES[0].id)
    : strategyId

  const effectiveId = VAL_STRATEGIES.some((s) => s.id === mockValId) ? mockValId : VAL_STRATEGIES[0].id

  const locked = isSimLocked(effectiveId, u)
  const strategy = VAL_STRATEGIES.find((s) => s.id === effectiveId) ?? VAL_STRATEGIES[0]
  const simMeta = SIM_STRATEGIES.find((s) => s.id === effectiveId) ?? SIM_STRATEGIES[0]

  const symbol = useMemo(() => {
    const raw = userStrat?.asset || strategy?.asset || strategy?.symbol || 'BTCUSDT'
    return String(raw).trim().toUpperCase()
  }, [userStrat?.asset, strategy?.asset, strategy?.symbol])

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

        const candles = await getKlines(symbol, interval, 200)
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
  }, [symbol, interval])

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

  const enginePrices = useMemo(
    () => normalizePrices(engineInputPrices),
    [engineInputPrices],
  )

  const engineSignals = useMemo(
    () => generateSignalsFromPrices(enginePrices, strategyConfig),
    [enginePrices],
  )

  const engineTrades = useMemo(
    () => calculateTradeHistory(engineSignals),
    [engineSignals],
  )

  const perf = useMemo(
    () => calculatePerformance(engineTrades),
    [engineTrades],
  )

  const ext = useMemo(
    () => extendedPerf(engineTrades),
    [engineTrades],
  )

  const lastPrice = enginePrices.length ? enginePrices[enginePrices.length - 1].price : 0

  const openPos = useMemo(
    () => calculateOpenPosition(engineSignals, lastPrice || 0),
    [engineSignals, lastPrice],
  )

  const pd = useMemo(() => ({
    roi: perf.roi,
    winRate: perf.winRate,
    mdd: perf.mdd,
    trades: perf.totalTrades,
    sharpe: ext.sharpe,
    profitFactor: ext.profitFactor,
    avgWin: ext.avgWin,
    avgLoss: ext.avgLoss,
  }), [perf, ext])

  const equity = useMemo(
    () => buildEquitySeriesFromTrades(engineTrades),
    [engineTrades],
  )

  const xLabels = useMemo(
    () => buildEquityXLabels(equity.length),
    [equity.length],
  )

  const monthly = useMemo(
    () => monthlyPnLFromTrades(engineTrades),
    [engineTrades],
  )

  const tradeRows = useMemo(
    () => engineTrades.map((t, i) => ({
      id: i + 1,
      dir: t.dir,
      eDate: fmtMd(t.entryTime),
      xDate: fmtMd(t.exitTime),
      ePrice: t.entry,
      xPrice: t.exit,
      pnl: t.pnl,
      days: Math.max(1, Math.round((t.exitTime - t.entryTime) / 86400000)),
      win: t.win,
    })),
    [engineTrades],
  )

  const latestSignal = useMemo(() => {
    const sorted = [...engineSignals].sort((a, b) => a.time - b.time)
    return sorted[sorted.length - 1] ?? null
  }, [engineSignals])

  const roi1YHint = useMemo(() => {
    if (!hasExchangeData || !validationCandles.length) return null
    const ref = validationCandles[validationCandles.length - 1].time
    const y1 = filterCandlesByPeriod(validationCandles, '1Y', ref)
    const series = y1.map((c) => ({ time: c.time, price: c.close }))
    const sig = generateSignalsFromPrices(normalizePrices(series), strategyConfig)
    const tr = calculateTradeHistory(sig)
    return calculatePerformance(tr).roi
  }, [hasExchangeData, validationCandles])

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

  return (
    <PageShell>

      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-gray-800">

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
            {userStrategies.length > 0 && (
              <optgroup label="내 전략">
                {userStrategies.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="마켓 전략">
              {VAL_STRATEGIES.map((s) => {
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

        <Badge variant="info">{strategy.type}</Badge>
        <span className="text-[10px] font-mono text-slate-400">{strategy.symbol}</span>

        {validationLoading && (
          <span className="text-[9px] text-slate-500">실제 검증 데이터 불러오는 중...</span>
        )}
        {hasExchangeData && !validationLoading && (
          <Badge variant="info" className="text-[8px]">거래소 klines</Badge>
        )}
        {useMockFallback && (
          <Badge variant="default" className="text-[8px] text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">
            개발용 샘플 시리즈 (CHART_DATA)
          </Badge>
        )}
        {validationError && !validationLoading && (
          <span className="text-[9px] text-red-500 max-w-[220px] truncate" title={validationError}>
            검증 데이터 조회 실패 — 샘플 시리즈 사용
          </span>
        )}

        <div className="w-px h-3.5 bg-slate-200 dark:bg-gray-700" />

        <div className="flex items-center gap-0 border border-slate-200 dark:border-gray-700 rounded-[2px] overflow-hidden">
          {Object.entries(PERIODS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                'px-2.5 h-6 text-[10px] font-semibold transition-colors border-l first:border-l-0 border-slate-200 dark:border-gray-700',
                period === key
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:bg-gray-900 dark:text-slate-500 dark:hover:bg-gray-800',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <span className={cn(
          'text-[13px] font-bold font-mono tabular-nums',
          pd.roi >= 0 ? 'text-emerald-600' : 'text-red-500',
        )}>
          {sign(pd.roi)}{pd.roi}%
        </span>
        <span className="text-[10px] text-slate-400">{PERIODS[period].label} 수익률</span>

        <div className="w-px h-3.5 bg-slate-200 dark:bg-gray-700" />

        <button
          type="button"
          onClick={() => onGoSimulation?.(strategyId)}
          className="
            h-7 px-3 text-[10px] font-semibold rounded-[2px]
            bg-slate-900 text-white hover:bg-slate-700
            dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300
            transition-colors whitespace-nowrap
          "
        >
          이 전략 체험하기 →
        </button>
      </div>

      {userStrat && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40 rounded-[2px]">
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
            내 전략: {userStrat.name}
          </span>
          <span className="text-[10px] text-blue-400 dark:text-blue-600">
            — {strategy.name} · {hasExchangeData ? '실제 klines 검증' : '샘플 가격 시리즈'}
          </span>
        </div>
      )}

      {locked && (
        <div className="mb-3 flex items-start gap-3 px-4 py-3 bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 rounded-[2px]">
          <Lock size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
              이 전략의 백테스트 데이터는 체험 후 확인 가능합니다
            </p>
            <p className="text-[10px] text-slate-400">
              7일 무료 체험으로 모든 전략의 과거 수익률 · 거래 이력을 확인하세요.
            </p>
          </div>
          <Button variant="primary" size="sm" className="flex-shrink-0" onClick={onStartTrial}>
            7일 무료 체험 시작
          </Button>
        </div>
      )}

      {validationLoading && (
        <div className="mb-3 px-3 py-2 rounded-[2px] border border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-900/40 text-[11px] text-slate-600 dark:text-slate-400">
          실제 검증 데이터 불러오는 중...
        </div>
      )}

      {validationError && !validationLoading && (
        <div className="mb-3 px-3 py-2 rounded-[2px] border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-[11px] text-red-700 dark:text-red-400">
          검증 데이터 조회 실패 — 아래 지표는 시뮬레이션 CHART_DATA 폴백으로 계산됩니다.
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Card>
          <Card.Header><Card.Title className="text-[11px]">최근 신호</Card.Title></Card.Header>
          <Card.Content className="py-2 text-[10px] text-slate-600 dark:text-slate-400">
            {showMetrics && latestSignal
              ? (
                <span>
                  <Badge variant={latestSignal.type === 'ENTRY' ? 'success' : 'default'} className="mr-1.5">
                    {latestSignal.type}
                  </Badge>
                  {latestSignal.direction}{' '}
                  @ {latestSignal.price?.toLocaleString?.() ?? '—'} · t={latestSignal.time}
                </span>
              )
              : (
                <span className="text-slate-400">신호 없음</span>
              )}
          </Card.Content>
        </Card>
        <Card>
          <Card.Header><Card.Title className="text-[11px]">오픈 포지션</Card.Title></Card.Header>
          <Card.Content className="py-2 text-[10px] text-slate-600 dark:text-slate-400">
            {showMetrics && openPos
              ? (
                <span>
                  <Badge variant={openPos.type === 'LONG' ? 'success' : 'danger'} className="mr-1.5">{openPos.type}</Badge>
                  진입 {openPos.entryPrice?.toLocaleString?.()} · 미실현 {sign(openPos.pnlPct)}{openPos.pnlPct}%
                </span>
              )
              : (
                <span className="text-slate-400">없음 (또는 데이터 부족)</span>
              )}
          </Card.Content>
        </Card>
      </div>

      <div className={cn('grid grid-cols-4 gap-2 mb-3', locked && 'opacity-30 pointer-events-none select-none')}>
        <StatCard
          label="누적 ROI"
          value={`${sign(pd.roi)}${pd.roi}%`}
          sub={`${PERIODS[period].label} · 엔진 산출`}
          trend={pd.roi >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Win Rate"
          value={`${Number(pd.winRate).toFixed(1)}%`}
          sub={`${pd.trades}회 중 ${pd.trades > 0 ? Math.round(pd.trades * Number(pd.winRate) / 100) : 0}승`}
        />
        <StatCard
          label="MDD"
          value={`−${pd.mdd}%`}
          sub="최대 낙폭"
          trend="down"
        />
        <StatCard
          label="총 거래"
          value={String(pd.trades)}
          sub={`Sharpe ${pd.sharpe}`}
        />
      </div>

      <div className={cn('grid grid-cols-[1fr_220px] gap-2 mb-3', locked && 'opacity-30 pointer-events-none select-none')}>

        <Card>
          <Card.Header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Card.Title>누적 수익 곡선 (Equity Curve)</Card.Title>
              <Badge variant="default">{PERIODS[period].label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-[2px] bg-blue-500 inline-block" /> 수익률
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-red-400/30 inline-block" /> MDD 구간
              </span>
            </div>
          </Card.Header>
          <Card.Content className="py-3">
            <div className="h-[260px]">
              {validationLoading && !showMetrics ? (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-500">
                  실제 검증 데이터 불러오는 중...
                </div>
              ) : validationError && !showMetrics ? (
                <div className="h-full flex items-center justify-center text-[11px] text-red-500 px-2 text-center">
                  검증 데이터 조회 실패
                </div>
              ) : equity.length >= 2 ? (
                <EquityCurve equity={equity} xLabels={xLabels} />
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-slate-400">
                  표시할 누적 곡선 데이터가 없습니다
                </div>
              )}
            </div>
          </Card.Content>
          <Card.Footer className="flex items-center gap-4">
            <span className="text-[9px] text-slate-400 font-mono">
              {periodCandleCount}봉 · {interval} · {hasExchangeData ? '실데이터' : '폴백'} · {strategy.symbol}
            </span>
            <div className="flex-1" />
            <span className="text-[9px] text-slate-400">
              Profit Factor <span className="font-bold text-slate-600 dark:text-slate-400 font-mono">{pd.profitFactor}</span>
            </span>
            <span className="text-[9px] text-slate-400">
              Sharpe <span className="font-bold text-slate-600 dark:text-slate-400 font-mono">{pd.sharpe}</span>
            </span>
          </Card.Footer>
        </Card>

        <div className="flex flex-col gap-2">

          <Card className="flex-1">
            <Card.Header><Card.Title>월별 수익률</Card.Title></Card.Header>
            <Card.Content className="py-2">
              <div className="h-[100px]">
                <MonthlyBar months={monthly} />
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header><Card.Title>성과 지표</Card.Title></Card.Header>
            <Card.Content className="py-1">
              <MetricRow label="Avg Win" value={`+${pd.avgWin}%`} cls="text-emerald-600" />
              <MetricRow label="Avg Loss" value={`${pd.avgLoss}%`} cls="text-red-500" />
              <MetricRow label="Profit Factor" value={String(pd.profitFactor)} cls="text-slate-700 dark:text-slate-300" />
              <MetricRow label="Sharpe Ratio" value={String(pd.sharpe)} cls="text-slate-700 dark:text-slate-300" />
            </Card.Content>
          </Card>
        </div>
      </div>

      {!locked && u.plan !== 'subscribed' && (
        <div className="mb-3 flex items-center justify-between gap-4 px-4 py-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-[2px]">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
              선택 기간 누적 ROI{' '}
              <span className="text-emerald-600">{sign(pd.roi)}{pd.roi}%</span>
              {roi1YHint != null && (
                <span className="text-slate-500 font-normal">
                  {' '}(최근 1년 슬라이스 ROI {sign(roi1YHint)}{roi1YHint}%)
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
              지표는 strategyEngine·klines(또는 CHART_DATA 폴백) 기준입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoSimulation?.(strategyId)}
            className="
              flex-shrink-0 h-7 px-3 text-[10px] font-semibold rounded-[2px] whitespace-nowrap
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

      <Card className={locked ? 'opacity-30 pointer-events-none select-none' : ''}>
        <Card.Header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Card.Title>거래 로그</Card.Title>
            <Badge variant="default">{tradeRows.length}건</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-emerald-600 font-semibold font-mono">{winCount}승</span>
            <span className="text-[9px] text-slate-400">/</span>
            <span className="text-[9px] text-red-500 font-semibold font-mono">{lossCount}패</span>
            <span className="text-[9px] text-slate-400 ml-1">
              승률 <span className="font-bold text-slate-600 dark:text-slate-400">
                {tradeRows.length > 0 ? (winCount / tradeRows.length * 100).toFixed(1) : '—'}%
              </span>
            </span>
          </div>
        </Card.Header>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800">
                {['#', '방향', '진입일', '진입가', '청산일', '청산가', '보유', '손익', '결과'].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left text-[9px] font-bold tracking-widest text-slate-400 uppercase whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {tradeRows.map((t, i) => (
                <TradeRow key={t.id} trade={t} idx={i} />
              ))}
            </tbody>
          </table>
        </div>

        {tradeRows.length === 0 && showMetrics && (
          <div className="px-3 py-8 text-center">
            <p className="text-[10px] text-slate-400">해당 기간 거래 없음</p>
          </div>
        )}
      </Card>

    </PageShell>
  )
}

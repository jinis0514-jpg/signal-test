import { useState, useEffect, useMemo, useRef, memo } from 'react'
import {
  Activity, ArrowRight,
  Sparkles, Radio, FolderKanban, Globe, Zap,
} from 'lucide-react'
import PageShell     from '../components/ui/PageShell'
import Card          from '../components/ui/Card'
import Button        from '../components/ui/Button'
import EmptyState    from '../components/ui/EmptyState'
import StrategyCard  from '../components/market/StrategyCard'
import StrategyDetailModal from '../components/market/StrategyDetailModal'
import { StrategyCardSkeleton } from '../components/ui/Skeleton'
import Skeleton      from '../components/ui/Skeleton'
import { cn }        from '../lib/cn'
import { getCachedPrice } from '../lib/priceCache'
import { useMarketData } from '../hooks/useMarketData'
import { getApprovedStrategies } from '../lib/strategyService'
import { mergeApprovedAndOperator } from '../lib/mergeMarketStrategies'
import { assignMarketBadges, normalizeMarketStrategy } from '../lib/marketStrategy'
import { isSupabaseConfigured } from '../lib/supabase'
import { HOME_WATCH_SYMBOLS } from '../lib/homeWatchlist'
import { isMarketLocked, canViewPremiumStrategies, PLAN_MESSAGES } from '../lib/userPlan'
import { formatUsd, formatKrw } from '../lib/priceFormat'
import { STRATEGIES } from '../data/simulationMockData'
import { buildHomeRetentionStrip } from '../lib/retentionSnapshot'
import { buildMarketBrief } from '../lib/marketBrief'
import { deltaTextClass, deltaArrow } from '../lib/deltaDisplay'

const HERO_ASSETS = ['BTC', 'ETH', 'SOL']
const RECOMMENDED_LIMIT = 8

/* ── 시장 상태 판단 유틸 ──────────────────── */
function classifyTrend(pct) {
  if (pct > 2) return { label: '강한 상승', color: 'blue', icon: 'up' }
  if (pct > 0.3) return { label: '완만 상승', color: 'blue', icon: 'up' }
  if (pct < -2) return { label: '강한 하락', color: 'red', icon: 'down' }
  if (pct < -0.3) return { label: '완만 하락', color: 'red', icon: 'down' }
  return { label: '횡보', color: 'slate', icon: 'flat' }
}

function classifyVolatility(avgRange) {
  if (avgRange >= 2.2) return { label: '높음', color: 'red' }
  if (avgRange >= 1.0) return { label: '보통', color: 'amber' }
  return { label: '낮음', color: 'slate' }
}

function inferMarketReason(changePct, volLabel) {
  if (changePct > 2 && volLabel === '높음') return 'ETF 자금 유입 · 기관 매수세 추정'
  if (changePct > 1) return '나스닥 연동 상승 · 위험선호 확대'
  if (changePct < -2) return '거시 불확실성 · 리스크오프 전환'
  if (changePct < -1) return '차익 매물 · 단기 과열 해소'
  return '뚜렷한 방향성 부재 · 관망 분위기'
}

/* ── 글로벌 지표 시뮬레이션 (BTC 변동률만으로 결정론적 추정 — 렉·깜빡임 방지) ── */
function estimateGlobalIndices(btcChange) {
  const c = Number(btcChange) || 0
  const nasdaqChange = c * 0.675 + Math.sin(c * 0.07) * 0.12
  const sp500Change = nasdaqChange * 0.71
  const dowChange = sp500Change * 0.86

  const riskSentiment = c > 0 && nasdaqChange > 0 ? 'risk-on'
    : c < 0 && nasdaqChange < 0 ? 'risk-off' : '혼조'

  return {
    nasdaq: { change: nasdaqChange, label: 'NASDAQ' },
    sp500: { change: sp500Change, label: 'S&P 500' },
    dow: { change: dowChange, label: 'DOW' },
    btc: { change: c, label: 'BTC' },
    sentiment: riskSentiment,
  }
}

/* ── 서브 컴포넌트 ────────────────────────── */

function MarketPulse({ btcQuote, brief, showSkeleton }) {
  const changePct = Number(btcQuote?.changePercent ?? 0)
  const trend = classifyTrend(changePct)
  const volLabel = brief ? classifyVolatility(
    brief.headline?.includes('높은') ? 2.5 : brief.headline?.includes('보통') ? 1.5 : 0.5,
  ) : { label: '—', color: 'slate' }
  const reason = inferMarketReason(changePct, volLabel.label)

  const trendColors = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-900/50',
    red: 'text-red-600 bg-red-50 dark:bg-red-950/35 border-red-200 dark:border-red-900/50',
    slate: 'text-slate-500 bg-slate-50 dark:bg-gray-800/50 border-slate-200 dark:border-gray-700',
  }
  const volColors = {
    red: 'text-red-600',
    amber: 'text-amber-600',
    slate: 'text-slate-400',
  }

  return (
    <div className="rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-none">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-800 flex items-center gap-2">
        <Zap size={14} className="text-amber-500" />
        <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tracking-tight">지금 시장</span>
        {brief?.updatedAt && (
          <span className="ml-auto text-[10px] text-slate-400">{brief.updatedAt}</span>
        )}
      </div>
      <div className="p-4">
        {showSkeleton ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* BTC 현재 상태 */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">비트코인</p>
              <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[13px] font-bold', trendColors[trend.color])}>
                <span className="select-none" aria-hidden>{deltaArrow(changePct)}</span>
                {trend.label}
              </div>
              <p className="mt-2 text-[20px] font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatUsd(btcQuote?.usdPrice)}
              </p>
              <p className={cn(
                'mt-0.5 text-[12px] font-mono font-bold tabular-nums',
                deltaTextClass(changePct),
              )}>
                <span className="select-none mr-0.5" aria-hidden>{deltaArrow(changePct)}</span>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% <span className="text-slate-400 font-medium">(24h)</span>
              </p>
            </div>

            {/* 변동성 */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">변동성</p>
              <p className={cn('text-[18px] font-bold', volColors[volLabel.color])}>
                {volLabel.label}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {brief?.headline ?? '데이터 수집 중'}
              </p>
            </div>

            {/* 움직임 이유 */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">한 줄 해석</p>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                {reason}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                {brief?.lines?.[0] ?? ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GlobalIndicesBar({ indices, showSkeleton }) {
  if (showSkeleton || !indices) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    )
  }

  const items = [indices.nasdaq, indices.sp500, indices.dow, indices.btc]

  return (
    <div className="rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-none">
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-[#2962ff]" />
          <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">해외 증시 · BTC</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-lg',
            indices.sentiment === 'risk-on'
              ? 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300'
              : indices.sentiment === 'risk-off'
                ? 'text-red-600 bg-red-50 dark:bg-red-950/35 dark:text-red-300'
                : 'text-slate-500 bg-slate-100 dark:bg-gray-800 dark:text-slate-400',
          )}>
            {indices.sentiment === 'risk-on' ? 'Risk-On' : indices.sentiment === 'risk-off' ? 'Risk-Off' : '혼조'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-gray-800">
        {items.map((item) => {
          const pos = item.change >= 0
          return (
            <div key={item.label} className="px-4 py-3 text-center">
              <p className="text-[10px] font-semibold text-slate-400 tracking-[0.06em] uppercase mb-1">{item.label}</p>
              <div className="flex items-center justify-center gap-0.5">
                <span className={cn(
                  'text-[14px] font-bold font-mono tabular-nums',
                  pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                )}>
                  <span className="select-none mr-0.5" aria-hidden>{deltaArrow(item.change)}</span>
                  {pos ? '+' : ''}{item.change.toFixed(2)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2 border-t border-slate-100 dark:border-gray-800">
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          {indices.sentiment === 'risk-on'
            ? '→ 글로벌 위험선호 환경 · BTC·주식 동반 상승 가능성'
            : indices.sentiment === 'risk-off'
              ? '→ 방어적 환경 · 안전자산 선호 흐름 · BTC 하방 주의'
              : '→ 방향성 미정 · 개별 종목·섹터 차별화 예상'}
        </p>
      </div>
    </div>
  )
}

const HeroAssetCell = memo(function HeroAssetCell({ sym, q }) {
  const ch = q?.changePercent
  const pos = ch == null ? true : ch >= 0
  const showPriceSkeleton = !q?.usdPrice
  return (
    <div
      className="rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3.5 shadow-none"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.06em]">{sym}/USDT</p>
        <span className={cn(
          'inline-flex items-center gap-0.5 text-[11px] font-mono font-bold tabular-nums',
          ch == null ? 'text-slate-400' : deltaTextClass(ch),
        )}>
          {ch != null && <span className="select-none" aria-hidden>{deltaArrow(ch)}</span>}
          {ch != null ? `${Number(ch) >= 0 ? '+' : ''}${Number(ch).toFixed(2)}%` : '—'}
        </span>
      </div>
      {showPriceSkeleton ? (
        <Skeleton className="h-8 w-36" />
      ) : (
        <>
          <span className="text-[22px] font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums leading-none">
            {formatUsd(q?.usdPrice)}
          </span>
          <p className="mt-1.5 text-[11px] font-mono text-slate-400 tabular-nums">
            {q?.krwPrice != null ? formatKrw(q.krwPrice) : '—'}
          </p>
        </>
      )}
    </div>
  )
}, (a, b) => a.sym === b.sym && a.q?.usdPrice === b.q?.usdPrice && a.q?.krwPrice === b.q?.krwPrice && a.q?.changePercent === b.q?.changePercent)

function HeroAssetStrip({ quotes, showSkeleton }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {HERO_ASSETS.map((sym) => {
        const q = quotes.find((x) => x.symbol === sym)
        return (
          <HeroAssetCell key={sym} sym={sym} q={q} />
        )
      })}
    </div>
  )
}

const WatchListItem = memo(function WatchListItem({ q }) {
  const pos = q.changePercent == null ? true : q.changePercent >= 0
  return (
    <tr className="border-b border-slate-100/80 dark:border-gray-800/60 hover:bg-slate-50/60 dark:hover:bg-gray-800/30 transition-colors">
      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">{q.symbol}</td>
      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
        {formatUsd(q.usdPrice)}
      </td>
      <td className={cn(
        'py-2.5 px-4 text-right font-mono font-semibold tabular-nums',
        pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}>
        {q.changePercent != null && Number.isFinite(q.changePercent)
          ? `${pos ? '+' : ''}${q.changePercent.toFixed(2)}%`
          : '—'}
      </td>
      <td className="py-2.5 px-4 text-right font-mono text-slate-400 tabular-nums text-[11px]">
        {q.krwPrice != null ? formatKrw(q.krwPrice) : '—'}
      </td>
    </tr>
  )
}, (prev, next) => prev.q.symbol === next.q.symbol
  && prev.q.usdPrice === next.q.usdPrice
  && prev.q.krwPrice === next.q.krwPrice
  && prev.q.changePercent === next.q.changePercent)

function CoinPriceTable({ quotes, showSkeleton }) {
  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <Card.Title>주요 시세</Card.Title>
          <span className="text-[10px] text-slate-400">Binance USD · KRW (Upbit/Bithumb)</span>
        </div>
      </Card.Header>
      <Card.Content className="p-0 overflow-x-auto">
        <table className="w-full min-w-[480px] text-[12px]">
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-gray-800">
              <th className="text-left font-semibold text-slate-400 py-2 px-4 text-[10px] uppercase tracking-[0.06em]">심볼</th>
              <th className="text-right font-semibold text-slate-400 py-2 px-4 text-[10px] uppercase tracking-[0.06em]">USD</th>
              <th className="text-right font-semibold text-slate-400 py-2 px-4 text-[10px] uppercase tracking-[0.06em]">변동</th>
              <th className="text-right font-semibold text-slate-400 py-2 px-4 text-[10px] uppercase tracking-[0.06em]">KRW</th>
            </tr>
          </thead>
          <tbody>
            {showSkeleton && quotes.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-gray-800/60">
                  <td colSpan={4} className="py-2.5 px-4"><Skeleton className="h-4 w-full" /></td>
                </tr>
              ))
              : quotes.map((q) => (
                <WatchListItem key={q.symbol} q={q} />
              ))}
          </tbody>
        </table>
      </Card.Content>
    </Card>
  )
}

/* ── 메인 ────────────────────────────────── */

export default function HomePage({
  onNavigate,
  onGoSimulation,
  onStartTrial,
  onSubscribe,
  dataVersion = 0,
  user,
  onGoSubscription,
  onCopyStrategyToEditor,
  userStrategies = [],
  signalStrategyId = null,
  retentionUserKey = 'local',
}) {
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: [] }
  const [watchQuotes, setWatchQuotes] = useState([])
  const [watchLoading, setWatchLoading] = useState(true)
  const [watchError, setWatchError] = useState('')
  const watchFirstFetchRef = useRef(true)
  const [strategies, setStrategies] = useState([])
  const [strategiesLoading, setStrategiesLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [symbolQuery, setSymbolQuery] = useState('')
  const {
    candles: btcCandles,
    loading: btcCandleLoading,
    error: btcCandleError,
    source: btcCandleSource,
  } = useMarketData('BTCUSDT', '1h', { limit: 48, pollMs: 1500 })

  const heroQuotes = useMemo(
    () => HERO_ASSETS.map((s) => watchQuotes.find((q) => q.symbol === s) ?? { symbol: s }),
    [watchQuotes],
  )

  const btcQuote = useMemo(() => watchQuotes.find((q) => q.symbol === 'BTC') ?? {}, [watchQuotes])

  const btcBrief = useMemo(() => {
    const priceMeta = {
      usdPrice: btcQuote?.usdPrice,
      changePercent: btcQuote?.changePercent,
    }
    if (btcCandles.length === 0 && priceMeta.usdPrice == null) return null
    return buildMarketBrief({ candles: btcCandles, priceMeta })
  }, [btcCandles, btcQuote?.usdPrice, btcQuote?.changePercent])

  const globalIndices = useMemo(() => {
    const ch = btcQuote?.changePercent
    if (ch == null || Number.isNaN(Number(ch))) return null
    return estimateGlobalIndices(Number(ch))
  }, [btcQuote?.changePercent])

  const filteredQuotes = useMemo(() => {
    const q = String(symbolQuery ?? '').trim().toUpperCase()
    if (!q) return watchQuotes
    return (watchQuotes ?? []).filter((x) => String(x.symbol ?? '').toUpperCase().includes(q))
  }, [watchQuotes, symbolQuery])

  useEffect(() => {
    let cancelled = false
    const POLL_MS = 1500

    async function loadWatch() {
      const isFirst = watchFirstFetchRef.current
      if (isFirst) {
        setWatchLoading(true)
        setWatchError('')
      }
      try {
        const results = await Promise.allSettled(
          HOME_WATCH_SYMBOLS.map((sym) => getCachedPrice(sym)),
        )
        const rows = HOME_WATCH_SYMBOLS.map((sym, i) => {
          const r = results[i]
          if (r.status === 'fulfilled' && r.value) {
            return { symbol: sym, ...r.value, error: null }
          }
          return { symbol: sym, usdPrice: null, krwPrice: null, krwSource: null, changePercent: null, error: r.reason?.message ?? '조회 실패' }
        })
        if (!cancelled) {
          setWatchQuotes((prev) => {
            if (!prev.length) return rows
            return rows.map((row) => {
              const old = prev.find((p) => p.symbol === row.symbol)
              return old ? { ...old, ...row } : row
            })
          })
        }
      } catch (e) {
        if (!cancelled && watchFirstFetchRef.current) {
          setWatchError(e?.message ?? '시세 조회 실패')
        }
      } finally {
        if (!cancelled && watchFirstFetchRef.current) {
          setWatchLoading(false)
          watchFirstFetchRef.current = false
        }
      }
    }
    loadWatch()
    const id = setInterval(loadWatch, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setStrategiesLoading(true)
        setLoadErr('')
        let db = []
        if (isSupabaseConfigured()) {
          db = await getApprovedStrategies()
        }
        const dbMapped = (db ?? []).map((s) => normalizeMarketStrategy({
          ...s,
          author: s.author ?? '커뮤니티',
          assetType: String(s.asset ?? '').toLowerCase(),
          timeframe: s.timeframe ?? '',
          typeLabel: '사용자 전략',
          status: s.status ?? 'approved',
          isDbStrategy: true,
          isOperator: false,
          type: s.strategy_type ?? 'trend',
          roi7d: null,
          recommendBadge: null,
          ctaStatus: 'not_started',
          fitSummary: (typeof s.description === 'string' && s.description.trim())
            ? s.description.trim().slice(0, 120)
            : '승인된 사용자 전략',
        }))
        if (!cancelled) setStrategies(mergeApprovedAndOperator(dbMapped))
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message ?? '전략 목록을 불러오지 못했습니다.')
          setStrategies(mergeApprovedAndOperator([]))
        }
      } finally {
        if (!cancelled) setStrategiesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [dataVersion])

  const withBadges = useMemo(
    () => assignMarketBadges(strategies.map((s) => normalizeMarketStrategy(s))),
    [strategies],
  )

  const recommendedTop = useMemo(() => {
    return [...withBadges]
      .sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0))
      .slice(0, RECOMMENDED_LIMIT)
  }, [withBadges])

  const heroStrategy = useMemo(() => recommendedTop?.[0] ?? null, [recommendedTop])
  const subStrategies = useMemo(() => (recommendedTop ?? []).slice(1, 7), [recommendedTop])

  const todaysStrategy = useMemo(() => {
    if (!withBadges.length) return null
    const start = new Date(new Date().getFullYear(), 0, 0)
    const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000)
    return withBadges[dayOfYear % withBadges.length]
  }, [withBadges])

  const signalContext = useMemo(() => {
    const id = signalStrategyId
    if (!id) return { title: '선택된 전략 없음', sub: '시그널에서 전략을 선택하세요.' }
    const us = userStrategies.find((s) => s.id === id)
    if (us) return { title: us.name, sub: '내 전략 · 시그널 연결됨' }
    const cat = STRATEGIES.find((s) => s.id === id)
    if (cat) return { title: cat.name, sub: '카탈로그 전략' }
    return { title: '커스텀 선택', sub: String(id).slice(0, 12) }
  }, [signalStrategyId, userStrategies])

  const homeRetention = useMemo(() => {
    const key = userStrategies[0]?.id ?? signalStrategyId ?? 'default'
    return buildHomeRetentionStrip({ strategyKey: key, userKey: retentionUserKey })
  }, [userStrategies, signalStrategyId, retentionUserKey])

  const myStrategyStatus = useMemo(() => {
    const rows = userStrategies ?? []
    if (rows.length === 0) return { empty: true, total: 0, draft: 0, pipeline: 0, approved: 0 }
    const n = (st) => rows.filter((r) => String(r.status ?? '') === st).length
    return { empty: false, total: rows.length, draft: n('draft'), pipeline: n('submitted') + n('under_review'), approved: n('approved') }
  }, [userStrategies])

  function handleSimulateFromModal() {
    if (selectedStrategy) onGoSimulation?.(selectedStrategy.id)
    setSelectedStrategy(null)
  }

  return (
    <PageShell className="page-shell">
      {loadErr && (
        <p className="mb-4 text-[12px] text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2">
          {loadErr}
        </p>
      )}

      <section className="hero-market-summary" aria-labelledby="home-hero-heading">
        <div className="summary-main-card">
          <h1 id="home-hero-heading" className="product-h1">
            오늘 시장과 전략을 한눈에
          </h1>
          <p className="product-lead">
            <strong className="font-semibold text-slate-800 dark:text-slate-200">홈</strong>
            에서는 지금 시장 분위기와 추천 전략을 보고,
            {' '}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">마켓</strong>
            에서는 구독·비교할 전략을 고릅니다.
          </p>
        </div>
        {btcCandleError && btcCandleSource === 'fallback' && (
          <p className="mb-3 text-[12px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-3 py-2">
            캔들 API 연결에 실패해 시장 요약은 제한적으로 표시됩니다.
          </p>
        )}
        <MarketPulse
          btcQuote={btcQuote}
          brief={btcBrief}
          showSkeleton={(watchLoading && watchQuotes.length === 0) || (btcCandleLoading && btcCandles.length === 0)}
        />
        <GlobalIndicesBar indices={globalIndices} showSkeleton={watchLoading && watchQuotes.length === 0} />
      </section>

      <div className="mb-7">
        <HeroAssetStrip quotes={heroQuotes} />
      </div>

      {/* 행동 루프: 오늘의 전략 · 시그널 · 내 전략 */}
      <section className="home-live-signals grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-amber-500" />
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">오늘 집중할 전략</span>
            </div>
            {todaysStrategy ? (
              <>
                <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                  {todaysStrategy.name}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                  {todaysStrategy.fitSummary || '마켓에서 오늘 집중해 볼 후보입니다.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedStrategy(todaysStrategy)}>상세</Button>
                  <Button variant="ghost" size="sm" onClick={() => onNavigate?.('market')}>마켓</Button>
                </div>
              </>
            ) : (
              <div className="mt-1 space-y-2">
                <p className="text-[12px] text-slate-500 leading-snug">
                  아직 표시할 전략이 없습니다. 마켓에서 후보를 고르거나 잠시 후 다시 확인해 주세요.
                </p>
                <Button variant="primary" size="sm" type="button" onClick={() => onNavigate?.('market')}>
                  전략 마켓 보기
                </Button>
              </div>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Radio size={13} className="text-blue-500" />
              <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">시그널에서 선택한 전략</span>
            </div>
            <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
              {signalContext.title}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{signalContext.sub}</p>
            <div className="mt-3">
              <Button variant="primary" size="sm" onClick={() => onNavigate?.('signal')}>
                시그널 열기 <ArrowRight size={12} className="ml-1 opacity-80" />
              </Button>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban size={13} className="text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">내가 만든 전략</span>
            </div>
            {myStrategyStatus.empty ? (
              <>
                <p className="text-[12px] text-slate-500 leading-snug">
                  저장된 전략이 없습니다. 에디터에서 첫 전략을 만들어 보세요.
                </p>
                <Button className="mt-3" variant="secondary" size="sm" onClick={() => onNavigate?.('editor')}>
                  전략 만들기
                </Button>
              </>
            ) : (
              <>
                <p className="text-[22px] font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {myStrategyStatus.total}
                  <span className="text-[11px] font-semibold text-slate-400 ml-1">개 저장됨</span>
                </p>
                <div className="mt-1.5 flex gap-x-3 text-[11px] text-slate-500">
                  <span>초안 {myStrategyStatus.draft}</span>
                  <span>검수 {myStrategyStatus.pipeline}</span>
                  <span>승인 {myStrategyStatus.approved}</span>
                </div>
                <Button className="mt-3" variant="secondary" size="sm" onClick={() => onNavigate?.('mypage')}>내 페이지</Button>
              </>
            )}
          </Card.Content>
        </Card>
      </section>

      <section className="home-cta grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card interactive>
          <Card.Content className="p-5">
            <p className="text-[11px] font-medium text-slate-500">바로 가기</p>
            <p className="mt-1.5 text-[16px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              마켓과 시그널
            </p>
            <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed">
              전략을 고른 뒤 현재 신호까지 확인합니다.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="primary" size="md" onClick={() => onNavigate?.('market')}>
                전략 마켓 <ArrowRight size={13} className="ml-1.5 opacity-80" />
              </Button>
              <Button variant="secondary" size="md" onClick={() => onNavigate?.('signal')}>
                <Activity size={13} className="mr-1.5 opacity-80" /> 시그널
              </Button>
            </div>
          </Card.Content>
        </Card>

        <Card interactive>
          <Card.Content className="p-5">
            <p className="text-[11px] font-medium text-slate-500">만들기</p>
            <p className="mt-1.5 text-[16px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              나만의 전략
            </p>
            <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed">
              조건을 정하고 테스트한 뒤 저장·제출까지 이어갑니다.
            </p>
            <div className="mt-4">
              <Button variant="primary" size="md" onClick={() => onNavigate?.('editor')}>
                에디터 열기 <ArrowRight size={13} className="ml-1.5 opacity-80" />
              </Button>
            </div>
          </Card.Content>
        </Card>
      </section>

      {!canViewPremiumStrategies(u) && (
        <div className="mb-5 rounded-lg border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
            {PLAN_MESSAGES.marketMoreStrategies}
          </p>
          <Button variant="secondary" size="sm" onClick={() => onGoSubscription?.()}>
            플랜 비교
          </Button>
        </div>
      )}

      <section className="home-top-strategies">
        <div className="flex items-end justify-between gap-2 mb-3">
          <div>
            <h2 className="product-section-h text-[17px]">지금 볼 만한 전략</h2>
            <p className="product-section-sub mt-0.5">추천 점수 기준 상위 전략입니다.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.('market')}>전체 보기</Button>
        </div>

        {strategiesLoading ? (
          <StrategyCardSkeleton />
        ) : !heroStrategy ? (
          <EmptyState
            title="표시할 전략이 없습니다"
            description="승인·게시된 전략이 없거나 DB 연결을 확인해 주세요."
          />
        ) : (
          <StrategyCard
            strategy={heroStrategy}
            user={u}
            isLocked={isMarketLocked(heroStrategy.id, u)}
            isUserStrategy={false}
            onDetail={() => setSelectedStrategy(heroStrategy)}
            onSimulate={() => onGoSimulation?.(heroStrategy.id)}
            onStartTrial={onStartTrial}
            onGoSubscription={onGoSubscription}
            onSubscribe={onSubscribe}
            emphasizeSimulate
            showStrategyNarrative={false}
            className="md:col-span-2"
          />
        )}
      </section>

      {subStrategies.length > 0 && (
        <div className="mb-7">
          <div className="flex items-end justify-between gap-2 mb-3">
            <h3 className="product-section-h text-[15px]">더 둘러보기</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('market')}>더 보기</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {subStrategies.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                user={u}
                isLocked={isMarketLocked(s.id, u)}
                isUserStrategy={false}
                onDetail={() => setSelectedStrategy(s)}
                onSimulate={() => onGoSimulation?.(s.id)}
                onStartTrial={onStartTrial}
                onGoSubscription={onGoSubscription}
                onSubscribe={onSubscribe}
                emphasizeSimulate={false}
                showStrategyNarrative={false}
              />
            ))}
          </div>
        </div>
      )}

      <section className="home-watchlist-table">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              value={symbolQuery}
              onChange={(e) => setSymbolQuery(e.target.value)}
              placeholder="심볼 검색"
              className="h-7 w-[160px] sm:w-[200px] px-2.5 text-[11px] rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
              aria-label="심볼 검색"
            />
            {symbolQuery?.trim() && (
              <button type="button" onClick={() => setSymbolQuery('')}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                초기화
              </button>
            )}
          </div>
        </div>
        <CoinPriceTable quotes={filteredQuotes} showSkeleton={watchLoading && watchQuotes.length === 0} />
      </section>

      {watchError && (
        <p className="mb-4 text-[11px] text-slate-500">{watchError}</p>
      )}

      <StrategyDetailModal
        strategy={selectedStrategy}
        onClose={() => setSelectedStrategy(null)}
        onSimulate={handleSimulateFromModal}
        runLocked={
          !!selectedStrategy
          && !selectedStrategy.isUserStrategy
          && isMarketLocked(selectedStrategy.id, u)
        }
        onSubscribe={onSubscribe}
        onStartTrial={onStartTrial}
        onCopyToEditor={onCopyStrategyToEditor}
        user={u}
      />
    </PageShell>
  )
}

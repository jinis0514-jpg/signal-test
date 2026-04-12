import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { LayoutGrid, List, Package, Trophy, Percent, Shield } from 'lucide-react'
import { cn } from '../lib/cn'
import PageHeader            from '../components/ui/PageHeader'
import Button                from '../components/ui/Button'
import EmptyState            from '../components/ui/EmptyState'
import { StrategyCardSkeleton } from '../components/ui/Skeleton'
import MarketFilters         from '../components/market/MarketFilters'
import MarketSortBar         from '../components/market/MarketSortBar'
import MarketStrategyCard    from '../components/market/MarketStrategyCard'
import StrategyComparePanel  from '../components/market/StrategyComparePanel'
import StrategyTable         from '../components/market/StrategyTable'
import StrategyDetailModal   from '../components/market/StrategyDetailModal'
import {
  DEFAULT_FILTERS,
  applyMarketFilters,
} from '../data/marketMockData'
import { normalizeMarketStrategy, assignMarketBadges } from '../lib/marketStrategy'
import { getStrategyLiveState } from '../lib/strategyLiveState'
import { getApprovedStrategies } from '../lib/strategyService'
import { mergeApprovedAndOperator } from '../lib/mergeMarketStrategies'
import { getCachedPrice } from '../lib/priceCache'
import { isMarketLocked } from '../lib/userPlan'
import { formatUsd, formatKrw } from '../lib/priceFormat'
import { copy as assetUniverseCopy } from '../lib/assetValidationUniverse'
import { useFavoriteStrategies } from '../hooks/useFavoriteStrategies'
import {
  classifyMarketState,
  recommendStrategiesByMarket,
} from '../lib/marketStateEngine'
import {
  buildRecommendedPortfolio,
  describePortfolioMix,
  buildStrategyPortfolio,
} from '../lib/strategyPortfolioEngine'

const LS_MARKET_SEARCH = 'bb_market_search_v1'
function fmtPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
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

function metric(strategy) {
  const ret = Number(strategy?.totalReturnPct ?? strategy?.roi ?? 0)
  const mdd = Number(strategy?.maxDrawdown ?? Math.abs(strategy?.mdd ?? 0))
  const win = Number(strategy?.winRate ?? 0)
  const trades = Number(strategy?.tradeCount ?? strategy?.trades ?? 0)
  const r7 = Number(strategy?.recentRoi7d ?? strategy?.roi7d ?? 0)
  const r30 = Number(strategy?.recentRoi30d ?? strategy?.roi30d ?? 0)
  const ls = getStrategyLiveState(strategy)
  const pos = ls.kind === 'long_open' ? 'LONG' : ls.kind === 'short_open' ? 'SHORT' : '대기'
  return { ret, mdd, win, trades, r7, r30, pos }
}

/* 카드 / 표 보기 토글 */
function ViewToggle({ view, onChange }) {
  const btn = (mode, Icon, label) => (
    <button
      onClick={() => onChange(mode)}
      aria-label={label}
      className={cn(
        'w-6 h-6 flex items-center justify-center transition-colors',
        'border-l first:border-l-0 border-slate-200 dark:border-gray-700',
        view === mode
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-gray-900 dark:text-slate-500 dark:hover:bg-gray-800',
      )}
    >
      <Icon size={11} strokeWidth={1.8} />
    </button>
  )

  return (
    <div className="flex border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {btn('card',  LayoutGrid, '카드 보기')}
      {btn('table', List,       '표 보기'  )}
    </div>
  )
}

/* ── MarketPage ──────────────────────────── */

export default function MarketPage({
  onNavigate,
  onGoSimulation,
  onGoValidation,
  onStartTrial,
  onSubscribe,
  onGoSubscription,
  onCopyStrategyToEditor,
  user,
  dataVersion = 0,
}) {
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: [] }
  const [filters,          setFilters]          = useState(() => {
    try {
      const savedSearch = localStorage.getItem(LS_MARKET_SEARCH) ?? ''
      return { ...DEFAULT_FILTERS, search: savedSearch }
    } catch {
      return DEFAULT_FILTERS
    }
  })
  const [viewMode,         setViewMode]         = useState('card')
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [comparedIds, setComparedIds] = useState([])
  const [strategies,       setStrategies]       = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [listRetryNonce,   setListRetryNonce]   = useState(0)
  const [btcDisplay,       setBtcDisplay]       = useState(null)
  const [ethDisplay,       setEthDisplay]       = useState(null)
  const [btcPriceError,    setBtcPriceError]    = useState('')
  const [lastSlowUpdateAt, setLastSlowUpdateAt] = useState(0)
  const btcPriceFirstFetchRef = useRef(true)
  const { favoriteSet, toggleFavoriteStrategy } = useFavoriteStrategies()

  function handleSimulate(strategy) {
    const isMethod = String(strategy?.type ?? 'signal') === 'method'
    const targetId = isMethod ? strategy?.linked_signal_strategy_id : strategy?.id
    if (!targetId) return
    onGoSimulation?.(targetId)
  }

  const handleOpenDetail = useCallback((strategy) => {
    if (!strategy) return
    setSelectedStrategy(strategy)
  }, [])

  const handleToggleCompare = useCallback((strategy) => {
    const id = strategy?.id
    if (!id) return
    setComparedIds((prev) => {
      const has = prev.includes(id)
      if (has) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }, [])

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  function handleReset() {
    setFilters({ ...DEFAULT_FILTERS, search: '' })
    try {
      localStorage.setItem(LS_MARKET_SEARCH, '')
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(LS_MARKET_SEARCH, String(filters.search ?? ''))
    } catch {
      // ignore
    }
  }, [filters.search])

  /* Supabase approved/published 전략만 로드 (마켓 source of truth) */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!cancelled) { setLoading(true); setError('') }
        const data = await getApprovedStrategies()
        const dbMapped = (data ?? []).map((s) => normalizeMarketStrategy({
          ...s,
          author: s.author ?? '커뮤니티',
          assetType: String(s.asset ?? '').toLowerCase(),
          timeframe: s.timeframe ?? '',
          type: s.type ?? 'signal',
          typeLabel: (s.type ?? 'signal') === 'method' ? '매매법' : '전략',
          strategy_summary: s.strategy_summary ?? '',
          entry_logic: s.entry_logic ?? '',
          exit_logic: s.exit_logic ?? '',
          market_condition: s.market_condition ?? '',
          risk_description: s.risk_description ?? '',
          strategy_pdf_path: s.strategy_pdf_path ?? null,
          strategy_pdf_preview_path: s.strategy_pdf_preview_path ?? null,
          strategy_preview_mode: s.strategy_preview_mode ?? 'none',
          status: s.status ?? 'approved',
          isDbStrategy: true,
          isOperator: false,
          strategyType: s.strategy_type ?? 'trend',
          strategyTypeLabel: s.strategy_type ? String(s.strategy_type) : '—',
          roi7d: null,
          fitSummary: (typeof s.strategy_summary === 'string' && s.strategy_summary.trim())
            ? s.strategy_summary.trim().slice(0, 120)
            : (typeof s.description === 'string' && s.description.trim())
              ? s.description.trim().slice(0, 120)
              : '승인된 사용자 전략',
          recommendBadge: null,
          ctaStatus: 'not_started',
        }))
        if (!cancelled) {
          const merged = mergeApprovedAndOperator(dbMapped)
          const byId = new Map(merged.map((x) => [x.id, x]))
          const enriched = merged.map((x) => {
            if (String(x.type ?? 'signal') !== 'method') return x
            const lid = x.linked_signal_strategy_id
            const linked = lid ? byId.get(lid) : null
            return {
              ...x,
              linkedSignalName: linked?.name ?? null,
              linkedSignalStrategy: linked ?? null,
            }
          })
          setStrategies(enriched)
        }
      } catch (e) {
        if (!cancelled) {
          setStrategies(mergeApprovedAndOperator([]))
          setError(e?.message ?? 'DB 전략 조회 실패')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [dataVersion, listRetryNonce])

  useEffect(() => {
    let cancelled = false
    const POLL_MS = 5000

    ;(async () => {
      try {
        if (btcPriceFirstFetchRef.current) setBtcPriceError('')
        const [tBtc, tEth] = await Promise.all([
          getCachedPrice('BTC'),
          getCachedPrice('ETH'),
        ])
        if (!cancelled) {
          setBtcDisplay((prev) => tBtc ?? prev)
          setEthDisplay((prev) => tEth ?? prev)
          setLastSlowUpdateAt(Date.now())
        }
      } catch (e) {
        if (!cancelled && btcPriceFirstFetchRef.current) {
          setBtcDisplay(null)
          setBtcPriceError(e?.message ?? 'BTC 가격 조회 실패')
        }
      } finally {
        if (!cancelled) btcPriceFirstFetchRef.current = false
      }
    })()

    const timer = setInterval(async () => {
      try {
        const [tBtc, tEth] = await Promise.all([
          getCachedPrice('BTC'),
          getCachedPrice('ETH'),
        ])
        if (!cancelled) {
          setBtcDisplay((prev) => tBtc ?? prev)
          setEthDisplay((prev) => tEth ?? prev)
          setLastSlowUpdateAt(Date.now())
        }
      } catch {
        /* 실시간 보조 정보 — 이전 값 유지 */
      }
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const marketStateEngineInput = useMemo(() => {
    const btc = Number(btcDisplay?.changePercent)
    const eth = Number(ethDisplay?.changePercent)
    const avgRangePct = (Math.abs(Number.isFinite(btc) ? btc : 0) + Math.abs(Number.isFinite(eth) ? eth : 0)) / 2
    return {
      btcChange24h: Number.isFinite(btc) ? btc : 0,
      ethChange24h: Number.isFinite(eth) ? eth : 0,
      avgRangePct,
      dominanceTrend: '',
      volumeTrend: '',
    }
  }, [btcDisplay?.changePercent, ethDisplay?.changePercent])

  const marketStateClassified = useMemo(
    () => classifyMarketState(marketStateEngineInput),
    [marketStateEngineInput],
  )

  const marketRecommendedTopIds = useMemo(() => {
    const top = recommendStrategiesByMarket(strategies, marketStateClassified)
    return new Set(top.map((s) => s.id))
  }, [strategies, marketStateClassified])

  const marketSignalStrategies = useMemo(
    () => strategies.filter((s) => String(s.type ?? 'signal') !== 'method'),
    [strategies],
  )

  const marketPortfolioBundle = useMemo(
    () => buildRecommendedPortfolio(marketSignalStrategies, marketStateClassified),
    [marketSignalStrategies, marketStateClassified],
  )

  const marketPortfolioMixText = useMemo(
    () => describePortfolioMix(marketPortfolioBundle.picks),
    [marketPortfolioBundle],
  )

  const marketPortfolioRoles = useMemo(
    () => buildStrategyPortfolio(marketSignalStrategies),
    [marketSignalStrategies],
  )

  const filtered = useMemo(() => {
    let list = assignMarketBadges(applyMarketFilters(strategies, filters))
    const lens = filters.marketLens ?? []
    if (lens.includes('fit')) {
      list = list.filter((s) => marketRecommendedTopIds.has(s.id))
    }
    if (lens.includes('trend')) {
      list = list.filter((s) => s.typeKey === 'trend' || s.typeLabel === '추세형')
    }
    if (lens.includes('scalping')) {
      list = list.filter((s) => s.typeKey === 'scalping' || s.typeLabel === '단타형')
    }
    return list
  }, [strategies, filters, marketRecommendedTopIds])

  const comparedStrategies = useMemo(() => {
    return filtered.filter((s) => comparedIds.includes(s.id))
  }, [filtered, comparedIds])

  const featured = useMemo(() => {
    const score = (s) => {
      const ret = Number(s.totalReturnPct ?? s.roi)
      const mdd = Number(s.maxDrawdown ?? Math.abs(s.mdd ?? 0))
      const win = Number(s.winRate ?? 0)
      const trades = Number(s.tradeCount ?? s.trades ?? 0)
      const rec = String(s.recommendBadge ?? '')
      const recW = rec === 'BEST' ? 3 : rec === 'GOOD' ? 2 : rec === 'RISKY' ? 1 : 0
      const opW = s.isOperator ? 2 : 0
      const stW = String(s.status ?? '') === 'approved' ? 1 : 0
      const roi7d = Number(s.roi7d ?? 0)
      const base = (Number.isFinite(ret) ? ret : 0) + (Number.isFinite(roi7d) ? roi7d * 0.4 : 0)
      const stability = (Number.isFinite(mdd) ? (0 - mdd) : 0) + (Number.isFinite(win) ? (win - 50) * 0.05 : 0)
      const depth = Number.isFinite(trades) ? Math.min(1.5, Math.log10(Math.max(1, trades)) * 0.6) : 0
      return base + stability + depth + recW * 2 + opW * 2 + stW
    }

    const list = [...filtered]
      .filter((s) => !isMarketLocked(s.id, u)) // 대표 영역은 우선 "선택 가능" 중심
      .sort((a, b) => score(b) - score(a))

    return list.slice(0, 1)
  }, [filtered, u])

  /* TOP 5 랭킹 — 전체 목록 기준 (필터 무관) */
  const topRankings = useMemo(() => {
    const valid = strategies.filter((s) => String(s.type ?? 'signal') !== 'method')
    const topBy = (key, dir = 'desc') => {
      const arr = [...valid].filter((s) => Number.isFinite(Number(s[key])))
      arr.sort((a, b) => dir === 'desc' ? Number(b[key]) - Number(a[key]) : Number(a[key]) - Number(b[key]))
      return arr.slice(0, 5)
    }
    return {
      roi: topBy('totalReturnPct', 'desc'),
      winRate: topBy('winRate', 'desc'),
      recentRise: topBy('recentRoi7d', 'desc'),
    }
  }, [strategies])

  return (
    <div className="page-shell flex flex-col md:flex-row min-h-full">

      {/* 좌측 필터 패널 */}
      <aside
        className="
          market-filters
          w-full md:w-[308px] flex-shrink-0
          md:sticky md:top-0 md:h-[calc(100vh-44px)]
          max-h-[40vh] md:max-h-none overflow-y-auto
          border-b md:border-b-0 md:border-r border-slate-100 dark:border-gray-800
          bg-white dark:bg-gray-900
        "
      >
        <MarketFilters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
        />
      </aside>

      <div className="market-main flex-1 min-w-0 p-3 sm:p-4">

        <PageHeader
          title="전략 마켓"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 tabular-nums">
                BTC{' '}
                {btcDisplay?.usdPrice != null
                  ? (
                    <>
                      {formatUsd(btcDisplay.usdPrice)}
                      {btcDisplay.krwPrice != null && (
                        <span className="text-slate-400">
                          {' '}· {formatKrw(btcDisplay.krwPrice)}
                        </span>
                      )}
                    </>
                  )
                  : (btcPriceError ? 'N/A' : '...')}
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {filtered.length}개 전략
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                업데이트 {fmtLiveTime(lastSlowUpdateAt)}
              </span>
            </div>
          }
        />

        <p className="mb-3 text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed rounded-lg border border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/35 px-2.5 py-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300">알트(ALT) 전략:</span>{' '}
          {assetUniverseCopy.altBasketValidation}
        </p>

        {!loading && marketPortfolioBundle.picks.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 to-white px-3 py-2.5 shadow-sm dark:border-gray-700 dark:from-gray-900/85 dark:to-gray-900/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                조합 추천 · {marketPortfolioBundle.summary}
              </p>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {marketStateClassified.marketTrend ?? ''} · 변동성 {marketStateClassified.volatilityLabel ?? '—'}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
              {marketPortfolioBundle.reason}
            </p>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
              {marketPortfolioMixText}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {marketPortfolioBundle.picks.map((s) => (
                <button
                  key={`pf-${s.id}`}
                  type="button"
                  onClick={() => handleOpenDetail(s)}
                  className="max-w-full truncate rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-left text-[10px] font-medium text-slate-800 transition-colors hover:border-sky-300 hover:bg-sky-50/80 dark:border-gray-700 dark:bg-gray-900/60 dark:text-slate-100 dark:hover:border-sky-800 dark:hover:bg-sky-950/30"
                >
                  {s.name}
                </button>
              ))}
            </div>
            {(marketPortfolioRoles.stable || marketPortfolioRoles.aggressive) ? (
              <p className="mt-2 text-[9px] text-slate-500 dark:text-slate-500 leading-relaxed">
                성격 보완 참고:
                {' '}
                {[
                  marketPortfolioRoles.stable && `안정 ${marketPortfolioRoles.stable.name}`,
                  marketPortfolioRoles.aggressive && `공격 ${marketPortfolioRoles.aggressive.name}`,
                ].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        )}

        {comparedStrategies.length > 0 && (
          <>
            <div className="sticky top-0 z-20 mb-4 rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 dark:border-gray-700 dark:bg-gray-900/95">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    전략 비교 {comparedStrategies.length}/3
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    성격·성과·리스크·신뢰를 함께 보세요. 아래 패널에서 요약과 표를 확인합니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="#market-strategy-compare"
                    className="hidden sm:inline h-8 px-3 text-xs leading-8 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-slate-400 dark:hover:bg-gray-800"
                  >
                    표로 이동
                  </a>
                  <button
                    type="button"
                    onClick={() => setComparedIds([])}
                    className="h-8 px-3 text-xs rounded-md border border-slate-200 text-slate-500 dark:border-gray-700 dark:text-slate-400"
                  >
                    초기화
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <StrategyComparePanel strategies={comparedStrategies} marketState={marketStateClassified} />
            </div>
          </>
        )}

        {/* ── 랭킹 (탐색) TOP 5 ── */}
        {!loading && strategies.length > 0 && (
          <div className="market-top-ranking">
            <div className="mb-2">
              <h2 className="product-section-h text-[15px]">랭킹으로 빠르게 찾기</h2>
              <p className="product-section-sub text-[12px]">수익률/승률/최근 상승 전략 TOP 5를 먼저 비교해 빠르게 고를 수 있습니다.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

              {/* 수익률 TOP 5 */}
              <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-gray-800 bg-emerald-50/90 dark:bg-emerald-950/20">
                  <Trophy size={11} strokeWidth={1.8} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">수익률 TOP 5</span>
                </div>
                {topRankings.roi.length === 0 ? (
                  <p className="px-3 py-3 text-[10px] text-slate-400">데이터 없음</p>
                ) : (
                  topRankings.roi.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleOpenDetail(s)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors border-b border-slate-50 dark:border-gray-800/60 last:border-b-0"
                    >
                      <span className={cn(
                        'text-[11px] font-bold w-4 shrink-0 tabular-nums',
                        i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-400',
                      )}>
                        {i + 1}
                      </span>
                      <p className="flex-1 min-w-0 text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {s.name}
                      </p>
                      <span className={cn(
                        'text-[11px] font-bold tabular-nums shrink-0',
                        Number(s.totalReturnPct ?? s.roi) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                      )}>
                        {fmtPct(s.totalReturnPct ?? s.roi)}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* 승률 TOP 5 */}
              <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-gray-800 bg-blue-50/80 dark:bg-blue-950/25">
                  <Percent size={11} strokeWidth={1.8} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-[9px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest">승률 TOP 5</span>
                </div>
                {topRankings.winRate.length === 0 ? (
                  <p className="px-3 py-3 text-[10px] text-slate-400">데이터 없음</p>
                ) : (
                  topRankings.winRate.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleOpenDetail(s)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors border-b border-slate-50 dark:border-gray-800/60 last:border-b-0"
                    >
                      <span className={cn(
                        'text-[11px] font-bold w-4 shrink-0 tabular-nums',
                        i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-400',
                      )}>
                        {i + 1}
                      </span>
                      <p className="flex-1 min-w-0 text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {s.name}
                      </p>
                      <span className={cn(
                        'text-[11px] font-bold tabular-nums shrink-0',
                        Number(s.winRate) >= 55 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300',
                      )}>
                        {Number(s.winRate).toFixed(1)}%
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* 최근 상승 전략 TOP 5 */}
              <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/40">
                  <Shield size={11} strokeWidth={1.8} className="text-slate-600 dark:text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">최근 상승 전략</span>
                </div>
                {topRankings.recentRise.length === 0 ? (
                  <p className="px-3 py-3 text-[10px] text-slate-400">데이터 없음</p>
                ) : (
                  topRankings.recentRise.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleOpenDetail(s)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors border-b border-slate-50 dark:border-gray-800/60 last:border-b-0"
                    >
                      <span className={cn(
                        'text-[11px] font-bold w-4 shrink-0 tabular-nums',
                        i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-400',
                      )}>
                        {i + 1}
                      </span>
                      <p className="flex-1 min-w-0 text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {s.name}
                      </p>
                      <span className={cn(
                        'text-[11px] font-bold tabular-nums shrink-0',
                        Number(s.recentRoi7d) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                      )}>
                        7일 {fmtPct(s.recentRoi7d)}
                      </span>
                    </button>
                  ))
                )}
              </div>

            </div>
          </div>
        )}

        {/* 2) 지금 가장 추천하는 전략 (1개) */}
        {featured.length > 0 && (
          <div className="mb-4">
            <div className="flex items-end justify-between gap-2 mb-2 flex-wrap">
              <div>
                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  지금 가장 추천하는 전략
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  처음이라면 이 전략부터 시작하세요.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewMode('card')}>
                카드로 보기
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {featured.map((s) => (
                <div key={`featured-${s.id}`}>
                  <MarketStrategyCard
                    strategy={s}
                    user={u}
                    isLocked={isMarketLocked(s.id, u)}
                    isUserStrategy={false}
                    onDetail={() => handleOpenDetail(s)}
                    onSimulate={() => handleSimulate(s)}
                    onStartTrial={onStartTrial}
                    onGoSubscription={onGoSubscription}
                    onSubscribe={onSubscribe}
                    onToggleFavorite={toggleFavoriteStrategy}
                    isFavorite={favoriteSet.has(s.id)}
                    onToggleCompare={handleToggleCompare}
                    compared={comparedIds.includes(s.id)}
                    marketState={marketStateClassified}
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    분류: {s.typeLabel ?? '추세형'} · {s.profileLabel ?? '안정형'} · 최대 손실 -{Number(s.maxDrawdown ?? s.mdd ?? 0).toFixed(1)}% · {Number(s.maxDrawdown ?? s.mdd ?? 0) >= 15 ? '변동성 있음' : '변동성 낮음'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3) 전체 목록 — 정렬 / 보기 */}
        <div className="mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">전체 전략 · 비교</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            필터와 정렬로 후보를 줄인 뒤, 카드의「비교」로 최대 3개를 고르세요.
          </p>
        </div>
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <MarketSortBar
            value={filters.sort}
            onChange={(v) => handleFilterChange('sort', v)}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 tabular-nums">
              {filtered.length}개
            </span>
            <ViewToggle view={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {loading && strategies.length > 0 && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-[11px] text-slate-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-slate-300">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" aria-hidden />
            목록을 새로 고치는 중입니다…
          </div>
        )}

        {loading && strategies.length === 0 ? (
          <div className="market-card-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <StrategyCardSkeleton key={i} />
            ))}
          </div>
        ) : strategies.length === 0 && error ? (
          <EmptyState
            icon={<Package size={28} strokeWidth={1.2} />}
            title="전략 목록을 불러오지 못했습니다"
            description={`${error} 다시 시도하거나 문의해주세요.`}
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="primary" size="sm" type="button" onClick={() => setListRetryNonce((n) => n + 1)}>
                  다시 시도
                </Button>
                <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('home')}>
                  홈으로
                </Button>
              </div>
            }
          />
        ) : strategies.length === 0 ? (
          <EmptyState
            icon={<Package size={28} strokeWidth={1.2} />}
            title="아직 등록된 전략이 없습니다"
            description="첫 전략을 만들어보세요"
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="primary" size="sm" onClick={() => onNavigate?.('editor')}>
                  전략 만들기
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onNavigate?.('mypage')}>
                  내 제출 상태
                </Button>
              </div>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package size={28} strokeWidth={1.2} />}
            title="검색 결과가 없습니다"
            description="다른 키워드로 검색해보세요."
            action={
              <Button variant="secondary" size="sm" onClick={handleReset}>
                필터 초기화
              </Button>
            }
          />
        ) : viewMode === 'card' ? (
          <div className="market-card-list">
            {filtered.map((s) => (
              <MarketStrategyCard
                key={s.id}
                strategy={s}
                user={u}
                isLocked={isMarketLocked(s.id, u)}
                isUserStrategy={false}
                onDetail={() => handleOpenDetail(s)}
                onSimulate={() => handleSimulate(s)}
                onStartTrial={onStartTrial}
                onGoSubscription={onGoSubscription}
                onSubscribe={onSubscribe}
                onToggleFavorite={toggleFavoriteStrategy}
                isFavorite={favoriteSet.has(s.id)}
                onToggleCompare={handleToggleCompare}
                compared={comparedIds.includes(s.id)}
                marketState={marketStateClassified}
              />
            ))}
          </div>
        ) : (
          <StrategyTable
            strategies={filtered}
            user={u}
            onDetail={handleOpenDetail}
            onSimulate={handleSimulate}
            onStartTrial={onStartTrial}
            onGoSubscription={onGoSubscription}
            onSubscribe={onSubscribe}
          />
        )}
      </div>

      <StrategyDetailModal
        strategy={selectedStrategy}
        strategyPool={strategies}
        onOpenRelatedStrategy={(s) => setSelectedStrategy(s)}
        marketEvaluationContext={{
          btcChangePercent: btcDisplay?.changePercent,
          ethChange24h: ethDisplay?.changePercent,
          avgRangePct: marketStateEngineInput.avgRangePct,
          dominanceTrend: '',
          volumeTrend: '',
        }}
        onClose={() => setSelectedStrategy(null)}
        onSimulate={
          selectedStrategy ? () => handleSimulate(selectedStrategy) : undefined
        }
        onGoValidation={
          selectedStrategy
            ? () => {
                const isMethod = String(selectedStrategy?.type ?? 'signal') === 'method'
                const targetId = isMethod
                  ? selectedStrategy?.linked_signal_strategy_id
                  : selectedStrategy?.id
                if (targetId) onGoValidation?.(targetId)
                setSelectedStrategy(null)
              }
            : undefined
        }
        runLocked={
          !!selectedStrategy
          && !selectedStrategy.isUserStrategy
          && isMarketLocked(selectedStrategy.id, u)
        }
        onSubscribe={onSubscribe}
        onStartTrial={onStartTrial}
        onCopyToEditor={onCopyStrategyToEditor}
        user={u}
        onToggleCompare={handleToggleCompare}
        isCompared={!!selectedStrategy && comparedIds.includes(selectedStrategy.id)}
        compareAddDisabled={
          !!selectedStrategy
          && comparedIds.length >= 3
          && !comparedIds.includes(selectedStrategy.id)
        }
      />
    </div>
  )
}

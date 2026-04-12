import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import {
  Star, Bookmark, History, RadioReceiver,
} from 'lucide-react'
import PageShell     from '../components/ui/PageShell'
import Card          from '../components/ui/Card'
import Button        from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState    from '../components/ui/EmptyState'
import StrategyDetailModal from '../components/market/StrategyDetailModal'
import VerificationBadge from '../components/verification/VerificationBadge'
import { StrategyCardSkeleton } from '../components/ui/Skeleton'
import Skeleton      from '../components/ui/Skeleton'
import { cn }        from '../lib/cn'
import { panelBase, panelEmphasis, panelWarning } from '../lib/panelStyles'
import { getCachedPrice } from '../lib/priceCache'
import { getApprovedStrategies } from '../lib/strategyService'
import { mergeApprovedAndOperator } from '../lib/mergeMarketStrategies'
import { assignMarketBadges, normalizeMarketStrategy } from '../lib/marketStrategy'
import { RECOMMEND_CONFIG } from '../lib/strategyStatus'
import { isSupabaseConfigured } from '../lib/supabase'
import { fetchBinanceUsdt24hrWatchRows } from '../lib/binanceUsdUniverse'
import { useFavoriteSymbols } from '../hooks/useFavoriteSymbols'
import { useFavoriteStrategies } from '../hooks/useFavoriteStrategies'
import { useRecentViewedStrategies } from '../hooks/useRecentViewedStrategies'
import { useViewedSignals } from '../hooks/useViewedSignals'
import { isMarketLocked, resolveSimIdForUnlock } from '../lib/userPlan'
import { formatUsd, formatKrw } from '../lib/priceFormat'
import { deltaTextClass, deltaArrow } from '../lib/deltaDisplay'
import { pickTopStrategy } from '../lib/strategyRecommendation'
import { pickMarketBasedRecommendations } from '../lib/marketBasedRecommend'
import { safeArray } from '../lib/safeValues'
import { buildRealTradeVerificationView, formatVerificationHomeHint } from '../lib/realTradeVerificationUi'
import { getStrategyLiveState, getStrategyLiveStateLine } from '../lib/strategyLiveState'
import { evaluateStrategy } from '../lib/strategyEvaluator'
import {
  classifyMarketState,
  getMarketInsight,
  recommendStrategiesByMarket,
} from '../lib/marketStateEngine'
import { computeTrustScore } from '../lib/strategyTrustScore'
import { computeSignalTrustScore, getSignalTrustGrade } from '../lib/signalTrustScore'
import {
  recommendStrategies,
  buildAIPortfolio,
  buildRecommendationReason,
} from '../lib/aiStrategyRecommender'
import {
  getEventImpactOnStrategy,
  getMarketEventInsight,
} from '../lib/marketEventEngine'
import { pickHighlightMarketEvent, MANUAL_MARKET_EVENTS, formatMarketEventKst } from '../data/marketEvents'

const HERO_ASSETS = ['BTC', 'ETH', 'SOL']
const RECOMMENDED_LIMIT = 3
const LS_ONBOARDING_DONE = 'onboarding_done'
const LS_ONBOARDING_DONE_LEGACY = 'bb_onboarding_done_v1'
function fmtLiveTime(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return ''
  try {
    return new Date(n).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function formatSignedPct1(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

/** 홈 전략 카드 — 7일·누적 수익률 + 한 줄 통계 */
function HomeStrategyReturnBlock({ recent7d, ret, winRate, mdd, trades }) {
  const mddAbs = mdd != null && Number.isFinite(Number(mdd)) ? Math.abs(Number(mdd)) : null
  const tc = Number(trades)
  const retTone = Number.isFinite(ret) && ret < 0
    ? 'text-red-500 dark:text-red-400'
    : 'text-emerald-600 dark:text-emerald-400'
  const d7Tone = Number.isFinite(recent7d) && recent7d < 0
    ? 'text-red-500 dark:text-red-400'
    : 'text-emerald-600 dark:text-emerald-400'
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">7일 수익률</p>
          <p className={cn('mt-0.5 text-2xl font-bold tabular-nums tracking-tight leading-none', d7Tone)}>
            {formatSignedPct1(recent7d)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">누적 수익률</p>
          <p className={cn('mt-0.5 text-2xl font-bold tabular-nums tracking-tight leading-none', retTone)}>
            {formatSignedPct1(ret)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
        승률
        {' '}
        {Number.isFinite(Number(winRate)) ? `${Number(winRate).toFixed(1)}%` : '—'}
        {' · '}
        MDD
        {' '}
        {mddAbs != null ? `-${mddAbs.toFixed(1)}%` : '—'}
        {' · '}
        {Number.isFinite(tc) ? `${Math.round(tc)}회` : '—'}
      </p>
    </>
  )
}

/** 클릭 가능한 전략 카드 공통 hover */
const HOME_STRAT_BTN_HOVER =
  'transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-600/70'

function fmtMinutesAgo(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n)) return ''
  const m = Math.max(0, Math.floor((Date.now() - n) / 60000))
  if (m <= 0) return '방금'
  if (m < 60) return `${m}분 전`
  return '방금'
}

function fmtViewedAt(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Date(n).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

/* ── 서브 컴포넌트 ────────────────────────── */

const HeroAssetCell = memo(function HeroAssetCell({ sym, q, isFavorite, onToggleFavorite }) {
  const ch = q?.changePercent
  const pos = ch == null ? true : ch >= 0
  const showPriceSkeleton = !q?.usdPrice
  return (
    <div
      className="rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3.5 shadow-none"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">{sym}/USDT</p>
        <div className="flex items-center gap-1">
        <span className={cn(
          'inline-flex items-center gap-0.5 text-[12px] font-mono font-bold tabular-nums',
          ch == null ? 'text-slate-400' : deltaTextClass(ch),
        )}>
          {ch != null && <span className="select-none" aria-hidden>{deltaArrow(ch)}</span>}
          {ch != null ? `${Number(ch) >= 0 ? '+' : ''}${Number(ch).toFixed(2)}%` : '—'}
        </span>
        {typeof onToggleFavorite === 'function' && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onToggleFavorite(sym) }}
            className="p-0.5 rounded-md text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <Star
              size={15}
              strokeWidth={2}
              className={cn(isFavorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300 dark:text-slate-600')}
            />
          </button>
        )}
        </div>
      </div>
      {showPriceSkeleton ? (
        <Skeleton className="h-8 w-36" />
      ) : (
        <>
          <span className="text-[26px] font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums leading-none">
            {formatUsd(q?.usdPrice)}
          </span>
          <p className="mt-1.5 text-[12px] font-mono text-slate-400 tabular-nums">
            {q?.krwPrice != null ? formatKrw(q.krwPrice) : '—'}
          </p>
        </>
      )}
    </div>
  )
}, (a, b) => a.sym === b.sym && a.isFavorite === b.isFavorite
  && a.q?.usdPrice === b.q?.usdPrice && a.q?.krwPrice === b.q?.krwPrice && a.q?.changePercent === b.q?.changePercent)

function HeroAssetStrip({ quotes, favoriteSet, onToggleFavorite }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {HERO_ASSETS.map((sym) => {
        const q = quotes.find((x) => x.symbol === sym)
        return (
          <HeroAssetCell
            key={sym}
            sym={sym}
            q={q}
            isFavorite={favoriteSet?.has?.(sym)}
            onToggleFavorite={onToggleFavorite}
          />
        )
      })}
    </div>
  )
}

function HeroFavoriteStrip({ quotes, favorites, favoriteSet, onToggleFavorite, showSkeleton }) {
  const list = Array.isArray(favorites) ? favorites : []
  if (showSkeleton && list.length === 0) return null
  if (!list.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/30 px-4 py-3">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center flex-wrap gap-1">
          즐겨찾기가 없습니다. 아래 시세 표에서
          <Star size={12} className="text-amber-500 shrink-0" strokeWidth={2} />
          를 눌러 추가할 수 있어요.
        </p>
      </div>
    )
  }
  const gridClass = list.length >= 4
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-2'
  return (
    <div className="mt-4">
      <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
        <Star size={14} className="text-amber-500 fill-amber-400/90" strokeWidth={2} />
        즐겨찾기
      </p>
      <div className={gridClass}>
        {list.map((sym) => {
          const q = (Array.isArray(quotes) ? quotes : []).find((x) => x.symbol === sym) ?? { symbol: sym }
          return (
            <HeroAssetCell
              key={sym}
              sym={sym}
              q={q}
              isFavorite={favoriteSet?.has?.(sym)}
              onToggleFavorite={onToggleFavorite}
            />
          )
        })}
      </div>
    </div>
  )
}

const WatchListItem = memo(function WatchListItem({ q, isFavorite, onToggleFavorite }) {
  const pos = q.changePercent == null ? true : q.changePercent >= 0
  return (
    <tr className="border-b border-slate-100/80 dark:border-gray-800/60 hover:bg-slate-50/60 dark:hover:bg-gray-800/30 transition-colors">
      <td className="py-2.5 pl-3 pr-1 w-10 align-middle">
        <button
          type="button"
          onClick={() => onToggleFavorite?.(q.symbol)}
          className="p-0.5 rounded text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/25"
          aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
        >
          <Star size={14} className={cn(isFavorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300 dark:text-slate-600')} strokeWidth={2} />
        </button>
      </td>
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
}, (prev, next) => prev.q.symbol === next.q.symbol && prev.isFavorite === next.isFavorite
  && prev.q.usdPrice === next.q.usdPrice
  && prev.q.krwPrice === next.q.krwPrice
  && prev.q.changePercent === next.q.changePercent)

const PRICE_TABS = [
  { id: 'fav', label: '즐겨찾기' },
  { id: 'vol', label: '거래량' },
  { id: 'vola', label: '변동성' },
  { id: 'price', label: '가격' },
]

function CoinPriceTable({
  quotes,
  showSkeleton,
  tab,
  onTabChange,
  favoriteSet,
  onToggleFavorite,
}) {
  return (
    <Card>
      <Card.Header>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Card.Title className="text-[17px]">시세</Card.Title>
          <span className="text-[12px] text-slate-500">Binance USDT 기준 · 표시 KRW는 참고</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PRICE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                'h-8 px-3 rounded-lg text-[12px] font-semibold border transition-colors',
                tab === t.id
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-gray-700 dark:text-slate-400',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card.Header>
      <Card.Content className="p-0">
        <p className="px-4 py-2 text-[10px] text-slate-500 border-b border-slate-100 dark:border-gray-800">
          기본 약 10행 분량이 보이며, 카드 안에서 스크롤해 더 볼 수 있습니다. 행 키는 심볼 고정입니다.
        </p>
        <div className="max-h-[min(380px,50vh)] overflow-y-auto overflow-x-auto overscroll-contain">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead className="sticky top-0 z-[1] bg-white dark:bg-gray-900 border-b border-slate-200/70 dark:border-gray-800">
              <tr>
                <th className="text-center font-semibold text-slate-500 py-2.5 px-1 text-[11px] w-10" aria-label="즐겨찾기">
                  <Star size={12} className="inline text-slate-400 mx-auto" strokeWidth={2} />
                </th>
                <th className="text-left font-semibold text-slate-500 py-2.5 px-4 text-[11px] uppercase tracking-wide">심볼</th>
                <th className="text-right font-semibold text-slate-500 py-2.5 px-4 text-[11px] uppercase tracking-wide">USD</th>
                <th className="text-right font-semibold text-slate-500 py-2.5 px-4 text-[11px] uppercase tracking-wide">변동</th>
                <th className="text-right font-semibold text-slate-500 py-2.5 px-4 text-[11px] uppercase tracking-wide">KRW</th>
              </tr>
            </thead>
            <tbody>
              {showSkeleton && quotes.length === 0
                ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-gray-800/60">
                    <td colSpan={5} className="py-2.5 px-4"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
                : !showSkeleton && tab === 'fav' && quotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 px-4 text-center text-[12px] text-slate-500 dark:text-slate-400">
                      즐겨찾기에 추가된 코인이 없습니다. 별 버튼을 눌러 보세요.
                    </td>
                  </tr>
                )
                : (Array.isArray(quotes) ? quotes : []).map((q) => (
                  <WatchListItem
                    key={q.symbol}
                    q={q}
                    isFavorite={favoriteSet?.has?.(q.symbol)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
            </tbody>
          </table>
        </div>
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
  const canNavigate = typeof onNavigate === 'function'
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      const done = localStorage.getItem(LS_ONBOARDING_DONE) === 'true'
      const legacyDone = localStorage.getItem(LS_ONBOARDING_DONE_LEGACY) === 'true'
      return !(done || legacyDone)
    } catch {
      return true
    }
  })
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: [] }
  const [watchQuotes, setWatchQuotes] = useState([])
  const [watchLoading, setWatchLoading] = useState(true)
  const [watchError, setWatchError] = useState('')
  const [liveQuotes, setLiveQuotes] = useState([])
  const [lastFastUpdateAt, setLastFastUpdateAt] = useState(0)
  const [lastMidUpdateAt, setLastMidUpdateAt] = useState(0)
  const [lastSlowUpdateAt, setLastSlowUpdateAt] = useState(0)
  const watchFirstFetchRef = useRef(true)
  const [strategies, setStrategies] = useState([])
  const [strategiesLoading, setStrategiesLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [strategyRetryNonce, setStrategyRetryNonce] = useState(0)
  const [watchRetryNonce, setWatchRetryNonce] = useState(0)
  const [signalTimeline, setSignalTimeline] = useState([])
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [symbolQuery, setSymbolQuery] = useState('')
  const [priceTickerTab, setPriceTickerTab] = useState('vol')
  const { favorites, favoriteSet, toggleFavorite } = useFavoriteSymbols()
  const { favorites: favoriteStrategiesList } = useFavoriteStrategies()
  const { recentViewed } = useRecentViewedStrategies()
  const { viewedSignals, recordViewedSignal } = useViewedSignals()

  const heroQuotes = useMemo(() => {
    const src = liveQuotes.length > 0 ? liveQuotes : watchQuotes
    return HERO_ASSETS.map((s) => src.find((q) => q.symbol === s) ?? { symbol: s })
  }, [liveQuotes, watchQuotes])

  const btcQuote = useMemo(() => heroQuotes.find((q) => q.symbol === 'BTC') ?? {}, [heroQuotes])
  const ethQuote = useMemo(() => heroQuotes.find((q) => q.symbol === 'ETH') ?? {}, [heroQuotes])

  const filteredQuotes = useMemo(() => {
    const q = String(symbolQuery ?? '').trim().toUpperCase()
    if (!q) return watchQuotes
    return (watchQuotes ?? []).filter((x) => String(x.symbol ?? '').toUpperCase().includes(q))
  }, [watchQuotes, symbolQuery])

  const tableQuotes = useMemo(() => {
    let q = [...(filteredQuotes ?? [])]
    const vol = (x) => Number(x.quoteVolume) || 0
    const chg = (x) => Math.abs(Number(x.changePercent) || 0)
    const usd = (x) => Number(x.usdPrice) || 0
    switch (priceTickerTab) {
      case 'fav': {
        q = q.filter((x) => favoriteSet.has(x.symbol))
        break
      }
      case 'vol':
        q.sort((a, b) => vol(b) - vol(a))
        break
      case 'vola':
        q.sort((a, b) => chg(b) - chg(a))
        break
      case 'price':
        q.sort((a, b) => usd(b) - usd(a))
        break
      default:
        break
    }
    return q.slice(0, 10)
  }, [filteredQuotes, priceTickerTab, favoriteSet])

  useEffect(() => {
    let cancelled = false
    const POLL_MS = 5000

    async function loadWatch() {
      const isFirst = watchFirstFetchRef.current
      if (isFirst) {
        setWatchLoading(true)
        setWatchError('')
      }
      try {
        const bulk = await fetchBinanceUsdt24hrWatchRows()
        if (!Array.isArray(bulk) || bulk.length === 0) {
          throw new Error('시세 목록을 불러오지 못했습니다.')
        }
        const rowMap = new Map(bulk.map((r) => [r.symbol, { ...r }]))
        const needKrw = [...new Set([...HERO_ASSETS, ...favorites])]
        await Promise.all(
          needKrw.map(async (sym) => {
            const r = rowMap.get(sym)
            if (!r) return
            try {
              const d = await getCachedPrice(sym)
              if (Number.isFinite(d.usdPrice)) r.usdPrice = d.usdPrice
              if (Number.isFinite(d.changePercent)) r.changePercent = d.changePercent
              if (Number.isFinite(d.quoteVolume)) r.quoteVolume = d.quoteVolume
              r.krwPrice = d.krwPrice
              r.krwSource = d.krwSource
              r.error = null
            } catch {
              /* Bulk 값 유지 */
            }
          }),
        )
        const rows = Array.from(rowMap.values())
        if (!cancelled) {
          setWatchError('')
          setWatchQuotes((prev) => {
            if (!Array.isArray(prev) || !prev.length) return rows
            return rows.map((row) => {
              const old = prev.find((p) => p.symbol === row.symbol)
              return old ? { ...old, ...row } : row
            })
          })
          setLastSlowUpdateAt(Date.now())
          if (watchFirstFetchRef.current) setLastMidUpdateAt(Date.now())
        }
      } catch (e) {
        if (!cancelled) {
          setWatchError(typeof e?.message === 'string' ? e.message : '시세 조회 실패')
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
  }, [favorites, watchRetryNonce])

  useEffect(() => {
    let cancelled = false
    const FAST_MS = 1000
    async function loadFast() {
      try {
        const rows = await Promise.all(
          HERO_ASSETS.map(async (sym) => {
            const d = await getCachedPrice(sym)
            return {
              symbol: sym,
              usdPrice: d.usdPrice ?? null,
              krwPrice: d.krwPrice ?? null,
              changePercent: Number.isFinite(d.changePercent) ? d.changePercent : 0,
              quoteVolume: Number.isFinite(d.quoteVolume) ? d.quoteVolume : 0,
            }
          }),
        )
        if (cancelled) return
        setLiveQuotes((prev) => rows.map((r) => {
          const old = prev.find((x) => x.symbol === r.symbol) || watchQuotes.find((x) => x.symbol === r.symbol)
          return old ? { ...old, ...r } : r
        }))
        setLastFastUpdateAt(Date.now())
      } catch {
        // keep previous numbers
      }
    }
    loadFast()
    const id = setInterval(loadFast, FAST_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [watchQuotes])

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
  }, [dataVersion, strategyRetryNonce])

  const withBadges = useMemo(
    () => assignMarketBadges(strategies.map((s) => normalizeMarketStrategy(s))),
    [strategies],
  )

  const resolveStrategyById = useCallback(
    (id) => withBadges.find((s) => String(s.id) === String(id)) ?? null,
    [withBadges],
  )

  const recommendedTop = useMemo(() => {
    return [...withBadges]
      .sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0))
      .slice(0, RECOMMENDED_LIMIT)
  }, [withBadges])

  const marketRec = useMemo(
    () => pickMarketBasedRecommendations(withBadges, {
      changePercent: btcQuote?.changePercent,
      avgRangePct: null,
    }, { limit: 3 }),
    [withBadges, btcQuote?.changePercent],
  )

  const topStrategy = useMemo(() => {
    return pickTopStrategy(withBadges)
  }, [withBadges])
  const heroStrategy = useMemo(
    () => marketRec.strategies[0] ?? topStrategy ?? recommendedTop?.[0] ?? null,
    [marketRec.strategies, topStrategy, recommendedTop],
  )

  const heroVerificationHint = useMemo(() => {
    if (!heroStrategy) return null
    const simId = resolveSimIdForUnlock(heroStrategy) || 'btc-trend'
    const view = buildRealTradeVerificationView(simId)
    return formatVerificationHomeHint(view)
  }, [heroStrategy])
  const recommendedCards = useMemo(() => {
    const primary = marketRec.strategies ?? []
    if (primary.length >= 3) return primary.slice(0, 3)
    const pool = [...withBadges].sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0))
    const seen = new Set(primary.map((s) => String(s.id)))
    const padded = [...primary]
    for (const s of pool) {
      if (padded.length >= 3) break
      const id = String(s.id)
      if (seen.has(id)) continue
      seen.add(id)
      padded.push(s)
    }
    return padded.slice(0, 3)
  }, [marketRec.strategies, withBadges])

  const marketSummary = useMemo(() => ({
    btcChange24h: btcQuote?.changePercent,
    ethChange24h: ethQuote?.changePercent,
    avgRangePct: (() => {
      const b = Math.abs(Number(btcQuote?.changePercent) || 0)
      const e = Math.abs(Number(ethQuote?.changePercent) || 0)
      return (b + e) / 2
    })(),
    dominanceTrend: '',
    volumeTrend: '',
  }), [btcQuote?.changePercent, ethQuote?.changePercent])

  const marketState = useMemo(
    () => classifyMarketState(marketSummary),
    [marketSummary],
  )

  const marketInsight = useMemo(
    () => getMarketInsight(marketState),
    [marketState],
  )

  const homeMarketEventHighlight = useMemo(
    () => pickHighlightMarketEvent(MANUAL_MARKET_EVENTS),
    [],
  )

  const homeRecommendedTypeAsLabel = useMemo(() => {
    const rt = marketInsight.recommendedType
    if (rt === '단타형') return '단타형'
    if (rt === '역추세형') return '역추세형'
    if (rt === '추세형') return '추세형'
    return '추세형'
  }, [marketInsight.recommendedType])

  const homeEventInsight = useMemo(
    () => getMarketEventInsight(homeMarketEventHighlight ?? {}, marketState),
    [homeMarketEventHighlight, marketState],
  )

  const homeEventStrategyImpact = useMemo(() => {
    if (!homeMarketEventHighlight) return null
    return getEventImpactOnStrategy(
      homeMarketEventHighlight,
      { typeLabel: homeRecommendedTypeAsLabel },
      marketState,
    )
  }, [homeMarketEventHighlight, homeRecommendedTypeAsLabel, marketState])

  const homeEventKstWhen = useMemo(
    () => formatMarketEventKst(homeMarketEventHighlight?.scheduledAtUtc),
    [homeMarketEventHighlight],
  )

  const recommendedByMarket = useMemo(
    () => recommendStrategiesByMarket(withBadges, marketState),
    [withBadges, marketState],
  )

  const marketStrategies = useMemo(
    () => withBadges.filter((s) => String(s.type ?? 'signal') !== 'method'),
    [withBadges],
  )

  const userProfileForAi = useMemo(
    () => ({
      preference: u?.preference ?? u?.strategyPreference ?? null,
    }),
    [u],
  )

  const aiRanked = useMemo(
    () => recommendStrategies({
      strategies: marketStrategies,
      market: marketState,
      userProfile: userProfileForAi,
    }),
    [marketStrategies, marketState, userProfileForAi],
  )

  const aiPortfolio = useMemo(() => buildAIPortfolio(aiRanked), [aiRanked])

  const homeMiniSignalTrustLine = useCallback((row) => {
    const strat = row?.strategyId ? resolveStrategyById(row.strategyId) : heroStrategy
    if (!strat) return '신뢰도 · —'
    const ts = computeTrustScore({
      matchRate: Number(strat.matchRate ?? strat.match_rate ?? 0),
      verifiedReturn: Number(strat.verifiedReturn ?? strat.verified_return_pct ?? 0),
      liveReturn30d: Number(strat.recentRoi30d ?? strat.roi30d ?? 0),
      maxDrawdown: Math.abs(Number(strat.maxDrawdown ?? strat.mdd ?? 0)),
      tradeCount: Number(strat.tradeCount ?? strat.trades ?? 0),
      hasRealVerification: !!strat.hasRealVerification,
    })
    const mf = recommendStrategiesByMarket([strat], marketState)[0]?.marketFitScore ?? 50
    const rowTs = Number(row.ts)
    const signalAgeMinutes =
      Number.isFinite(rowTs) && rowTs > 0
        ? Math.max(0, (Date.now() - rowTs) / 60000)
        : 0
    const sc = computeSignalTrustScore({
      strategyTrustScore: ts,
      matchRate: Number(strat.matchRate ?? strat.match_rate ?? 0),
      recentWinRate: Number(strat.winRate ?? 0),
      marketFitScore: mf,
      reasonCount: 0,
      volatilityLabel: marketState.volatilityLabel,
      signalAgeMinutes,
      hasRealVerification: !!strat.hasRealVerification,
    })
    const g = getSignalTrustGrade(sc)
    return `신뢰도 ${sc}점 · ${g.label}`
  }, [resolveStrategyById, heroStrategy, marketState])
  const liveSignalRows = useMemo(() => {
    const fromTop = safeArray(heroStrategy?.recentSignals).slice(0, 3).map((s, idx) => ({
      id: `top-${idx}`,
      strategyId: s?.strategyId ?? s?.strategy_id ?? heroStrategy?.id ?? null,
      strategyName: s?.strategyName ?? s?.strategy_name ?? heroStrategy?.name ?? null,
      type: String(s?.dir ?? s?.type ?? 'WAIT').toUpperCase(),
      symbol: String(s?.symbol ?? heroStrategy?.asset ?? 'BTCUSDT'),
      ts: Number(s?.time ?? s?.ts ?? Date.now() - idx * 420000),
      time: fmtLiveTime(s?.time ?? s?.ts ?? Date.now() - idx * 420000) || '방금',
      value: Number.isFinite(Number(s?.price)) ? formatUsd(Number(s.price)) : '—',
      result: Number.isFinite(Number(s?.pnlPct)) ? `${Number(s.pnlPct) >= 0 ? '+' : ''}${Number(s.pnlPct).toFixed(1)}%` : null,
    }))
    if (fromTop.length) return fromTop
    return [
      { id: 'fallback-1', strategyId: null, strategyName: 'BTC Trend', type: 'LONG', symbol: 'BTCUSDT', ts: Date.now(), time: '방금', value: formatUsd(btcQuote?.usdPrice), result: null },
      { id: 'fallback-2', strategyId: null, strategyName: 'ETH Reversal', type: 'SHORT', symbol: 'ETHUSDT', ts: Date.now() - 120000, time: '2분 전', value: formatUsd(ethQuote?.usdPrice), result: null },
      { id: 'fallback-3', strategyId: null, strategyName: 'SOL Scalper', type: 'EXIT', symbol: 'SOLUSDT', ts: Date.now() - 360000, time: '6분 전', value: '정리 완료', result: '+2.1%' },
    ]
  }, [heroStrategy?.recentSignals, heroStrategy?.asset, btcQuote?.usdPrice, ethQuote?.usdPrice])
  const handleOpenStrategy = useCallback((strategy) => {
    if (!strategy || strategy.id == null) return
    setSelectedStrategy(strategy)
  }, [])
  const handleOpenSignal = useCallback((signal) => {
    if (!signal) return
    recordViewedSignal({
      strategyId: signal.strategyId ?? signal.strategy_id ?? null,
      strategyName: signal.strategyName ?? '',
      symbol: signal.symbol ?? '',
      type: signal.type,
      signalTs: signal.ts,
      signalKey: signal.id != null ? String(signal.id) : undefined,
    })
    const strategyId = signal.strategyId ?? signal.strategy_id ?? null
    if (strategyId) {
      onGoSimulation?.(strategyId)
      return
    }
    onNavigate?.('signal')
  }, [onGoSimulation, onNavigate, recordViewedSignal])

  useEffect(() => {
    let cancelled = false
    const pushTimeline = () => {
      if (cancelled) return
      const now = Date.now()
      const seed = liveSignalRows[Math.floor(Math.random() * liveSignalRows.length)] ?? null
      const randomType = ['LONG', 'SHORT', 'EXIT'][Math.floor(Math.random() * 3)]
      const synthetic = seed
        ? {
            ...seed,
            id: `${seed.id}-${now}`,
            type: seed.type || randomType,
            ts: now,
            time: fmtLiveTime(now),
          }
        : null
      setSignalTimeline((prev) => {
        const merged = synthetic ? [synthetic, ...prev] : [...prev]
        return merged
          .sort((a, b) => Number(b?.ts ?? 0) - Number(a?.ts ?? 0))
          .slice(0, 10)
      })
    }
    pushTimeline()
    const timer = setInterval(pushTimeline, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [liveSignalRows])

  function handleSimulateFromModal() {
    if (selectedStrategy) onGoSimulation?.(selectedStrategy.id)
    setSelectedStrategy(null)
  }

  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false)
    try {
      localStorage.setItem(LS_ONBOARDING_DONE, 'true')
      localStorage.setItem(LS_ONBOARDING_DONE_LEGACY, 'true')
    } catch {}
  }, [])

  /** 최근 시그널 방향이 LONG/SHORT인 전략 = 진행 중으로 표시 */
  const inProgressStrategies = useMemo(() => {
    const valid = (withBadges ?? []).filter((s) => String(s.type ?? 'signal') !== 'method')
    return valid
      .map((strategy) => {
        const ls = getStrategyLiveState(strategy)
        if (ls.kind !== 'long_open' && ls.kind !== 'short_open') return null
        const dir = ls.kind === 'long_open' ? 'LONG' : 'SHORT'
        return { strategy, dir }
      })
      .filter(Boolean)
      .slice(0, 4)
  }, [withBadges])

  return (
    <PageShell className="page-shell">
      {loadErr && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/25 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">전략 데이터를 불러오지 못했습니다</p>
            <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/85">
              {loadErr} 다시 시도하거나 문의해주세요.
            </p>
          </div>
          <Button variant="secondary" size="sm" type="button" className="shrink-0" onClick={() => setStrategyRetryNonce((n) => n + 1)}>
            다시 시도
          </Button>
        </div>
      )}

      {watchError && !watchLoading && watchQuotes.length === 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/25 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">시세를 불러오지 못했습니다</p>
            <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/85">
              {watchError} 다시 시도하거나 문의해주세요.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="shrink-0"
            onClick={() => {
              watchFirstFetchRef.current = true
              setWatchRetryNonce((n) => n + 1)
            }}
          >
            시세 다시 불러오기
          </Button>
        </div>
      )}

      <div className="mb-10 grid gap-4 lg:grid-cols-2 lg:items-start">
        <section id="home-market-summary" className="min-w-0" aria-label="시장 요약">
          <div className={cn(panelBase, 'p-4')}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Market Summary
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
              {marketInsight.summary}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {marketInsight.action}
            </p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums leading-relaxed">
              <span className="font-medium text-slate-700 dark:text-slate-200">BTC</span>
              {' '}
              {Number.isFinite(Number(btcQuote?.usdPrice)) ? formatUsd(btcQuote.usdPrice) : '—'}
              {' '}
              <span
                className={cn(
                  Number.isFinite(Number(btcQuote?.changePercent)) && Number(btcQuote.changePercent) < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                (
                {Number.isFinite(Number(btcQuote?.changePercent))
                  ? `${Number(btcQuote.changePercent) >= 0 ? '+' : ''}${Number(btcQuote.changePercent).toFixed(1)}%`
                  : '—'}
                )
              </span>
              <span className="text-slate-300 dark:text-slate-600 mx-1.5">·</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">ETH</span>
              {' '}
              {Number.isFinite(Number(ethQuote?.usdPrice)) ? formatUsd(ethQuote.usdPrice) : '—'}
              {' '}
              <span
                className={cn(
                  Number.isFinite(Number(ethQuote?.changePercent)) && Number(ethQuote.changePercent) < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                (
                {Number.isFinite(Number(ethQuote?.changePercent))
                  ? `${Number(ethQuote.changePercent) >= 0 ? '+' : ''}${Number(ethQuote.changePercent).toFixed(1)}%`
                  : '—'}
                )
              </span>
            </p>
            <p className="mt-2 text-[11px] font-semibold text-blue-800 dark:text-blue-200">
              추천: {marketInsight.recommendedType}
            </p>
          </div>
        </section>

        <section id="home-market-events" className="min-w-0" aria-label="시장 이벤트">
          {homeMarketEventHighlight && homeEventStrategyImpact ? (
            <div className={cn(panelWarning, 'p-4')}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                시장 이벤트
              </p>
              <p className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                {homeMarketEventHighlight.title}
              </p>
              <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
                {homeEventKstWhen ? `${homeEventKstWhen} (KST)` : homeMarketEventHighlight.window ? `참고 · ${homeMarketEventHighlight.window}` : '일정 참고'}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                {homeEventInsight.summary}
              </p>
            </div>
          ) : (
            <div className={cn(panelBase, 'p-4')}>
              <p className="text-xs text-slate-500 dark:text-slate-400">등록된 주요 이벤트가 없습니다.</p>
            </div>
          )}
        </section>
      </div>

      <section id="home-ai-recommendation" className="mb-10 scroll-mt-8" aria-label="AI 전략 추천">
        <div className={cn(panelEmphasis, 'p-4')}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            AI Recommendation
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            지금 가장 적합한 전략
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            현재 시장 기준 자동 추천
          </p>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
            {marketInsight.summary}
          </p>
        </div>
        {strategiesLoading ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((k) => <StrategyCardSkeleton key={`ai-${k}`} />)}
          </div>
        ) : aiPortfolio.length === 0 ? (
          <div className="mt-5 py-10 text-center">
            <p className="text-slate-500 dark:text-slate-400">데이터가 없습니다</p>
            {canNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="mt-3 inline-flex px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 dark:border-gray-600 dark:bg-gray-900 dark:text-slate-100 transition duration-200 hover:scale-[1.02] hover:shadow-lg"
              >
                인기 전략 보러가기
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {aiPortfolio.map((strategy) => {
              const reasons = buildRecommendationReason(strategy, marketState)
              const reasonText = reasons.length ? reasons.join(' · ') : '데이터 기반 추천'
              return (
                <button
                  key={`ai-${strategy.id}`}
                  type="button"
                  onClick={() => handleOpenStrategy(strategy)}
                  className={cn(
                    'group w-full cursor-pointer p-4 text-left',
                    panelBase,
                    HOME_STRAT_BTN_HOVER,
                  )}
                >
                  <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 truncate">
                    {strategy.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {reasonText}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                    AI 점수 {Math.round(Number(strategy.aiScore) || 0)}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors duration-200 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200">
                    클릭해서 상세 보기
                    <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section id="home-market-matched-strategies" className="mb-10 mt-10 scroll-mt-8" aria-label="현재 시장에 맞는 전략">
        <div className={cn(panelEmphasis, 'p-4')}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            Market fit
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            현재 시장에 맞는 전략
          </h2>
          <p className="mt-2 text-sm text-slate-800 dark:text-slate-100 leading-snug">
            {marketInsight.summary}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {marketInsight.action}
          </p>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">추천 유형</span>
            {' '}
            {marketInsight.recommendedType}
            {' · '}
            {marketState.marketTrend}
            {' · '}
            변동성
            {' '}
            {marketState.volatilityLabel}
          </p>
        </div>
        {strategiesLoading ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((k) => <StrategyCardSkeleton key={`mkt-${k}`} />)}
          </div>
        ) : recommendedByMarket.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
            표시할 전략이 없습니다. 마켓에서 더 살펴보세요.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {recommendedByMarket.map((strategy) => {
              const ret = Number(strategy.totalReturnPct ?? strategy.roi)
              const winRate = Number(strategy.winRate)
              const mddRaw = Number(strategy.maxDrawdown ?? strategy.mdd)
              const mdd = Number.isFinite(mddRaw) ? Math.abs(mddRaw) : null
              const trades = Number(strategy.tradeCount ?? strategy.trades)
              const recent7d = Number(strategy.recentRoi7d ?? strategy.roi7d)
              const currentStateText = getStrategyLiveStateLine(strategy)
              const recCfg = RECOMMEND_CONFIG[strategy.recommendBadge]
              const fitScore = Number(strategy.marketFitScore ?? 0)
              return (
                <button
                  key={`mkt-${strategy.id}`}
                  type="button"
                  onClick={() => handleOpenStrategy(strategy)}
                  className={cn(
                    'group w-full cursor-pointer p-4 text-left flex flex-col gap-3',
                    panelBase,
                    HOME_STRAT_BTN_HOVER,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {strategy.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-gray-800 dark:text-slate-300">
                          {strategy.typeLabel ?? '추세형'}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                          {strategy.profileLabel ?? '안정형'}
                        </span>
                        {Number.isFinite(fitScore) ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
                            시장 적합 {fitScore}점
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <VerificationBadge
                        level={strategy.verified_badge_level ?? 'backtest_only'}
                        size="xs"
                      />
                      {recCfg ? <Badge variant={recCfg.variant}>{recCfg.label}</Badge> : null}
                    </div>
                  </div>
                  <HomeStrategyReturnBlock recent7d={recent7d} ret={ret} winRate={winRate} mdd={mdd} trades={trades} />
                  <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-slate-200">
                    <span className="shrink-0 text-slate-400">현재 상태</span>
                    <span className="min-w-0 font-medium truncate">{currentStateText}</span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-snug text-slate-600 dark:text-slate-400">
                    {String(strategy.summary ?? strategy.fitSummary ?? '전략 성격 요약이 준비 중입니다.')}
                  </p>
                  <p className="text-xs leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
                    {evaluateStrategy(strategy).verdict}
                  </p>
                  <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors duration-200 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200">
                    클릭해서 상세 보기
                    <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>


      <section id="home-recommended-strategies" className="home-top-strategies mb-10" aria-label="지금 주목할 전략">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">지금 주목할 전략</h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 line-clamp-2">
              {marketRec.headline}
            </p>
          </div>
          {canNavigate && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-900 dark:text-slate-200 dark:hover:bg-gray-800"
              >
                전략 비교하기
                <span aria-hidden>↗</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                더 많은 전략 보기
                <span>→</span>
              </button>
            </div>
          )}
        </div>
        {strategiesLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" aria-hidden />
              추천 전략을 불러오는 중…
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {[1, 2, 3].map((k) => <StrategyCardSkeleton key={k} />)}
            </div>
          </div>
        ) : recommendedCards.length === 0 ? (
          <div>
            {loadErr ? (
              <EmptyState
                title="추천 전략을 표시할 수 없습니다"
                description={`${loadErr} 다시 시도하거나 문의해주세요.`}
                action={(
                  <Button variant="primary" size="sm" type="button" onClick={() => setStrategyRetryNonce((n) => n + 1)}>
                    다시 시도
                  </Button>
                )}
              />
            ) : (
              <EmptyState title="아직 추천할 전략이 없습니다" description="승인·게시된 전략이 없거나 DB 연결을 확인해 주세요." />
            )}
            {canNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                전략 마켓 보기 <span className="transition-transform duration-200 hover:translate-x-1">→</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {recommendedCards.slice(0, 3).map((strategy) => {
              const ret = Number(strategy.totalReturnPct ?? strategy.roi)
              const winRate = Number(strategy.winRate)
              const mddRaw = Number(strategy.maxDrawdown ?? strategy.mdd)
              const mdd = Number.isFinite(mddRaw) ? Math.abs(mddRaw) : null
              const trades = Number(strategy.tradeCount ?? strategy.trades)
              const recent7d = Number(strategy.recentRoi7d ?? strategy.roi7d)
              const currentStateText = getStrategyLiveStateLine(strategy)
              const recCfg = RECOMMEND_CONFIG[strategy.recommendBadge]
              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => handleOpenStrategy(strategy)}
                  className={cn(
                    'group w-full cursor-pointer p-4 text-left flex flex-col gap-3',
                    panelBase,
                    HOME_STRAT_BTN_HOVER,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {strategy.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-gray-800 dark:text-slate-300">
                          {strategy.typeLabel ?? '추세형'}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                          {strategy.profileLabel ?? '안정형'}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <VerificationBadge
                        level={strategy.verified_badge_level ?? 'backtest_only'}
                        size="xs"
                      />
                      {recCfg ? <Badge variant={recCfg.variant}>{recCfg.label}</Badge> : null}
                    </div>
                  </div>

                  <HomeStrategyReturnBlock recent7d={recent7d} ret={ret} winRate={winRate} mdd={mdd} trades={trades} />

                  <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-slate-200">
                    <span className="shrink-0 text-slate-400">현재 상태</span>
                    <span className="min-w-0 font-medium truncate">{currentStateText}</span>
                  </div>

                  <p className="line-clamp-2 text-sm leading-snug text-slate-600 dark:text-slate-400">
                    {String(strategy.summary ?? strategy.fitSummary ?? '전략 성격 요약이 준비 중입니다.')}
                  </p>

                  <p className="text-xs leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
                    {evaluateStrategy(strategy).verdict}
                  </p>

                  <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors duration-200 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200">
                    클릭해서 상세 보기
                    <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section id="home-signal-brief" className="mb-10" aria-label="요약형 실시간 신호">
        <div className={cn(panelBase, 'p-4')}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">요약형 실시간 신호</h2>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            상세는 시그널 페이지에서 확인하세요.
          </p>
          {(() => {
            const recent = (Array.isArray(signalTimeline) && signalTimeline[0])
              || (Array.isArray(liveSignalRows) && liveSignalRows[0])
              || null
            const ts = Number(recent?.ts ?? recent?.time ?? 0)
            const type = String(recent?.type ?? '').toUpperCase()
            const sym = String(recent?.symbol ?? '—')
            const trust = recent ? homeMiniSignalTrustLine(recent) : '—'
            const statusLine = heroStrategy
              ? getStrategyLiveStateLine(heroStrategy)
              : (inProgressStrategies[0]
                ? `${inProgressStrategies[0].strategy?.name ?? ''} · ${inProgressStrategies[0].dir} 진입 중`
                : '관찰 중인 전략 없음')
            return (
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  <span className="text-slate-500 dark:text-slate-400">최근 시그널:</span>
                  {' '}
                  {recent ? (
                    <>
                      <button
                        type="button"
                        className="font-semibold text-sky-700 hover:underline dark:text-sky-300"
                        onClick={() => handleOpenSignal(recent)}
                      >
                        {sym}
                      </button>
                      {' '}
                      <span
                        className={cn(
                          'font-semibold',
                          type === 'LONG' && 'text-emerald-600 dark:text-emerald-400',
                          type === 'SHORT' && 'text-red-500 dark:text-red-400',
                        )}
                      >
                        {type}
                      </span>
                      {' · '}
                      <span className="tabular-nums text-slate-600 dark:text-slate-300">
                        {Number.isFinite(ts) && ts > 0 ? fmtMinutesAgo(ts) : '—'}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">아직 표시할 신호가 없습니다</span>
                  )}
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">신뢰도:</span>
                  {' '}
                  {trust}
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">현재 상태:</span>
                  {' '}
                  {statusLine}
                </p>
              </div>
            )
          })()}
          <button
            type="button"
            onClick={() => onNavigate?.('signal')}
            className="group mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            시그널 페이지로 이동
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>
        </div>
      </section>

      <section id="home-my-area" className="mb-7" aria-label="마이 영역">
        <div className="mb-3">
          <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            마이 영역
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            관심·최근 확인·시그널 기록을 한곳에 모았습니다. 다시 들어올 때 이어서 보세요.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={cn(panelBase, 'p-4')}>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
                <Bookmark className="text-amber-600 dark:text-amber-400" size={16} aria-hidden />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">관심 전략</p>
            </div>
            {!favoriteStrategiesList?.length ? (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                마켓에서 별(관심)을 누르면 여기에 쌓입니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {favoriteStrategiesList.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const full = resolveStrategyById(item.id)
                        if (full) handleOpenStrategy(full)
                        else onNavigate?.('market')
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
                    >
                      <span className="text-[13px] font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-sky-600 dark:text-sky-400 shrink-0">열기</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn(panelBase, 'p-4')}>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30">
                <History className="text-sky-600 dark:text-sky-400" size={16} aria-hidden />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">최근 본 전략</p>
            </div>
            {!recentViewed?.length ? (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                전략 상세를 열면 자동으로 기록됩니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentViewed.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const full = resolveStrategyById(item.id)
                        if (full) handleOpenStrategy(full)
                        else onNavigate?.('market')
                      }}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-slate-100 px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
                    >
                      <span className="text-[13px] font-medium text-slate-800 dark:text-slate-200 truncate w-full">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {fmtViewedAt(item.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn(panelBase, 'p-4')}>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200/80 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30">
                <RadioReceiver className="text-violet-600 dark:text-violet-400" size={16} aria-hidden />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">내가 본 시그널</p>
            </div>
            {!viewedSignals?.length ? (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                홈·시그널에서 시그널을 눌러 확인하면 여기에 남습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {viewedSignals.slice(0, 6).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (row.strategyId) onGoSimulation?.(row.strategyId)
                        else onNavigate?.('signal')
                      }}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-slate-100 px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-[12px] font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {row.symbol}
                        </span>
                        <span
                          className={cn(
                            'text-[11px] font-bold shrink-0',
                            row.type === 'LONG'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : row.type === 'SHORT'
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-slate-500 dark:text-slate-400',
                          )}
                        >
                          {row.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate w-full">
                        {row.strategyName}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        확인 {fmtViewedAt(row.viewedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>


      <StrategyDetailModal
        strategy={selectedStrategy}
        strategyPool={withBadges}
        onOpenRelatedStrategy={(s) => {
          if (s && s.id != null) setSelectedStrategy(s)
        }}
        marketEvaluationContext={{
          btcChangePercent: btcQuote?.changePercent,
          ethChange24h: ethQuote?.changePercent,
          avgRangePct: marketSummary.avgRangePct,
          dominanceTrend: '',
          volumeTrend: '',
        }}
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

      {showOnboarding && (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Quick Start
            </p>
            <h3 className="mt-1 text-[18px] font-bold text-slate-900 dark:text-slate-100">
              5초 요약 가이드
            </h3>
            <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">
              아래 3단계만 보면 바로 시작할 수 있습니다.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
              <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <li><span className="font-semibold">1.</span> 전략 선택</li>
                <li><span className="font-semibold">2.</span> 검증 확인</li>
                <li><span className="font-semibold">3.</span> 시그널 실행</li>
              </ol>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" variant="primary" size="sm" onClick={closeOnboarding}>
                시작하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

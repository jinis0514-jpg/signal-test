import { useState, useMemo, useEffect, useRef } from 'react'
import { LayoutGrid, List, Package, Trophy, Percent, Shield } from 'lucide-react'
import { cn } from '../lib/cn'
import PageHeader            from '../components/ui/PageHeader'
import Button                from '../components/ui/Button'
import EmptyState            from '../components/ui/EmptyState'
import { StrategyCardSkeleton } from '../components/ui/Skeleton'
import MarketFilters         from '../components/market/MarketFilters'
import MarketSortBar         from '../components/market/MarketSortBar'
import MarketStrategyCard    from '../components/market/MarketStrategyCard'
import StrategyTable         from '../components/market/StrategyTable'
import StrategyDetailModal   from '../components/market/StrategyDetailModal'
import {
  DEFAULT_FILTERS,
  applyMarketFilters,
} from '../data/marketMockData'
import { normalizeMarketStrategy, assignMarketBadges } from '../lib/marketStrategy'
import { getApprovedStrategies } from '../lib/strategyService'
import { mergeApprovedAndOperator } from '../lib/mergeMarketStrategies'
import { getCachedPrice } from '../lib/priceCache'
import { isMarketLocked } from '../lib/userPlan'
import { formatUsd, formatKrw } from '../lib/priceFormat'
function fmtPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function metric(strategy) {
  const ret = Number(strategy?.totalReturnPct ?? strategy?.roi ?? 0)
  const mdd = Number(strategy?.maxDrawdown ?? Math.abs(strategy?.mdd ?? 0))
  const win = Number(strategy?.winRate ?? 0)
  const trades = Number(strategy?.tradeCount ?? strategy?.trades ?? 0)
  const r7 = Number(strategy?.recentRoi7d ?? strategy?.roi7d ?? 0)
  const r30 = Number(strategy?.recentRoi30d ?? strategy?.roi30d ?? 0)
  const dir = strategy?.recentSignals?.[0]?.dir ?? strategy?.currentDir
  const pos = (() => {
    if (!dir) return '대기'
    const s = String(dir).toUpperCase()
    if (s === 'LONG' || s === 'BUY') return 'LONG'
    if (s === 'SHORT' || s === 'SELL') return 'SHORT'
    return '대기'
  })()
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
  const [filters,          setFilters]          = useState(DEFAULT_FILTERS)
  const [viewMode,         setViewMode]         = useState('card')
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [strategies,       setStrategies]       = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [btcDisplay,       setBtcDisplay]       = useState(null)
  const [btcPriceError,    setBtcPriceError]    = useState('')
  const btcPriceFirstFetchRef = useRef(true)

  function handleSimulate(strategy) {
    const isMethod = String(strategy?.type ?? 'signal') === 'method'
    const targetId = isMethod ? strategy?.linked_signal_strategy_id : strategy?.id
    if (!targetId) return
    onGoSimulation?.(targetId)
  }

  function toggleCompare(strategy) {
    const id = strategy?.id
    if (!id) return
    setCompareIds((prev) => {
      const has = prev.includes(id)
      if (has) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id] // 최대 2개 비교
      return [...prev, id]
    })
  }

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS)
  }

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
  }, [dataVersion])

  useEffect(() => {
    let cancelled = false
    const POLL_MS = 1500

    ;(async () => {
      try {
        if (btcPriceFirstFetchRef.current) setBtcPriceError('')
        const t = await getCachedPrice('BTC')
        if (!cancelled) {
          setBtcDisplay((prev) => t ?? prev)
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
        const t = await getCachedPrice('BTC')
        if (!cancelled) setBtcDisplay((prev) => t ?? prev)
      } catch {
        /* 실시간 보조 정보 — 이전 값 유지 */
      }
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const filtered = useMemo(
    () => assignMarketBadges(applyMarketFilters(strategies, filters)),
    [strategies, filters],
  )

  const compareList = useMemo(() => {
    if (compareIds.length === 0) return []
    const byId = new Map(filtered.map((s) => [s.id, s]))
    return compareIds.map((id) => byId.get(id)).filter(Boolean)
  }, [compareIds, filtered])

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

    const picked = []
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      if (picked.length === 0) { picked.push(s); continue }
      if (picked.length === 1 && s.id !== picked[0].id) { picked.push(s); break }
    }

    return picked.slice(0, 2)
  }, [filtered, u])

  /* TOP 3 랭킹 — 전체 목록 기준 (필터 무관) */
  const top3Rankings = useMemo(() => {
    const valid = strategies.filter((s) => String(s.type ?? 'signal') !== 'method')
    const top3By = (key, dir = 'desc') => {
      const arr = [...valid].filter((s) => Number.isFinite(Number(s[key])))
      arr.sort((a, b) => dir === 'desc' ? Number(b[key]) - Number(a[key]) : Number(a[key]) - Number(b[key]))
      return arr.slice(0, 3)
    }
    return {
      recent:  top3By('recentRoi7d', 'desc'),
      stable:  top3By('maxDrawdown', 'asc'),
      winRate: top3By('winRate', 'desc'),
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
            </div>
          }
        />

        {compareList.length > 0 && (
          <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                선택 전략 비교 (최대 2개)
              </p>
              <Button variant="ghost" size="sm" type="button" onClick={() => setCompareIds([])}>
                비교 해제
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {compareList.map((s) => {
                const m = metric(s)
                const price = s.monthlyPriceKrw ?? s.monthly_price
                return (
                  <div key={s.id} className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100 truncate">{s.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.author}</p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                        {price != null && Number(price) > 0 ? `₩${Number(price).toLocaleString()}/월` : '—'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1.5 text-[10px] tabular-nums">
                      <div>
                        <span className="text-slate-400">누적 수익</span>
                        <div className={cn(
                          'font-semibold',
                          Number.isFinite(m.ret) && m.ret >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600',
                        )}
                        >
                          {fmtPct(m.ret)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">MDD</span>
                        <div className="font-semibold text-red-600">−{Number.isFinite(m.mdd) ? m.mdd.toFixed(1) : '—'}%</div>
                      </div>
                      <div>
                        <span className="text-slate-400">승률</span>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{Number.isFinite(m.win) ? `${m.win.toFixed(1)}%` : '—'}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">거래</span>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{Number.isFinite(m.trades) ? m.trades : '—'}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">최근 7일</span>
                        <div className={cn(
                          'font-semibold',
                          Number.isFinite(m.r7) && m.r7 >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600',
                        )}
                        >
                          {fmtPct(m.r7)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">최근 30일</span>
                        <div className={cn(
                          'font-semibold',
                          Number.isFinite(m.r30) && m.r30 >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600',
                        )}
                        >
                          {fmtPct(m.r30)}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400">현재 상태</span>
                        <div
                          className={cn(
                            'font-semibold',
                            m.pos === 'LONG' && 'text-blue-600 dark:text-blue-400',
                            m.pos === 'SHORT' && 'text-red-600 dark:text-red-400',
                            (m.pos === '대기' || m.pos === '—') && 'text-slate-500 dark:text-slate-400',
                          )}
                        >
                          {m.pos}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[9px] text-slate-500 leading-relaxed">
              동일 엔진 백테스트·최근 구간 성과 기준입니다. 실전 결과를 보장하지 않습니다.
            </p>
          </div>
        )}

        {/* ── 랭킹 (탐색) TOP 3 ── */}
        {!loading && strategies.length > 0 && (
          <div className="market-top-ranking">
            <div className="mb-2">
              <h2 className="product-section-h text-[15px]">랭킹으로 빠르게 찾기</h2>
              <p className="product-section-sub text-[12px]">최근 성과·안정성·승률 중에서 관심 있는 축부터 짧은 리스트로 좁혀 보세요.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

              {/* 최근 성과 TOP 3 */}
              <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-gray-800 bg-emerald-50/90 dark:bg-emerald-950/20">
                  <Trophy size={11} strokeWidth={1.8} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">최근 성과 TOP</span>
                </div>
                {top3Rankings.recent.length === 0 ? (
                  <p className="px-3 py-3 text-[10px] text-slate-400">데이터 없음</p>
                ) : (
                  top3Rankings.recent.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStrategy(s)}
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

              {/* 안정성 TOP 3 (MDD 낮은 순) */}
              <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/40">
                  <Shield size={11} strokeWidth={1.8} className="text-slate-600 dark:text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">안정성 TOP · MDD 낮음</span>
                </div>
                {top3Rankings.stable.length === 0 ? (
                  <p className="px-3 py-3 text-[10px] text-slate-400">데이터 없음</p>
                ) : (
                  top3Rankings.stable.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStrategy(s)}
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
                      <span className="text-[11px] font-bold tabular-nums text-red-600 dark:text-red-400 shrink-0">
                        MDD −{Number(s.maxDrawdown ?? 0).toFixed(1)}%
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* 승률 TOP 3 */}
              <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-gray-800 bg-blue-50/80 dark:bg-blue-950/25">
                  <Percent size={11} strokeWidth={1.8} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-[9px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest">승률 TOP</span>
                </div>
                {top3Rankings.winRate.length === 0 ? (
                  <p className="px-3 py-3 text-[10px] text-slate-400">데이터 없음</p>
                ) : (
                  top3Rankings.winRate.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStrategy(s)}
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

            </div>
          </div>
        )}

        {/* 2) 오늘 살펴볼 만한 후보 (잠금 없는 전략 우선) */}
        {featured.length > 0 && (
          <div className="mb-4">
            <div className="flex items-end justify-between gap-2 mb-2 flex-wrap">
              <div>
                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  오늘 살펴볼 만한 후보
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  바로 열람·비교 가능한 전략부터 골랐습니다. 아래 목록에서 전부 비교할 수 있습니다.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewMode('card')}>
                카드로 보기
              </Button>
            </div>
            <div className={cn(
              'grid grid-cols-1 gap-3',
              featured.length === 2 && 'lg:grid-cols-2',
            )}>
              {featured.map((s) => (
                <MarketStrategyCard
                  key={`featured-${s.id}`}
                  strategy={s}
                  user={u}
                  isLocked={isMarketLocked(s.id, u)}
                  isUserStrategy={false}
                  onDetail={() => setSelectedStrategy(s)}
                  onSimulate={() => handleSimulate(s)}
                  onStartTrial={onStartTrial}
                  onGoSubscription={onGoSubscription}
                  onSubscribe={onSubscribe}
                  onToggleCompare={toggleCompare}
                  compared={compareIds.includes(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 3) 전체 목록 — 정렬 / 보기 */}
        <div className="mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">전체 전략 · 비교</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            필터와 정렬로 후보를 줄인 뒤, 카드의「비교」로 최대 2개를 고르세요.
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

        {!loading && error && (
          <div className="mb-2">
            <p className="text-[10px] text-amber-500">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="market-card-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <StrategyCardSkeleton key={i} />
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <EmptyState
            icon={<Package size={28} strokeWidth={1.2} />}
            title="아직 마켓에 노출할 전략이 없습니다"
            description={
              '플랫폼 운영 전략은 순차 공개 예정입니다. 커뮤니티 전략은 에디터 제출 → 검수 승인 후 표시됩니다. ' +
              '지금은 제출된 전략이 없거나 DB 연결을 확인할 수 없습니다.'
            }
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
            title="조건에 맞는 전략이 없습니다"
            description="필터를 조정하거나 검색어를 변경해보세요."
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
                onDetail={() => setSelectedStrategy(s)}
                onSimulate={() => handleSimulate(s)}
                onStartTrial={onStartTrial}
                onGoSubscription={onGoSubscription}
                onSubscribe={onSubscribe}
                onToggleCompare={toggleCompare}
                compared={compareIds.includes(s.id)}
              />
            ))}
          </div>
        ) : (
          <StrategyTable
            strategies={filtered}
            user={u}
            onDetail={(s) => setSelectedStrategy(s)}
            onSimulate={handleSimulate}
            onStartTrial={onStartTrial}
            onGoSubscription={onGoSubscription}
            onSubscribe={onSubscribe}
          />
        )}
      </div>

      <StrategyDetailModal
        strategy={selectedStrategy}
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
      />
    </div>
  )
}

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
import { copy as assetUniverseCopy } from '../lib/assetValidationUniverse'
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
  const [comparedIds, setComparedIds] = useState([])
  const [strategies,       setStrategies]       = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [btcDisplay,       setBtcDisplay]       = useState(null)
  const [btcPriceError,    setBtcPriceError]    = useState('')
  const [lastSlowUpdateAt, setLastSlowUpdateAt] = useState(0)
  const btcPriceFirstFetchRef = useRef(true)

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
    const POLL_MS = 5000

    ;(async () => {
      try {
        if (btcPriceFirstFetchRef.current) setBtcPriceError('')
        const t = await getCachedPrice('BTC')
        if (!cancelled) {
          setBtcDisplay((prev) => t ?? prev)
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
        const t = await getCachedPrice('BTC')
        if (!cancelled) {
          setBtcDisplay((prev) => t ?? prev)
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

  const filtered = useMemo(
    () => assignMarketBadges(applyMarketFilters(strategies, filters)),
    [strategies, filters],
  )

  const comparedStrategies = useMemo(() => {
    return filtered.filter((s) => comparedIds.includes(s.id))
  }, [filtered, comparedIds])

  const bestComparedStrategy = useMemo(() => {
    if (!comparedStrategies.length) return null
    const sorted = [...comparedStrategies].sort((a, b) => {
      const aScore = Number(a.trustScore ?? 0) + Number(a.totalReturnPct ?? a.roi ?? 0) * 0.3
      const bScore = Number(b.trustScore ?? 0) + Number(b.totalReturnPct ?? b.roi ?? 0) * 0.3
      return bScore - aScore
    })
    return sorted[0]
  }, [comparedStrategies])

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

        {comparedStrategies.length > 0 && (
          <>
            <div className="sticky top-0 z-20 mb-4 rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 dark:border-gray-700 dark:bg-gray-900/95">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    전략 비교 {comparedStrategies.length}/3
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    수익률, MDD, 승률, 신뢰도를 한눈에 비교하세요
                  </p>
                </div>
                <div className="flex items-center gap-2">
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

            <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900/60">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-slate-500">항목</th>
                    {comparedStrategies.map((s) => (
                      <th key={s.id} className="px-4 py-3 text-left text-slate-900 dark:text-slate-100">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-slate-500">신뢰도</td>
                    {comparedStrategies.map((s) => (
                      <td key={s.id} className="px-4 py-3 font-semibold">
                        {s.trustScore ?? '-'}점
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-slate-500">수익률</td>
                    {comparedStrategies.map((s) => (
                      <td key={s.id} className="px-4 py-3 font-semibold">
                        {Number.isFinite(Number(s.totalReturnPct ?? s.roi))
                          ? `${Number(s.totalReturnPct ?? s.roi) >= 0 ? '+' : ''}${Number(s.totalReturnPct ?? s.roi).toFixed(1)}%`
                          : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-slate-500">MDD</td>
                    {comparedStrategies.map((s) => (
                      <td key={s.id} className="px-4 py-3">
                        {Number.isFinite(Number(s.maxDrawdown ?? s.mdd))
                          ? `-${Math.abs(Number(s.maxDrawdown ?? s.mdd)).toFixed(1)}%`
                          : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-slate-500">승률</td>
                    {comparedStrategies.map((s) => (
                      <td key={s.id} className="px-4 py-3">
                        {Number.isFinite(Number(s.winRate)) ? `${Number(s.winRate).toFixed(1)}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-slate-500">거래 수</td>
                    {comparedStrategies.map((s) => (
                      <td key={s.id} className="px-4 py-3">
                        {Number.isFinite(Number(s.tradeCount ?? s.trades)) ? Number(s.tradeCount ?? s.trades).toLocaleString() : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-slate-500">최근 30일</td>
                    {comparedStrategies.map((s) => (
                      <td key={s.id} className="px-4 py-3">
                        {Number.isFinite(Number(s.recentRoi30d ?? s.roi30d))
                          ? `${Number(s.recentRoi30d ?? s.roi30d) >= 0 ? '+' : ''}${Number(s.recentRoi30d ?? s.roi30d).toFixed(1)}%`
                          : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-500">현재 상태</td>
                    {comparedStrategies.map((s) => (
                      <td key={s.id} className="px-4 py-3">
                        {s.recentSignals?.[0]?.dir ?? s.currentDir ?? '대기'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {bestComparedStrategy && (
              <div className="mt-3 mb-5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  비교 기준상 가장 유리한 전략: {bestComparedStrategy.name}
                </p>
                <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  신뢰도와 최근 성과를 함께 기준으로 계산했습니다.
                </p>
              </div>
            )}
          </>
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
                    onToggleCompare={handleToggleCompare}
                    compared={comparedIds.includes(s.id)}
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    유형: {s.typeLabel ?? '추세형'} · 최대 손실 -{Number(s.maxDrawdown ?? s.mdd ?? 0).toFixed(1)}% · {Number(s.maxDrawdown ?? s.mdd ?? 0) >= 15 ? '변동성 있음' : '변동성 낮음'}
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

        {error && (
          <div className="mb-2">
            <p className="text-[10px] text-amber-500">{error}</p>
          </div>
        )}

        {loading && strategies.length === 0 ? (
          <div className="market-card-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <StrategyCardSkeleton key={i} />
            ))}
          </div>
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
                onDetail={() => handleOpenDetail(s)}
                onSimulate={() => handleSimulate(s)}
                onStartTrial={onStartTrial}
                onGoSubscription={onGoSubscription}
                onSubscribe={onSubscribe}
                onToggleCompare={handleToggleCompare}
                compared={comparedIds.includes(s.id)}
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

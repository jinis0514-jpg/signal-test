import { useState, useMemo, useEffect } from 'react'
import { LayoutGrid, List, Package } from 'lucide-react'
import { cn } from '../lib/cn'
import PageHeader            from '../components/ui/PageHeader'
import Button                from '../components/ui/Button'
import EmptyState            from '../components/ui/EmptyState'
import MarketFilters         from '../components/market/MarketFilters'
import StrategyCard          from '../components/market/StrategyCard'
import StrategyTable         from '../components/market/StrategyTable'
import StrategyDetailModal   from '../components/market/StrategyDetailModal'
import {
  DEFAULT_FILTERS,
  applyMarketFilters,
} from '../data/marketMockData'
import { getApprovedStrategies } from '../lib/strategyService'
import { getDisplayPrice } from '../lib/displayPriceService'

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
    <div className="flex border border-slate-200 dark:border-gray-700 rounded-[2px] overflow-hidden">
      {btn('card',  LayoutGrid, '카드 보기')}
      {btn('table', List,       '표 보기'  )}
    </div>
  )
}

/* ── MarketPage ──────────────────────────── */

export default function MarketPage({ onGoSimulation, onStartTrial, dataVersion = 0 }) {
  const [filters,          setFilters]          = useState(DEFAULT_FILTERS)
  const [viewMode,         setViewMode]         = useState('card')
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [strategies,       setStrategies]       = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [btcDisplay,       setBtcDisplay]       = useState(null)
  const [btcPriceError,    setBtcPriceError]    = useState('')

  function handleSimulate(strategy) {
    onGoSimulation?.(strategy.id)
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
        const mapped = (data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          author: 'DB',
          asset: s.asset,
          assetType: String(s.asset ?? '').toLowerCase(),
          timeframe: s.timeframe ?? '',
          typeLabel: 'DB 전략',
          status: s.status ?? 'approved',
          isDbStrategy: true,
          type: s.strategy_type ?? 'trend',
          /* UI 기본값 */
          roi: 0,
          winRate: 0,
          mdd: 0,
          trades: 0,
          roi7d: null,
          fitSummary: '승인된 사용자 전략',
          recommendBadge: null,
          ctaStatus: 'not_started',
          createdAt: s.created_at ? Date.parse(s.created_at) : Date.now(),
          updatedAt: s.updated_at ? Date.parse(s.updated_at) : Date.now(),
        }))
        if (!cancelled) setStrategies(mapped)
      } catch (e) {
        if (!cancelled) { setStrategies([]); setError(e?.message ?? 'DB 전략 조회 실패') }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [dataVersion])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setBtcPriceError('')
        const t = await getDisplayPrice('BTC')
        if (!cancelled) setBtcDisplay(t)
      } catch (e) {
        if (!cancelled) {
          setBtcDisplay(null)
          setBtcPriceError(e?.message ?? 'BTC 가격 조회 실패')
        }
      }
    })()

    const timer = setInterval(async () => {
      try {
        const t = await getDisplayPrice('BTC')
        if (!cancelled) setBtcDisplay(t)
      } catch {
        // 실시간 보조 정보이므로 주기 실패는 조용히 무시
      }
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const filtered = useMemo(
    () => applyMarketFilters(strategies, filters),
    [strategies, filters],
  )

  return (
    <div className="flex min-h-full">

      {/* ── 좌측 필터 패널 ────────────────────── */}
      <aside
        className="
          w-[224px] flex-shrink-0
          sticky top-0 h-[calc(100vh-44px)]
          overflow-y-auto
          border-r border-slate-100 dark:border-gray-800
          bg-white dark:bg-gray-900
        "
      >
        <MarketFilters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
        />
      </aside>

      {/* ── 메인 콘텐츠 ───────────────────────── */}
      <div className="flex-1 min-w-0 p-4">

        <PageHeader
          title="전략마켓"
          description="현재 시장 상태에 적합한 전략을 탐색하고 비교하세요."
          action={
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 tabular-nums">
                BTC{' '}
                {btcDisplay?.usdPrice != null
                  ? (
                    <>
                      ${btcDisplay.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      {btcDisplay.krwPrice != null && (
                        <span className="text-slate-400">
                          {' '}· ₩{btcDisplay.krwPrice.toLocaleString('ko-KR')}
                        </span>
                      )}
                    </>
                  )
                  : (btcPriceError ? 'N/A' : '...')}
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {filtered.length}개 전략
              </span>
              <ViewToggle view={viewMode} onChange={setViewMode} />
            </div>
          }
        />

        {loading && (
          <div className="mb-2">
            <p className="text-[10px] text-slate-400">DB 전략 로딩 중...</p>
          </div>
        )}
        {!loading && error && (
          <div className="mb-2">
            <p className="text-[10px] text-amber-500">{error}</p>
          </div>
        )}

        {filtered.length === 0 ? (
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
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                isLocked={false}
                isUserStrategy={false}
                onDetail={() => setSelectedStrategy(s)}
                onSimulate={() => handleSimulate(s)}
                onStartTrial={onStartTrial}
              />
            ))}
          </div>
        ) : (
          <StrategyTable
            strategies={filtered}
            onDetail={(s) => setSelectedStrategy(s)}
          />
        )}
      </div>

      {/* 상세 모달 */}
      {selectedStrategy && (
        <StrategyDetailModal
          strategy={selectedStrategy}
          onClose={() => setSelectedStrategy(null)}
          onSimulate={
            () => handleSimulate(selectedStrategy)
          }
        />
      )}
    </div>
  )
}

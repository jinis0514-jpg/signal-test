import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import {
  Activity, ArrowRight,
  Sparkles, Radio, FolderKanban, Globe, Zap, Star,
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
import { fetchBinanceUsdt24hrWatchRows } from '../lib/binanceUsdUniverse'
import { useFavoriteSymbols } from '../hooks/useFavoriteSymbols'
import { isMarketLocked } from '../lib/userPlan'
import { estimateStrategyDailyRoiPct } from '../lib/strategyDailyRoi'
import { formatUsd, formatKrw } from '../lib/priceFormat'
import { STRATEGIES } from '../data/simulationMockData'
import { buildMarketBrief } from '../lib/marketBrief'
import { deltaTextClass, deltaArrow } from '../lib/deltaDisplay'
import LiveTickerStrip from '../components/live/LiveTickerStrip'
import { pickTopStrategy } from '../lib/strategyRecommendation'

const HERO_ASSETS = ['BTC', 'ETH', 'SOL']
const RECOMMENDED_LIMIT = 3
const LS_ONBOARDING_DONE = 'bb_onboarding_done_v1'
const ONBOARDING_STEPS = [
  {
    id: 'market',
    title: '전략은 이렇게 고르세요',
    desc: '수익률만 보지 말고 MDD(손실), 승률, 신뢰도를 같이 보세요.',
  },
  {
    id: 'detail',
    title: '상세에서 먼저 볼 것',
    desc: '상단 4가지 지표와 “검증 요약”만 보면 빠르게 판단할 수 있습니다.',
  },
  {
    id: 'signal',
    title: '지금 들어가도 되는 타이밍인가?',
    desc: '진입 근거, 현재 포지션, 익절/손절 거리 순서로 확인하세요.',
  },
  {
    id: 'validation',
    title: '이 전략 믿어도 될까?',
    desc: '백테스트, 라이브 성과, 실거래 인증은 반드시 따로 보세요.',
  },
]

function fmtLiveTime(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return ''
  try {
    return new Date(n).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

/* ── 시장 상태 판단 유틸 ──────────────────── */
function classifyTrend(pct) {
  if (pct > 2) return { label: '강한 상승', color: 'blue', icon: 'up' }
  if (pct > 0.3) return { label: '완만 상승', color: 'blue', icon: 'up' }
  if (pct < -2) return { label: '강한 하락', color: 'red', icon: 'down' }
  if (pct < -0.3) return { label: '완만 하락', color: 'red', icon: 'down' }
  return { label: '횡보', color: 'slate', icon: 'flat' }
}

function classifyVolatility(change24hPct, avgRangePct) {
  const c = Math.abs(Number(change24hPct ?? 0))
  const r = Math.abs(Number(avgRangePct ?? 0))
  if (c >= 3.5 || r >= 2.2) return { label: '높음', color: 'red' }
  if (c >= 1.5 || r >= 1.0) return { label: '보통', color: 'amber' }
  return { label: '낮음', color: 'slate' }
}

function computeAvgRangePct(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return 0
  let sum = 0
  let count = 0
  const start = Math.max(0, candles.length - 24)
  for (let i = start; i < candles.length; i += 1) {
    const c = candles[i]
    const close = Number(c?.close)
    const high = Number(c?.high)
    const low = Number(c?.low)
    if (!Number.isFinite(close) || close <= 0 || !Number.isFinite(high) || !Number.isFinite(low)) continue
    sum += ((high - low) / close) * 100
    count += 1
  }
  return count > 0 ? sum / count : 0
}

function formatSignedPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function buildMarketSummaryRows({ btcChange, ethChange, volatilityLabel }) {
  const btcMood = btcChange >= 2.5 ? '급등' : btcChange <= -2.5 ? '급락' : btcChange >= 0 ? '상승' : '하락'
  const ethMood = ethChange >= 1.8 ? '동반 상승' : ethChange <= -1.8 ? '동반 하락' : ethChange >= 0 ? '완만 상승' : '완만 하락'
  return [
    `BTC: ${formatSignedPct(btcChange)} ${btcMood}`,
    `ETH: ${formatSignedPct(ethChange)} ${ethMood}`,
    `변동성: ${volatilityLabel}`,
  ]
}

function buildActionInterpretation({ btcChange, ethChange, volatilityLabel }) {
  const c = Number(btcChange ?? 0)
  const e = Number(ethChange ?? 0)
  if (c >= 3.0 && volatilityLabel === '높음') {
    return 'BTC가 하루 기준 강하게 상승해 단기 추세 구간으로 볼 수 있습니다. 급등 이후 변동성이 커져 추격 진입보다 눌림 확인이 유리합니다.'
  }
  if (c <= -2.5 && volatilityLabel !== '낮음') {
    return '하락 압력이 강하고 캔들 변동폭도 커 손절 기준이 짧은 전략이 유리합니다.'
  }
  if (c > 0.8 && e > 0.5) {
    return '주요 코인이 함께 오르는 구간이라 시장 전반의 위험선호가 살아 있습니다.'
  }
  if (volatilityLabel === '높음') {
    return '방향성은 있으나 변동폭이 커 손절 기준이 짧은 전략이 더 유리합니다.'
  }
  return '방향성은 완만해 추격 매수보다 확인 후 진입이 유리한 구간입니다.'
}

function pickStrategyLinkText(changePct, volatilityLabel) {
  if (volatilityLabel === '높음' && Math.abs(Number(changePct)) >= 2) return '현재 추천: 짧은 손절 기반 단타 전략'
  if (Number(changePct) >= 1.2) return '현재 추천: 추세 추종형 전략'
  if (Number(changePct) <= -1.2) return '현재 추천: 역추세 반등 확인 전략'
  return '현재 추천: 박스권 대응형 전략'
}

const getRecommendationReason = (strategy) => {
  if (strategy.matchRate >= 80) return '실거래 일치도가 높습니다'
  if ((strategy.recentRoi7d ?? strategy.roi7d) > 5) return '최근 수익률이 상승 중입니다'
  if ((strategy.maxDrawdown ?? strategy.mdd) < 10) return '리스크가 낮은 전략입니다'
  return '균형 잡힌 성과를 보이는 전략입니다'
}

/* ── 글로벌 지표 시뮬레이션 (BTC 변동률만으로 결정론적 추정 — 렉·깜빡임 방지) ── */
function estimateGlobalIndices(btcChange) {
  const c = Number(btcChange) || 0
  const nasdaqChange = c * 0.675 + Math.sin(c * 0.07) * 0.12
  const sp500Change = nasdaqChange * 0.71
  const dowChange = sp500Change * 0.86
  const base = { nasdaq: 18234.2, sp500: 5742.8, dow: 42180.4 }

  const riskSentiment = c > 0 && nasdaqChange > 0 ? 'risk-on'
    : c < 0 && nasdaqChange < 0 ? 'risk-off' : '혼조'

  return {
    nasdaq: { change: nasdaqChange, value: base.nasdaq * (1 + nasdaqChange / 100), label: 'NASDAQ' },
    sp500: { change: sp500Change, value: base.sp500 * (1 + sp500Change / 100), label: 'S&P 500' },
    dow: { change: dowChange, value: base.dow * (1 + dowChange / 100), label: 'DOW JONES' },
    sentiment: riskSentiment,
  }
}

/* ── 서브 컴포넌트 ────────────────────────── */

const MarketPulse = memo(function MarketPulse({
  btcQuote,
  ethQuote,
  avgRangePct,
  showSkeleton,
  liveUpdatedAt,
}) {
  const changePct = Number(btcQuote?.changePercent ?? 0)
  const trend = classifyTrend(changePct)
  const ethChange = Number(ethQuote?.changePercent ?? 0)
  const volLabel = classifyVolatility(changePct, avgRangePct)
  const summaryRows = buildMarketSummaryRows({
    btcChange: changePct,
    ethChange,
    volatilityLabel: volLabel.label,
  })
  const interpretation = buildActionInterpretation({
    btcChange: changePct,
    ethChange,
    volatilityLabel: volLabel.label,
  })
  const strategyLinkText = pickStrategyLinkText(changePct, volLabel.label)

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
        <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200 tracking-tight">지금 시장</span>
        <span className="ml-auto text-[10px] text-slate-400">
          {fmtLiveTime(liveUpdatedAt) || brief?.updatedAt || ''}
        </span>
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
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-2">비트코인</p>
              <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[14px] font-bold', trendColors[trend.color])}>
                <span className="select-none" aria-hidden>{deltaArrow(changePct)}</span>
                {trend.label}
              </div>
              <p className="mt-2 text-[24px] font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatUsd(btcQuote?.usdPrice)}
              </p>
              <p className={cn(
                'mt-0.5 text-[14px] font-mono font-bold tabular-nums',
                deltaTextClass(changePct),
              )}>
                <span className="select-none mr-0.5" aria-hidden>{deltaArrow(changePct)}</span>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% <span className="text-slate-400 font-medium">(24h)</span>
              </p>
            </div>

            {/* 변동성 */}
            <div>
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-2">변동성</p>
              <p className={cn('text-[22px] font-bold', volColors[volLabel.color])}>
                {volLabel.label}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                24h 변동률 {formatSignedPct(changePct)} · 평균 캔들 변동폭 {avgRangePct.toFixed(2)}%
              </p>
            </div>

            {/* 시장 요약 + 해석 */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">시장 요약</p>
              <ul className="space-y-1 text-[12px] text-slate-700 dark:text-slate-300">
                {summaryRows.map((row) => (
                  <li key={row} className="leading-snug">{row}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">해석</p>
              <p className="mt-1 text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed">
                {interpretation}
              </p>
            </div>
          </div>
        )}
        {!showSkeleton && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-800">
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">{strategyLinkText}</p>
          </div>
        )}
      </div>
    </div>
  )
})

const GlobalIndicesBar = memo(function GlobalIndicesBar({ indices, showSkeleton }) {
  if (showSkeleton || !indices) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    )
  }

  const items = [indices.nasdaq, indices.sp500, indices.dow]

  return (
    <div className="rounded-[8px] border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-none">
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-[#2962ff]" />
          <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">해외 증시</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-slate-100 dark:divide-gray-800">
        {items.map((item) => {
          const pos = item.change >= 0
          return (
            <div key={item.label} className="px-4 py-3 text-center">
              <p className="text-[11px] font-semibold text-slate-400 tracking-[0.06em] uppercase mb-1">{item.label}</p>
              <p className="text-[18px] font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </p>
              <div className="flex items-center justify-center gap-0.5">
                <span className={cn(
                  'text-[16px] font-bold font-mono tabular-nums',
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
            ? '미국 증시 강세 → 위험자산 선호 확대 가능'
            : indices.sentiment === 'risk-off'
              ? '증시 약세 → 코인도 변동성 확대 주의'
              : '증시 혼조 → 코인 단기 변동성 확대 가능성 점검'}
        </p>
      </div>
    </div>
  )
})

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
      return localStorage.getItem(LS_ONBOARDING_DONE) !== 'true'
    } catch {
      return true
    }
  })
  const [stepIndex, setStepIndex] = useState(0)
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
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [symbolQuery, setSymbolQuery] = useState('')
  const [priceTickerTab, setPriceTickerTab] = useState('vol')
  const { favorites, favoriteSet, toggleFavorite } = useFavoriteSymbols()
  const {
    candles: btcCandles,
    loading: btcCandleLoading,
    error: btcCandleError,
    source: btcCandleSource,
  } = useMarketData('BTCUSDT', '1h', { limit: 48, pollMs: 1500 })

  const heroQuotes = useMemo(() => {
    const src = liveQuotes.length > 0 ? liveQuotes : watchQuotes
    return HERO_ASSETS.map((s) => src.find((q) => q.symbol === s) ?? { symbol: s })
  }, [liveQuotes, watchQuotes])

  const btcQuote = useMemo(() => heroQuotes.find((q) => q.symbol === 'BTC') ?? {}, [heroQuotes])
  const ethQuote = useMemo(() => heroQuotes.find((q) => q.symbol === 'ETH') ?? {}, [heroQuotes])
  const avgRangePct = useMemo(() => computeAvgRangePct(btcCandles), [btcCandles])
  const heroVolatility = useMemo(
    () => classifyVolatility(btcQuote?.changePercent, avgRangePct),
    [btcQuote?.changePercent, avgRangePct],
  )
  const strategyLinkText = useMemo(
    () => pickStrategyLinkText(btcQuote?.changePercent, heroVolatility.label),
    [btcQuote?.changePercent, heroVolatility.label],
  )
  const marketStateLabel = useMemo(() => {
    const c = Number(btcQuote?.changePercent ?? 0)
    if (c >= 1.5) return '상승 추세'
    if (c <= -1.5) return '하락 압력'
    return '방향 탐색'
  }, [btcQuote?.changePercent])
  const marketInterpretation = useMemo(() => {
    return buildActionInterpretation({
      btcChange: btcQuote?.changePercent,
      ethChange: ethQuote?.changePercent,
      volatilityLabel: heroVolatility.label,
    })
  }, [btcQuote?.changePercent, ethQuote?.changePercent, heroVolatility.label])

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
        if (!cancelled && watchFirstFetchRef.current) {
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
  }, [favorites])

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

  const topStrategy = useMemo(() => {
    return pickTopStrategy(withBadges)
  }, [withBadges])
  const heroStrategy = useMemo(() => topStrategy ?? recommendedTop?.[0] ?? null, [topStrategy, recommendedTop])
  const subStrategies = useMemo(() => (recommendedTop ?? []).slice(1, 3), [recommendedTop])
  const strategyReasonLine = useMemo(() => {
    if (marketStateLabel === '횡보') return '현재 횡보장 → 단타 전략 추천'
    if (marketStateLabel === '상승') return '현재 상승장 → 추세 추종 전략 추천'
    return '현재 하락장 → 방어형 전략 우선 추천'
  }, [marketStateLabel])

  const todaysStrategy = useMemo(() => {
    if (!withBadges.length) return null
    const start = new Date(new Date().getFullYear(), 0, 0)
    const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000)
    return withBadges[dayOfYear % withBadges.length]
  }, [withBadges])

  const todayDailyRoiPct = useMemo(
    () => (todaysStrategy ? estimateStrategyDailyRoiPct(todaysStrategy) : null),
    [todaysStrategy],
  )
  const signalContext = useMemo(() => {
    const id = signalStrategyId
    if (!id) return { title: '선택된 전략 없음', sub: '시그널에서 전략을 선택하세요.' }
    const us = userStrategies.find((s) => s.id === id)
    if (us) return { title: us.name, sub: '내 전략 · 시그널 연결됨' }
    const cat = STRATEGIES.find((s) => s.id === id)
    if (cat) return { title: cat.name, sub: '카탈로그 전략' }
    return { title: '커스텀 선택', sub: String(id).slice(0, 12) }
  }, [signalStrategyId, userStrategies])

  const signalDailyRoiPct = useMemo(() => {
    const id = signalStrategyId
    if (!id) return null
    const fromMarket = withBadges.find((s) => s.id === id)
    if (fromMarket) return estimateStrategyDailyRoiPct(fromMarket)
    const us = userStrategies.find((s) => s.id === id)
    if (us) return estimateStrategyDailyRoiPct(us)
    const cat = STRATEGIES.find((s) => s.id === id)
    if (cat) return estimateStrategyDailyRoiPct(cat)
    return estimateStrategyDailyRoiPct({ id })
  }, [signalStrategyId, withBadges, userStrategies])

  const myStrategyStatus = useMemo(() => {
    const rows = userStrategies ?? []
    if (rows.length === 0) return { empty: true, total: 0, draft: 0, pipeline: 0, approved: 0 }
    const n = (st) => rows.filter((r) => String(r.status ?? '') === st).length
    return { empty: false, total: rows.length, draft: n('draft'), pipeline: n('submitted') + n('under_review'), approved: n('approved') }
  }, [userStrategies])

  useEffect(() => {
    setLastMidUpdateAt(Date.now())
  }, [todaysStrategy?.id, todayDailyRoiPct, signalDailyRoiPct, myStrategyStatus.total, myStrategyStatus.pipeline, myStrategyStatus.approved])

  function handleSimulateFromModal() {
    if (selectedStrategy) onGoSimulation?.(selectedStrategy.id)
    setSelectedStrategy(null)
  }

  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false)
    try {
      localStorage.setItem(LS_ONBOARDING_DONE, 'true')
    } catch {}
  }, [])

  const goNextStep = useCallback(() => {
    setStepIndex((prev) => {
      if (prev >= ONBOARDING_STEPS.length - 1) {
        closeOnboarding()
        return prev
      }
      return prev + 1
    })
  }, [closeOnboarding])

  const skipOnboarding = useCallback(() => {
    closeOnboarding()
  }, [closeOnboarding])

  const currentStep = ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0]
  const isLastStep = stepIndex >= ONBOARDING_STEPS.length - 1

  return (
    <PageShell className="page-shell">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setStepIndex(0)
            setShowOnboarding(true)
          }}
          className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline-offset-2 hover:underline"
        >
          도움말 다시 보기
        </button>
      </div>

      {loadErr && (
        <p className="mb-4 text-[12px] text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2">
          {loadErr}
        </p>
      )}

      <section className="hero-market-summary" aria-label="시장 요약">
        <LiveTickerStrip
          items={[
            ...heroQuotes.map((q) => ({ label: q.symbol, value: formatUsd(q?.usdPrice), change: q?.changePercent })),
            ...(globalIndices ? [
              { label: 'NASDAQ', value: 'US', change: globalIndices.nasdaq.change },
              { label: 'S&P', value: 'US', change: globalIndices.sp500.change },
            ] : []),
          ]}
          lastUpdatedText={fmtLiveTime(lastFastUpdateAt)}
        />
        {btcCandleError && btcCandleSource === 'fallback' && (
          <p className="mb-3 text-[12px] text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-3 py-2">
            캔들 API 연결에 실패해 시장 요약은 제한적으로 표시됩니다.
          </p>
        )}
        <MarketPulse
          btcQuote={btcQuote}
          ethQuote={ethQuote}
          avgRangePct={avgRangePct}
          liveUpdatedAt={lastFastUpdateAt}
          showSkeleton={(watchLoading && watchQuotes.length === 0) || (btcCandleLoading && btcCandles.length === 0)}
        />
        <GlobalIndicesBar indices={globalIndices} showSkeleton={watchLoading && watchQuotes.length === 0} />
        <div className="mt-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
          <p className="text-[11px] text-slate-700 dark:text-slate-300">
            현재 시장 상태: <span className="font-semibold">{marketStateLabel}</span>
            {heroStrategy?.summary ? <> · 이 전략: <span className="font-semibold">{heroStrategy.summary}</span></> : null}
          </p>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
            {marketInterpretation}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            {strategyLinkText}
          </p>
        </div>
      </section>

      <div className="mb-7">
        <HeroAssetStrip quotes={heroQuotes} favoriteSet={favoriteSet} onToggleFavorite={toggleFavorite} />
        <HeroFavoriteStrip
          quotes={watchQuotes}
          favorites={favorites}
          favoriteSet={favoriteSet}
          onToggleFavorite={toggleFavorite}
          showSkeleton={watchLoading && watchQuotes.length === 0}
        />
      </div>

      {topStrategy && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">
            지금 가장 추천하는 전략
          </p>

          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {topStrategy.name}
          </p>

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {getRecommendationReason(topStrategy)}
          </p>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="font-semibold text-emerald-600">
              {topStrategy.totalReturnPct >= 0 ? '+' : ''}
              {Number(topStrategy.totalReturnPct).toFixed(1)}%
            </span>

            <span className="text-slate-500">
              MDD -{Math.abs(Number(topStrategy.maxDrawdown ?? topStrategy.mdd)).toFixed(1)}%
            </span>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
            지금 전략 써야 하는 이유: {strategyReasonLine}
          </p>
        </div>
      )}

      {/* 행동 루프: 오늘의 전략 · 시그널 · 내 전략 */}
      <section className="home-live-signals grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-amber-500" />
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">지금 가장 추천하는 전략</span>
            </div>
            {todaysStrategy ? (
              <>
                <p className="text-[16px] font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                  {todaysStrategy.name}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  유형: {todaysStrategy.typeLabel ?? '추세형'} · 처음이라면 이 전략부터 시작하세요
                </p>
                {todayDailyRoiPct != null && (
                  <p className="mt-2 text-[22px] font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    오늘 추정 {todayDailyRoiPct >= 0 ? '+' : ''}{todayDailyRoiPct.toFixed(1)}%
                  </p>
                )}
                <p className="mt-1 text-[12px] text-slate-500 line-clamp-2">
                  {todaysStrategy.fitSummary || '추천 후보'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  최대 손실 -{Number(todaysStrategy.maxDrawdown ?? todaysStrategy.mdd ?? 0).toFixed(1)}% · {Number(todaysStrategy.maxDrawdown ?? todaysStrategy.mdd ?? 0) >= 15 ? '변동성 있음' : '변동성 낮음'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedStrategy(todaysStrategy)}>상세</Button>
                  {canNavigate && (
                    <Button variant="ghost" size="sm" onClick={() => onNavigate('market')}>마켓</Button>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-1 space-y-2">
                <p className="text-[12px] text-slate-500 leading-snug">
                  아직 표시할 전략이 없습니다. 마켓에서 후보를 고르거나 잠시 후 다시 확인해 주세요.
                </p>
                {canNavigate && (
                  <Button variant="primary" size="sm" type="button" onClick={() => onNavigate('market')}>
                    전략 마켓 보기
                  </Button>
                )}
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
            <p className="text-[16px] font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
              {signalContext.title}
            </p>
            {signalDailyRoiPct != null && (
              <p className="mt-2 text-[22px] font-bold tabular-nums text-slate-900 dark:text-slate-50">
                오늘 추정 {signalDailyRoiPct >= 0 ? '+' : ''}{signalDailyRoiPct.toFixed(1)}%
              </p>
            )}
            <p className="mt-1 text-[12px] text-slate-500">{signalContext.sub}</p>
            <div className="mt-3">
              {canNavigate && (
                <Button variant="primary" size="sm" onClick={() => onNavigate('signal')}>
                  시그널 열기 <ArrowRight size={12} className="ml-1 opacity-80" />
                </Button>
              )}
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
                {canNavigate && (
                  <Button className="mt-3" variant="secondary" size="sm" onClick={() => onNavigate('editor')}>
                    전략 만들기
                  </Button>
                )}
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
                {canNavigate && (
                  <Button className="mt-3" variant="secondary" size="sm" onClick={() => onNavigate('mypage')}>내 페이지</Button>
                )}
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
            {canNavigate && (
              <div className="mt-4 flex items-center gap-2">
                <Button variant="primary" size="md" onClick={() => onNavigate('market')}>
                  전략 마켓 <ArrowRight size={13} className="ml-1.5 opacity-80" />
                </Button>
                <Button variant="secondary" size="md" onClick={() => onNavigate('signal')}>
                  <Activity size={13} className="mr-1.5 opacity-80" /> 시그널
                </Button>
              </div>
            )}
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
            {canNavigate && (
              <div className="mt-4">
                <Button variant="primary" size="md" onClick={() => onNavigate('editor')}>
                  에디터 열기 <ArrowRight size={13} className="ml-1.5 opacity-80" />
                </Button>
              </div>
            )}
          </Card.Content>
        </Card>
      </section>

      <section className="home-top-strategies">
        <div className="flex items-end justify-between gap-2 mb-3">
          <div>
            <h2 className="product-section-h text-[17px]">지금 볼 만한 전략</h2>
            <p className="product-section-sub mt-0.5">추천 점수 기준 상위 전략입니다.</p>
          </div>
          {canNavigate && (
            <Button variant="ghost" size="sm" onClick={() => onNavigate('market')}>전체 보기</Button>
          )}
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
            {canNavigate && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate('market')}>더 보기</Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {subStrategies.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                user={u}
                isLocked={false}
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
        <CoinPriceTable
          quotes={tableQuotes}
          showSkeleton={watchLoading && watchQuotes.length === 0}
          tab={priceTickerTab}
          onTabChange={setPriceTickerTab}
          favoriteSet={favoriteSet}
          onToggleFavorite={toggleFavorite}
        />
      </section>

      {watchError && (
        <p className="mb-4 text-[11px] text-slate-500">{watchError}</p>
      )}
      <p className="mb-1 text-[10px] text-slate-400">업데이트 · 빠름 {fmtLiveTime(lastFastUpdateAt)} · 중간 {fmtLiveTime(lastMidUpdateAt)} · 느림 {fmtLiveTime(lastSlowUpdateAt)}</p>

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

      {showOnboarding && (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              이 플랫폼을 처음 사용하시나요?
            </p>
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              사용 가이드 {stepIndex + 1}/{ONBOARDING_STEPS.length}
            </p>
            <h3 className="mt-1 text-[18px] font-bold text-slate-900 dark:text-slate-100">
              {currentStep.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              {currentStep.desc}
            </p>

            <div className="mt-4 flex items-center gap-1.5">
              {ONBOARDING_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === stepIndex
                      ? 'w-6 bg-blue-500'
                      : 'w-2.5 bg-slate-300 dark:bg-slate-700',
                  )}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={skipOnboarding}
                className="text-[12px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                건너뛰기
              </button>
              <Button type="button" variant="primary" size="sm" onClick={goNextStep}>
                {isLastStep ? '전략 보러가기' : '다음'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

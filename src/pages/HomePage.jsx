import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react'
import PageShell     from '../components/ui/PageShell'
import StatCard      from '../components/ui/StatCard'
import Card          from '../components/ui/Card'
import Badge         from '../components/ui/Badge'
import Button        from '../components/ui/Button'
import { cn }        from '../lib/cn'
import {
  HOME_KPIS,
  HOME_RECOMMENDATIONS,
  HOME_ACTIVITY,
  HOME_TOP_STRATEGIES,
  MARKET_COMMENT,
  MARKET_STATE,
  getStrategyById,
} from '../data/mockData'
import { getDisplayPrice } from '../lib/displayPriceService'

/* ── 시장 상태 바 ───────────────────────── */
function MarketStatusBar({ displayPrice }) {
  const pricePos = MARKET_STATE.btcChange24h >= 0
  return (
    <div className="flex items-center gap-6 mb-5 px-4 py-2.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[2px]">
      {/* BTC 현재가 */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">BTC</span>
        <span className="text-[16px] font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
          {displayPrice?.usdPrice != null
            ? `$${displayPrice.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : '로딩중...'}
        </span>
        {displayPrice?.krwPrice != null && (
          <span className="text-[13px] font-mono font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
            ₩{displayPrice.krwPrice.toLocaleString('ko-KR')}
            <span className="text-[9px] font-sans font-normal text-slate-400 ml-1">
              ({displayPrice.krwSource === 'upbit' ? 'Upbit' : 'Bithumb'})
            </span>
          </span>
        )}
        <span className={cn(
          'flex items-center gap-0.5 text-[12px] font-mono font-bold tabular-nums',
          pricePos ? 'text-emerald-600' : 'text-red-500',
        )}>
          {pricePos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {pricePos ? '+' : ''}{MARKET_STATE.btcChange24h}%
        </span>
      </div>

      <div className="w-px h-4 bg-slate-200 dark:bg-gray-700" />

      {[
        { label: 'BTC 도미넌스', value: `${MARKET_STATE.dominance}%` },
        { label: '공포탐욕지수', value: String(MARKET_STATE.fearGreed) },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">{label}</span>
          <span className="text-[13px] font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">{value}</span>
        </div>
      ))}

      <div className="w-px h-4 bg-slate-200 dark:bg-gray-700" />

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 font-medium">시장 상태</span>
        <Badge variant="warning">{MARKET_STATE.label}</Badge>
      </div>

      <div className="flex-1" />

      <span className="text-[10px] text-slate-400 italic">{MARKET_STATE.desc}</span>
    </div>
  )
}

/* ── KPI 카드 ────────────────────────────── */
function KpiGrid() {
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {HOME_KPIS.map((kpi) => (
        <StatCard key={kpi.label} {...kpi} />
      ))}
    </div>
  )
}

/* ── 추천 전략 카드 ──────────────────────── */
const BADGE_CLS = { BEST: 'info', GOOD: 'success', RISKY: 'warning' }
const CTA_CFG   = {
  not_started: { label: '무료 체험',    variant: 'primary'   },
  active:      { label: '체험 중',      variant: 'secondary' },
  expired:     { label: '구독하기',     variant: 'primary'   },
  subscribed:  { label: '사용 중',      variant: 'ghost'     },
}

function RecommendCard({ strategy, recommendBadge, recommendReason, ctaStatus, fitSummary }) {
  if (!strategy) return null
  const cta = CTA_CFG[ctaStatus] ?? CTA_CFG.not_started
  return (
    <Card className="flex flex-col hover:shadow-sm transition-shadow">
      <Card.Content className="flex-1 py-3">
        {/* 배지 */}
        <div className="flex items-center gap-1 mb-2">
          <Badge variant={BADGE_CLS[recommendBadge] ?? 'default'}>{recommendBadge}</Badge>
          <Badge variant="default">{strategy.typeLabel}</Badge>
        </div>

        {/* 전략명 */}
        <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-tight mb-1">
          {strategy.name}
        </p>

        {/* 저자 */}
        <p className="text-[10px] text-slate-400 mb-1.5">by {strategy.author}</p>

        {/* 추천 이유 */}
        <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-snug mb-3">
          {recommendReason}
        </p>

        {/* 통계 3분할 */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-gray-800 border border-slate-100 dark:border-gray-800 rounded-[1px]">
          {[
            { label: 'ROI',  value: `+${strategy.roi}%`,   pos: true  },
            { label: 'Win%', value: `${strategy.winRate}%`, pos: false },
            { label: 'MDD',  value: `${strategy.mdd}%`,    neg: true  },
          ].map(({ label, value, pos, neg }) => (
            <div key={label} className="flex flex-col items-center py-2">
              <span className="text-[9px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</span>
              <span className={cn(
                'text-[13px] font-bold font-mono tabular-nums leading-none',
                pos && 'text-emerald-600',
                neg && 'text-red-500',
                !pos && !neg && 'text-slate-700 dark:text-slate-300',
              )}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </Card.Content>

      <Card.Footer className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 truncate">{fitSummary}</span>
        <Button variant={cta.variant} size="sm" className="flex-shrink-0 ml-2">{cta.label}</Button>
      </Card.Footer>
    </Card>
  )
}

/* ── 이번주 TOP 전략 ─────────────────────── */
function TopStrategiesPanel() {
  const items = HOME_TOP_STRATEGIES
    .map((t) => ({ ...t, strategy: getStrategyById(t.strategyId) }))
    .filter((t) => t.strategy)

  return (
    <Card className="h-full">
      <Card.Header>
        <Card.Title>이번주 수익률 TOP</Card.Title>
        <span className="text-[10px] text-slate-400">7일 기준</span>
      </Card.Header>
      <div>
        {items.map((item, i) => (
          <div
            key={item.strategyId}
            className={cn(
              'flex items-center gap-3 px-3.5 py-2.5',
              i < items.length - 1 && 'border-b border-slate-100 dark:border-gray-800',
            )}
          >
            {/* 순위 */}
            <span className="w-6 text-[11px] font-bold text-slate-400 tabular-nums text-center flex-shrink-0">
              {item.rankLabel}
            </span>

            {/* 전략명 + 유형 */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                {item.strategy.name}
              </p>
              <p className="text-[10px] text-slate-400">{item.strategy.typeLabel}</p>
            </div>

            {/* 7일 수익 */}
            <div className="text-right flex-shrink-0">
              <p className={cn(
                'text-[13px] font-bold font-mono tabular-nums',
                item.roi7d >= 0 ? 'text-emerald-600' : 'text-red-500',
              )}>
                {item.roi7d >= 0 ? '+' : ''}{item.roi7d}%
              </p>
              <p className="text-[10px] text-slate-400 tabular-nums">
                30일 {item.roi30d >= 0 ? '+' : ''}{item.roi30d}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ── 최근 활동 피드 ──────────────────────── */
const DOT_CLS = {
  info:    'bg-blue-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger:  'bg-red-400',
  default: 'bg-slate-300',
}

function ActivityPanel() {
  return (
    <Card className="h-full">
      <Card.Header>
        <Card.Title>최근 활동</Card.Title>
        <span className="text-[10px] text-slate-400">시그널 및 상태 변경</span>
      </Card.Header>
      <div>
        {HOME_ACTIVITY.map((item, i) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 px-3.5 py-2.5',
              i < HOME_ACTIVITY.length - 1 && 'border-b border-slate-100 dark:border-gray-800',
            )}
          >
            <span className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              DOT_CLS[item.badge] ?? DOT_CLS.default,
            )} />
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                {item.strategyName}
              </span>
              <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
              <span className="text-[11px] text-slate-500">{item.desc}</span>
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ── 시장 코멘트 ─────────────────────────── */
function MarketCommentPanel() {
  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-1.5">
          <AlertCircle size={12} className="text-amber-500 flex-shrink-0" />
          <Card.Title>시장 코멘트</Card.Title>
        </div>
        <span className="text-[10px] text-slate-400">{MARKET_COMMENT.updatedAt}</span>
      </Card.Header>
      <Card.Content>
        <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 mb-2">
          {MARKET_COMMENT.summary}
        </p>
        <ul className="flex flex-col gap-1">
          {MARKET_COMMENT.points.map((pt, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-500">
              <span className="mt-[5px] w-1 h-1 rounded-full bg-slate-300 dark:bg-gray-600 flex-shrink-0" />
              {pt}
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  )
}

/* ── HomePage ────────────────────────────── */
export default function HomePage() {
  const [displayPrice, setDisplayPrice] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getDisplayPrice('BTC')
        setDisplayPrice(data)
      } catch (e) {
        console.error(e)
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const recommendations = HOME_RECOMMENDATIONS
    .map((r) => ({ ...r, strategy: getStrategyById(r.strategyId) }))
    .filter((r) => r.strategy)

  return (
    <PageShell>

      <div className="mb-2 text-[12px] text-slate-700 dark:text-slate-300">
        BTC 가격:{' '}
        {displayPrice?.usdPrice != null
          ? (
            <>
              ${displayPrice.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              {displayPrice.krwPrice != null && (
                <span className="text-slate-500">
                  {' '}
                  · ₩{displayPrice.krwPrice.toLocaleString('ko-KR')}
                  {displayPrice.krwSource && ` (${displayPrice.krwSource === 'upbit' ? 'Upbit' : 'Bithumb'})`}
                </span>
              )}
            </>
          )
          : '로딩중...'}
      </div>

      {/* ① 시장 상태 바 */}
      <MarketStatusBar displayPrice={displayPrice} />

      {/* ② KPI 4개 */}
      <KpiGrid />

      {/* ③ 오늘의 추천 전략 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">오늘의 추천 전략</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">현재 시장 상태 기준 · 횡보장</p>
        </div>
        <Button variant="ghost" size="sm">전략마켓 전체 보기</Button>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {recommendations.map((r) => (
          <RecommendCard key={r.strategyId} {...r} />
        ))}
      </div>

      {/* ④ 하단: 수익률 TOP + 활동 + 시장 코멘트 */}
      <div className="grid grid-cols-[1fr_1fr_280px] gap-3">
        <ActivityPanel />
        <TopStrategiesPanel />
        <MarketCommentPanel />
      </div>

    </PageShell>
  )
}

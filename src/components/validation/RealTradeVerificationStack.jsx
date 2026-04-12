import { cn } from '../../lib/cn'
import { VERIFICATION_UI_TIER } from '../../lib/realTradeVerificationUi'

const TIER_PILL = {
  [VERIFICATION_UI_TIER.VERIFIED]: {
    label: 'VERIFIED',
    desc: '실거래 인증 완료',
    className:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-200 dark:border-emerald-800',
  },
  [VERIFICATION_UI_TIER.LIVE_ONLY]: {
    label: 'LIVE ONLY',
    desc: '라이브 검증 진행 중',
    className:
      'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800',
  },
  [VERIFICATION_UI_TIER.BACKTEST_ONLY]: {
    label: 'BACKTEST ONLY',
    desc: '백테스트만 제공',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-gray-800 dark:text-slate-300 dark:border-gray-600',
  },
}

function VerificationTierPill({ uiTier }) {
  const cfg = TIER_PILL[uiTier] ?? TIER_PILL[VERIFICATION_UI_TIER.BACKTEST_ONLY]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide',
          cfg.className,
        )}
      >
        {cfg.label}
      </span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{cfg.desc}</span>
    </div>
  )
}

function VerificationSummaryBox({ conclusion, evidence }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        Verification Summary
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{conclusion}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-snug">{evidence}</p>
    </div>
  )
}

function ThreeLayerCards() {
  return (
    <div className="grid gap-3 md:grid-cols-3 mt-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Backtest</p>
        <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">백테스트</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">과거 데이터 기준 성과</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Live</p>
        <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">라이브 검증</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">전략 등록 이후 실시간 성과</p>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/25">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Real Trade</p>
        <p className="mt-2 text-base font-semibold text-emerald-800 dark:text-emerald-200">실거래 인증</p>
        <p className="mt-2 text-sm text-emerald-800/85 dark:text-emerald-300/90 leading-relaxed">
          판매자 실제 체결과 시그널 비교
        </p>
      </div>
    </div>
  )
}

function RealTradeExplainCard() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70 mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        Real Trade Verification
      </p>
      <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <li>거래소 API 연결을 통해 실제 체결 기록을 읽어옵니다.</li>
        <li>플랫폼 시그널과 실제 거래 방향·시간·가격을 비교합니다.</li>
        <li>수동 입력이 아닌, 연결된 거래소 데이터를 기준으로 계산합니다.</li>
      </ul>
    </div>
  )
}

function RealTradeKpiGrid({ kpis }) {
  if (!kpis) return null
  const items = [
    { label: '매칭률', value: kpis.matchRate, sub: '최근 시그널 기준' },
    { label: '평균 지연', value: kpis.avgDelay, sub: '시그널 → 체결 기준' },
    { label: '평균 가격 오차', value: kpis.avgPriceDiff, sub: '실제 체결가 기준' },
    { label: '실거래 수익률', value: kpis.verifiedReturn, sub: '연결된 거래소 체결 기준', positive: true },
    { label: '비교 건수', value: kpis.sampleCount, sub: '최근 검증 표본' },
    { label: '인증 상태', value: kpis.authStatus, sub: kpis.authSub },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mt-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{it.label}</p>
          <p
            className={cn(
              'mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100',
              it.positive && 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {it.value}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 leading-snug">{it.sub}</p>
        </div>
      ))}
    </div>
  )
}

function RealTradeComparisonSection({ rows }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 mt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">실거래 비교 기록</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">최근 시그널과 실제 체결 비교</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">표시할 비교 기록이 없습니다.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 dark:border-gray-800 dark:bg-gray-800/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {r.signalDir} · {r.symbol}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    시그널 {r.signalTimeLabel} / 체결 {r.fillTimeLabel}
                    {Number.isFinite(r.timeDiffSec) ? ` · 지연 약 ${r.timeDiffSec}초` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    체결 방향 {r.fillSide} · 가격 오차 {Number(r.priceDiffPct).toFixed(2)}%
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      r.aligned ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {r.aligned ? '일치' : '불일치'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RealTradeTrendChart({ series }) {
  const vals = Array.isArray(series) && series.length ? series : [0]
  const max = Math.max(...vals, 1)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 mt-4">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">매칭률 누적 추이</p>
      <p className="text-xs text-slate-400 mt-0.5 mb-3">최근 비교 건이 쌓일수록 곡선이 의미를 가집니다.</p>
      <div className="flex items-end gap-0.5 h-24 px-1">
        {vals.map((v, i) => (
          <div
            key={i}
            className="flex-1 min-w-0 rounded-t bg-emerald-500/80 dark:bg-emerald-600/70"
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
            title={`${v}%`}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        정적 숫자만이 아니라, 표본이 늘어날수록 어떻게 변하는지 함께 봅니다.
      </p>
    </div>
  )
}

/**
 * 검증 페이지 상단: 실거래 인증 블록 전체
 */
export default function RealTradeVerificationStack({ view, className = '' }) {
  if (!view) return null

  const { summaryLines, uiTier, kpis, comparisonRows, matchRateSeries } = view

  return (
    <section className={cn('real-trade-verification-stack mb-8', className)} aria-label="실거래 인증">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="product-section-h mb-0">실거래 인증</h2>
        <VerificationTierPill uiTier={uiTier} />
      </div>

      <VerificationSummaryBox conclusion={summaryLines.conclusion} evidence={summaryLines.evidence} />
      <ThreeLayerCards />
      <RealTradeExplainCard />
      {kpis && <RealTradeKpiGrid kpis={kpis} />}
      <RealTradeComparisonSection rows={comparisonRows ?? []} />
      <RealTradeTrendChart series={matchRateSeries} />
    </section>
  )
}

export { VerificationTierPill }

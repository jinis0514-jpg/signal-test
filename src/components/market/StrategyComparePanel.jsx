import { cn } from '../../lib/cn'
import {
  compareMetricIndices,
  buildPerStrategyCompareLines,
  buildCompareSummaryCard,
  buildCompareActionHints,
  formatCompareRoiText,
  formatCompareMddText,
  formatCompareWinText,
  formatCompareMatchText,
  formatCompareTradesText,
  formatRecentPerformanceText,
  formatRiskSummaryLine,
  verificationCompareMeta,
  liveStateCellClassName,
} from '../../lib/strategyCompare'
import { getStrategyLiveState } from '../../lib/strategyLiveState'
import { classifyMarketState } from '../../lib/marketStateEngine'
import { buildStrategyScenario } from '../../lib/strategyScenarioEngine'
import { computeTrustScore } from '../../lib/strategyTrustScore'
import { evaluateStrategyPair } from '../../lib/strategyCorrelationEngine'

function MetricCell({
  children,
  emphasizeGood,
  emphasizeWarn,
  muted,
}) {
  return (
    <td
      className={cn(
        'py-3 pr-4 text-sm align-top',
        muted && 'text-slate-400 dark:text-slate-500',
        emphasizeGood && 'font-semibold text-emerald-600 dark:text-emerald-400',
        emphasizeWarn && 'font-semibold text-rose-600 dark:text-rose-400',
        !emphasizeGood && !emphasizeWarn && !muted && 'text-slate-800 dark:text-slate-200',
      )}
    >
      {children}
    </td>
  )
}

function scenarioCells(strategies, market) {
  return strategies.map((s) => {
    const ts = computeTrustScore({
      matchRate: Number(s.matchRate ?? s.match_rate ?? 0),
      verifiedReturn: Number(s.verifiedReturn ?? s.verified_return_pct ?? 0),
      liveReturn30d: Number(s.recentRoi30d ?? s.roi30d ?? 0),
      maxDrawdown: Math.abs(Number(s.maxDrawdown ?? s.mdd ?? 0)),
      tradeCount: Number(s.tradeCount ?? s.trades ?? 0),
      hasRealVerification: !!s.hasRealVerification,
    })
    const sc = buildStrategyScenario(
      {
        ...s,
        trustScore: ts,
        recentRoi7d: Number(s.recentRoi7d ?? s.roi7d ?? 0),
        maxDrawdown: Math.abs(Number(s.maxDrawdown ?? s.mdd ?? 0)),
      },
      market,
    )
    return { primary: sc.primaryScenario, risk: sc.riskScenario }
  })
}

export default function StrategyComparePanel({
  strategies,
  marketState = null,
}) {
  const market = marketState ?? classifyMarketState({
    btcChange24h: 0,
    ethChange24h: 0,
    avgRangePct: 0,
  })
  const scenarioCols = scenarioCells(strategies, market)

  const lines = buildPerStrategyCompareLines(strategies)
  const { headline, sub } = buildCompareSummaryCard(strategies)
  const hints = buildCompareActionHints(strategies)
  const idx = compareMetricIndices(strategies)

  const pairCorrelation =
    strategies.length === 2
      ? evaluateStrategyPair(strategies[0], strategies[1])
      : null

  return (
    <div
      id="market-strategy-compare"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Strategy Compare
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
          전략 비교
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          최대 3개 전략을 비교해 성격·리스크·신뢰까지 함께 보세요. (2개 비교를 권장합니다)
        </p>
      </div>

      {lines.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/50">
          {lines.map((line, i) => (
            <li key={i} className="text-[13px] leading-snug text-slate-700 dark:text-slate-300">
              {line}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Compare Summary
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {headline}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {sub}
        </p>
      </div>

      {pairCorrelation && (
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Pair correlation
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            유사도 {Math.round(pairCorrelation.similarity)}점 · 분산 점수 {Math.round(pairCorrelation.diversification)}점
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-snug">
            {pairCorrelation.summary}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            {pairCorrelation.warning}
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {pairCorrelation.recommendation}
          </p>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-gray-700">
              <th className="py-3 pr-4 text-left text-sm font-medium text-slate-500">항목</th>
              {strategies.map((s) => (
                <th
                  key={s.id}
                  className="py-3 pr-4 text-left text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">전략명</td>
              {strategies.map((s) => (
                <MetricCell key={s.id} emphasizeGood={false}>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</span>
                </MetricCell>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">전략 타입</td>
              {strategies.map((s) => (
                <MetricCell key={s.id}>{s.typeLabel ?? '—'}</MetricCell>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">사용자 성향</td>
              {strategies.map((s) => (
                <MetricCell key={s.id}>{s.profileLabel ?? '—'}</MetricCell>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">현재 상태</td>
              {strategies.map((s) => {
                const live = getStrategyLiveState(s)
                return (
                  <td
                    key={s.id}
                    className={cn(
                      'py-3 pr-4 text-sm font-medium',
                      liveStateCellClassName(s),
                    )}
                  >
                    {live.shortLabel ?? live.label}
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">수익률</td>
              {strategies.map((s, i) => (
                <MetricCell
                  key={s.id}
                  emphasizeGood={idx.bestRoi.has(i)}
                >
                  {formatCompareRoiText(s)}
                </MetricCell>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">승률</td>
              {strategies.map((s, i) => (
                <MetricCell
                  key={s.id}
                  emphasizeGood={idx.bestWin.has(i)}
                >
                  {formatCompareWinText(s)}
                </MetricCell>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">MDD</td>
              {strategies.map((s, i) => (
                <MetricCell
                  key={s.id}
                  emphasizeGood={idx.lowestMdd.has(i)}
                  emphasizeWarn={idx.worstMdd.has(i) && !idx.lowestMdd.has(i)}
                >
                  {formatCompareMddText(s)}
                </MetricCell>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">거래 수</td>
              {strategies.map((s) => (
                <MetricCell key={s.id}>{formatCompareTradesText(s)}</MetricCell>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">기대 시나리오 (현재 시장)</td>
              {strategies.map((s, i) => (
                <td
                  key={s.id}
                  className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400 leading-snug"
                >
                  {scenarioCols[i]?.primary ?? '—'}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">위험 시나리오 (현재 시장)</td>
              {strategies.map((s, i) => (
                <td
                  key={s.id}
                  className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400 leading-snug"
                >
                  {scenarioCols[i]?.risk ?? '—'}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">최근 성과</td>
              {strategies.map((s) => {
                const r = Number(s.recentRoi7d ?? s.roi7d)
                const neg = Number.isFinite(r) && r < 0
                const pos = Number.isFinite(r) && r > 0
                return (
                  <td
                    key={s.id}
                    className={cn(
                      'py-3 pr-4 text-sm tabular-nums',
                      pos && 'font-medium text-emerald-600 dark:text-emerald-400',
                      neg && 'font-medium text-rose-600 dark:text-rose-400',
                      !pos && !neg && 'text-slate-800 dark:text-slate-200',
                    )}
                  >
                    {formatRecentPerformanceText(s)}
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">실거래 인증 상태</td>
              {strategies.map((s) => {
                const level = s.verified_badge_level ?? 'backtest_only'
                const meta = verificationCompareMeta(level)
                return (
                  <td
                    key={s.id}
                    className={cn(
                      'py-3 pr-4 text-sm font-medium',
                      meta.tone === 'verified' && 'text-emerald-600 dark:text-emerald-400',
                      meta.tone === 'live' && 'text-blue-600 dark:text-blue-400',
                      meta.tone === 'muted' && 'text-slate-400 dark:text-slate-500',
                    )}
                  >
                    {meta.label}
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 text-sm text-slate-500">매칭률</td>
              {strategies.map((s, i) => {
                const raw = Number(s.matchRate ?? s.match_rate)
                const missing = !Number.isFinite(raw)
                return (
                  <MetricCell
                    key={s.id}
                    muted={missing}
                    emphasizeGood={!missing && idx.bestMatch.has(i)}
                  >
                    {formatCompareMatchText(s)}
                  </MetricCell>
                )
              })}
            </tr>
            <tr>
              <td className="py-3 pr-4 text-sm text-slate-500">리스크 요약</td>
              {strategies.map((s) => (
                <td
                  key={s.id}
                  className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400 leading-snug"
                >
                  {formatRiskSummaryLine(s)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {hints.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Next step
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            {hints.map((h, i) => (
              <li key={i} className="leading-snug">
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

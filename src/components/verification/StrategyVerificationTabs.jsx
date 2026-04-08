import { useState, useEffect, useCallback, useMemo } from 'react'
import VerificationBadge from './VerificationBadge'
import LivePerformanceChart from './LivePerformanceChart'
import TradeComparisonTable from './TradeComparisonTable'
import { fetchVerificationSummary, fetchTradeMatches } from '../../lib/verificationService'
import { fetchLivePerformanceDaily, fetchLivePerformanceSummary } from '../../lib/livePerformanceService'
import { getVerificationBadgeConfig, THRESHOLDS } from '../../lib/verificationBadge'
import { computeTrustScore, getTrustGrade } from '../../lib/strategyTrustScore'

function KpiCard({ label, value, sub, hint, positive }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${
        positive === true ? 'text-emerald-600 dark:text-emerald-400'
          : positive === false ? 'text-red-500'
          : 'text-slate-800 dark:text-slate-100'
      }`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
      {hint && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-snug">{hint}</div>}
    </div>
  )
}

function TabDescription({ children }) {
  return (
    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3 px-0.5">
      {children}
    </p>
  )
}

const TABS = [
  { id: 'backtest', label: '백테스트' },
  { id: 'live', label: '라이브 성과' },
  { id: 'verification', label: '실거래 인증' },
  { id: 'comparison', label: '시그널 vs 체결' },
]

const HEADLINE_STYLES = {
  positive: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20',
  negative: 'border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20',
  neutral: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20',
}

const BADGE_DESCRIPTIONS = {
  backtest_only: '과거 데이터만 검증된 상태',
  live_verified: '전략 등록 이후 실시간 검증 단계',
  trade_verified: '실거래 검증 완료',
}

export default function StrategyVerificationTabs({
  strategy,
  className = '',
}) {
  const [activeTab, setActiveTab] = useState('backtest')
  const [summary, setSummary] = useState(null)
  const [dailyPerf, setDailyPerf] = useState([])
  const [liveSummary, setLiveSummary] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)

  const strategyId = strategy?.id

  const loadData = useCallback(async () => {
    if (!strategyId) return
    setLoading(true)
    try {
      const [s, dp, ls, m] = await Promise.all([
        fetchVerificationSummary(strategyId),
        fetchLivePerformanceDaily(strategyId, { days: 90 }),
        fetchLivePerformanceSummary(strategyId),
        fetchTradeMatches(strategyId, { limit: 100 }),
      ])
      setSummary(s)
      setDailyPerf(dp)
      setLiveSummary(ls)
      setMatches(m)
    } catch {
      /* mock 폴백 */
    } finally {
      setLoading(false)
    }
  }, [strategyId])

  useEffect(() => { loadData() }, [loadData])

  const perf = strategy?.performance ?? strategy?.backtest_meta ?? {}
  const bt = {
    roi: perf.totalReturnPct ?? perf.roi ?? strategy?.roi ?? '-',
    winRate: perf.winRate ?? perf.win_rate ?? strategy?.winRate ?? '-',
    mdd: perf.maxDrawdown ?? perf.mdd ?? strategy?.mdd ?? '-',
    trades: perf.tradeCount ?? perf.totalTrades ?? perf.trade_count ?? strategy?.trades ?? '-',
    sharpe: perf.sharpe ?? perf.sharpeRatio ?? '-',
    periodDays: perf.periodDays ?? '-',
  }

  const verLevel = summary?.verified_badge_level ?? strategy?.verified_badge_level ?? 'backtest_only'
  const badgeConfig = getVerificationBadgeConfig(verLevel)

  /* ── 1) 상단 검증 요약 ─────────────────────────── */
  const verificationHeadline = useMemo(() => {
    const signalCount = Number(summary?.last_30_signal_count ?? 0)
    const matched = Number(summary?.matched_signal_count ?? 0)
    const matchRate = Number(summary?.match_rate ?? 0)
    const verifiedReturn = Number(summary?.verified_return_pct)
    const safeReturn = Number.isFinite(verifiedReturn) ? verifiedReturn : null

    if (!summary) {
      return {
        tone: 'neutral',
        title: '추가 검증이 필요한 전략입니다',
        desc: '매칭 데이터가 아직 충분하지 않습니다.',
      }
    }

    if (matchRate >= 80 && safeReturn != null && safeReturn > 0) {
      return {
        tone: 'positive',
        title: '실거래 기준으로도 안정적인 전략입니다',
        desc: `최근 ${signalCount}개 중 ${matched}개 매칭 / 수익률 ${safeReturn >= 0 ? '+' : ''}${safeReturn.toFixed(1)}%`,
      }
    }

    if (matchRate >= 60) {
      return {
        tone: 'neutral',
        title: '추가 검증이 필요한 전략입니다',
        desc: `매칭률 ${matchRate.toFixed(1)}% / ${safeReturn != null ? `수익률 ${safeReturn >= 0 ? '+' : ''}${safeReturn.toFixed(1)}%` : '성과 변동성 확인 필요'}`,
      }
    }

    if (signalCount > 0) {
      return {
        tone: 'negative',
        title: '신뢰도가 낮아 주의가 필요합니다',
        desc: `매칭률 ${matchRate.toFixed(1)}% / 실거래 성과 불안정`,
      }
    }

    return {
      tone: 'neutral',
      title: '추가 검증이 필요한 전략입니다',
      desc: '매칭 데이터가 아직 충분하지 않습니다.',
    }
  }, [summary])

  /* ── 2) comparison 탭 요약 ─────────────────────── */
  const comparisonSummary = useMemo(() => {
    if (!Array.isArray(matches) || matches.length === 0) {
      return { total: 0, verified: 0, sideMatched: 0, sideMatchRate: null, avgPriceDiff: null }
    }

    const total = matches.length
    const verified = matches.filter((m) => m?.is_verified_match).length
    const sideMatchedRows = matches.filter((m) => m?.side_matched === true)
    const sideMatched = sideMatchedRows.length
    const sideMatchRate = total > 0 ? (sideMatchedRows.length / total) * 100 : null

    const priceDiffs = matches
      .map((m) => Number(m?.price_diff_pct))
      .filter((n) => Number.isFinite(n))
    const avgPriceDiff = priceDiffs.length
      ? priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length
      : null

    return { total, verified, sideMatched, sideMatchRate, avgPriceDiff }
  }, [matches])

  /* ── 4) 라이브 탭 해석 ─────────────────────────── */
  const liveInterpretation = useMemo(() => {
    if (!liveSummary) return null

    const roi30d = Number(liveSummary?.roi30d)
    const latestMdd = Number(liveSummary?.latestMdd)
    const btMdd = Number(bt.mdd)

    if (Number.isFinite(roi30d) && roi30d > 0 && Number.isFinite(latestMdd) && latestMdd <= Math.max(15, Number.isFinite(btMdd) ? btMdd * 1.2 : 15)) {
      return {
        tone: 'positive',
        text: '최근 30일 성과는 백테스트 대비 안정적으로 유지되고 있습니다.',
      }
    }

    if (Number.isFinite(roi30d) && roi30d < 0) {
      return {
        tone: 'negative',
        text: '최근 성과가 백테스트 대비 약세입니다.',
      }
    }

    return {
      tone: 'neutral',
      text: '라이브 데이터가 더 누적되면 방향성이 명확해집니다.',
    }
  }, [liveSummary, bt.mdd])

  const trustScore = useMemo(() => {
    return computeTrustScore({
      matchRate: summary?.match_rate,
      verifiedReturn: summary?.verified_return_pct,
      liveReturn30d: liveSummary?.roi30d,
      maxDrawdown: strategy?.performance?.maxDrawdown,
      tradeCount: summary?.last_30_signal_count,
      hasRealVerification: Boolean(summary),
    })
  }, [summary, liveSummary, strategy])

  const trustGrade = useMemo(() => {
    return getTrustGrade(trustScore)
  }, [trustScore])

  return (
    <div className={className}>
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          이 전략의 신뢰도: {trustScore}점 ({trustGrade.grade}등급)
        </div>
      </div>

      {/* ── 1) 상단 검증 요약 박스 ──────────────────── */}
      <div className={`rounded-lg border p-4 mb-4 ${HEADLINE_STYLES[verificationHeadline.tone]}`}>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {verificationHeadline.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {verificationHeadline.desc}
        </p>
      </div>

      {/* 6) 배지 + 검증 수준 설명 */}
      <div className="flex items-center gap-2 mb-3">
        <VerificationBadge level={verLevel} size="sm" />
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {BADGE_DESCRIPTIONS[verLevel] ?? '검증 수준 확인 중'}
        </span>
      </div>

      {/* ── 탭 ───────────────────────────────────── */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-2 text-xs font-medium transition-colors rounded-t-lg
              ${activeTab === tab.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-b-0 border-slate-200 dark:border-slate-700 -mb-px'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}
            `}
          >
            {tab.label}
            {tab.id === 'verification' && (
              <span className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full ${badgeConfig.dotClass}`} />
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400 text-sm animate-pulse">
          데이터 로딩 중...
        </div>
      )}

      {/* ── Tab 1: 백테스트 ────────────────────────── */}
      {!loading && activeTab === 'backtest' && (
        <div>
          <TabDescription>
            과거 데이터 기준 성과이며, 실제 시장에서는 다르게 나타날 수 있습니다.
          </TabDescription>
          <div className="flex items-center gap-2 mb-3">
            <VerificationBadge level="backtest_only" size="xs" />
            <span className="text-xs text-slate-500 dark:text-slate-400">등록 시점의 과거 데이터 기반 성과</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <KpiCard
              label="수익률"
              value={`${bt.roi}%`}
              sub="실거래 기준 성과와 분리"
              positive={Number(bt.roi) > 0}
              hint={Number(bt.roi) > 30 ? '높을수록 유리하지만 유지 여부 확인 필요' : undefined}
            />
            <KpiCard
              label="승률"
              value={`${bt.winRate}%`}
              sub="60% 이상이면 안정적인 편"
              positive={Number(bt.winRate) >= 50}
              hint={Number(bt.winRate) >= 60 ? '안정 구간' : Number(bt.winRate) < 50 ? '주의 구간' : undefined}
            />
            <KpiCard
              label="MDD"
              value={`${bt.mdd}%`}
              sub="낮을수록 안정적인 전략"
              positive={Number(bt.mdd) <= 10}
              hint={Number(bt.mdd) >= 20 ? '20% 이상이면 위험 구간' : undefined}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="거래 수" value={bt.trades} sub="표본이 많을수록 신뢰도 상승" hint={Number(bt.trades) < 30 ? '표본 부족 구간' : undefined} />
            <KpiCard label="샤프 비율" value={bt.sharpe} sub="1 이상이면 양호" positive={Number(bt.sharpe) > 1} hint={Number(bt.sharpe) > 1.5 ? '우수한 위험 대비 수익' : undefined} />
            <KpiCard label="테스트 기간" value={`${bt.periodDays}일`} sub="백테스트 기준" hint={Number(bt.periodDays) < 90 ? '짧은 테스트 기간 — 과최적화 가능성' : undefined} />
          </div>
        </div>
      )}

      {/* ── Tab 2: 라이브 성과 ─────────────────────── */}
      {!loading && activeTab === 'live' && (
        <div>
          <TabDescription>
            전략 등록 이후 실시간 시장에서의 성과입니다. 백테스트와 비교해 성과가 유지되는지 확인하세요.
          </TabDescription>
          <div className="flex items-center gap-2 mb-3">
            <VerificationBadge level={verLevel === 'backtest_only' ? 'backtest_only' : 'live_verified'} size="xs" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {verLevel === 'backtest_only' ? '아직 라이브 검증 전 단계' : '전략 등록 이후 실시간 검증 단계'}
            </span>
          </div>

          {liveSummary && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <KpiCard
                label="최근 7일"
                value={liveSummary.roi7d != null ? `${liveSummary.roi7d > 0 ? '+' : ''}${liveSummary.roi7d}%` : '-'}
                sub="단기 성과 방향"
                positive={liveSummary.roi7d > 0}
                hint={liveSummary.roi7d != null && liveSummary.roi7d < -5 ? '최근 급격한 손실 발생' : undefined}
              />
              <KpiCard
                label="최근 30일"
                value={liveSummary.roi30d != null ? `${liveSummary.roi30d > 0 ? '+' : ''}${liveSummary.roi30d}%` : '-'}
                sub="백테스트 대비 판단 지표"
                positive={liveSummary.roi30d > 0}
              />
              <KpiCard
                label="MDD"
                value={liveSummary.latestMdd != null ? `${liveSummary.latestMdd}%` : '-'}
                sub="10% 이하면 안정 · 20% 이상 위험"
                positive={liveSummary.latestMdd != null && liveSummary.latestMdd <= 10}
                hint={liveSummary.latestMdd >= 20 ? '위험 구간' : undefined}
              />
            </div>
          )}

          <LivePerformanceChart dailyData={dailyPerf} />

          {summary && (
            <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
              시그널: {summary.last_30_signal_count ?? 0}개 (최근 30개 기준)
            </div>
          )}

          {/* 4) 백테스트 대비 해석 문장 */}
          {liveInterpretation && (
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              {liveInterpretation.text}
            </div>
          )}

        </div>
      )}

      {/* ── Tab 3: 실거래 인증 ─────────────────────── */}
      {!loading && activeTab === 'verification' && (
        <div>
          <TabDescription>
            판매자의 실제 거래와 전략 시그널을 비교한 결과입니다. 매칭률이 높을수록 판매자가 본인 전략을 실제로 사용하고 있다는 의미입니다.
          </TabDescription>

          <div className="flex items-center gap-2 mb-3">
            <VerificationBadge level={verLevel} size="sm" />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {BADGE_DESCRIPTIONS[verLevel] ?? '검증 수준 확인 중'}
            </span>
          </div>

          {verLevel === 'trade_verified' && summary && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <KpiCard
                  label="매칭률"
                  value={`${summary.match_rate?.toFixed(1) ?? 0}%`}
                  sub="실제 거래와 일치한 비율"
                  positive={summary.match_rate >= 80}
                  hint={summary.match_rate >= 80 ? '높은 일치율 — 실제 사용 중' : summary.match_rate < 50 ? '낮은 일치율 — 전략 신뢰도 주의' : undefined}
                />
                <KpiCard
                  label="평균 가격 오차"
                  value={summary.avg_price_diff_pct != null ? `${Number(summary.avg_price_diff_pct).toFixed(2)}%` : '-'}
                  sub="낮을수록 시그널과 유사"
                  positive={summary.avg_price_diff_pct != null && summary.avg_price_diff_pct <= THRESHOLDS.TRADE_VERIFIED_MAX_PRICE_DIFF}
                  hint={summary.avg_price_diff_pct <= 0.2 ? '시그널과 거의 동일한 가격에 체결' : undefined}
                />
                <KpiCard
                  label="평균 체결 지연"
                  value={summary.avg_time_diff_sec != null ? `${Number(summary.avg_time_diff_sec).toFixed(0)}초` : '-'}
                  sub="짧을수록 실행 일관성 높음"
                  positive={summary.avg_time_diff_sec != null && summary.avg_time_diff_sec <= 180}
                  hint={summary.avg_time_diff_sec <= 30 ? '즉시 체결 수준' : summary.avg_time_diff_sec > 120 ? '체결 지연이 있음' : undefined}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <KpiCard
                  label="검증 수익률"
                  value={summary.verified_return_pct != null ? `${Number(summary.verified_return_pct) >= 0 ? '+' : ''}${Number(summary.verified_return_pct).toFixed(2)}%` : '-'}
                  sub="실거래 기준 성과"
                  positive={summary.verified_return_pct > 0}
                />
                <KpiCard
                  label="매칭 건수"
                  value={`${summary.matched_signal_count ?? 0}건`}
                  sub="표본이 많을수록 신뢰도 상승"
                  hint={summary.matched_signal_count >= 20 ? '충분한 표본' : '표본이 적어 추가 관찰 권장'}
                />
              </div>

              {/* 종합 판단 문장 */}
              <div className={`rounded-lg border p-3 mb-4 ${HEADLINE_STYLES[verificationHeadline.tone]}`}>
                <p className="text-[12px] font-medium text-slate-800 dark:text-slate-200">
                  {verificationHeadline.tone === 'positive' && '실제 거래와 높은 일치도를 보입니다.'}
                  {verificationHeadline.tone === 'neutral' && '추가 확인이 필요한 검증 단계입니다.'}
                  {verificationHeadline.tone === 'negative' && '실거래 일치도가 낮아 추가 확인이 필요합니다.'}
                </p>
              </div>
            </>
          )}

          {verLevel === 'live_verified' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">실시간 검증 단계</p>
              <p className="text-xs leading-relaxed">
                이 전략은 라이브 시그널이 검증되었으나, 아직 판매자의 실거래 인증이 완료되지 않았습니다.
                판매자가 거래소 API를 연결하면 실거래 인증이 시작됩니다.
              </p>
              <p className="text-[11px] mt-2 text-blue-600 dark:text-blue-400">
                실거래 인증이 완료되면 전략의 신뢰도가 크게 상승합니다.
              </p>
            </div>
          )}

          {verLevel === 'backtest_only' && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium mb-1">백테스트 단계</p>
              <p className="text-xs leading-relaxed">
                이 전략은 과거 데이터 백테스트만 완료된 상태입니다.
                등록 후 {THRESHOLDS.LIVE_VERIFIED_MIN_DAYS}일 이상, {THRESHOLDS.LIVE_VERIFIED_MIN_SIGNALS}개 이상의
                시그널이 누적되면 실시간 검증 단계로 승격됩니다.
              </p>
              <p className="text-[11px] mt-2 text-slate-500">
                검증 단계가 올라갈수록 전략의 신뢰도가 높아집니다.
              </p>
            </div>
          )}

          {/* 3) 인증 조건 체크리스트 — 방향 일치 실제 값 연결 */}
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">인증 조건</h4>
            <ConditionRow
              label={`시그널 ${THRESHOLDS.LIVE_VERIFIED_MIN_SIGNALS}개 이상`}
              met={(summary?.last_30_signal_count ?? 0) >= THRESHOLDS.LIVE_VERIFIED_MIN_SIGNALS}
              value={`${summary?.last_30_signal_count ?? 0}개`}
            />
            <ConditionRow
              label={`매칭률 ${THRESHOLDS.TRADE_VERIFIED_MIN_MATCH_RATE}% 이상`}
              met={(summary?.match_rate ?? 0) >= THRESHOLDS.TRADE_VERIFIED_MIN_MATCH_RATE}
              value={summary?.match_rate != null ? `${Number(summary.match_rate).toFixed(1)}%` : '-'}
            />
            <ConditionRow
              label={`가격 오차 ${THRESHOLDS.TRADE_VERIFIED_MAX_PRICE_DIFF}% 이하`}
              met={summary?.avg_price_diff_pct != null && summary.avg_price_diff_pct <= THRESHOLDS.TRADE_VERIFIED_MAX_PRICE_DIFF}
              value={summary?.avg_price_diff_pct != null ? `${Number(summary.avg_price_diff_pct).toFixed(2)}%` : '-'}
            />
            <ConditionRow
              label={`방향 일치 ${THRESHOLDS.TRADE_VERIFIED_MIN_SIDE_MATCH}% 이상`}
              met={comparisonSummary.sideMatchRate != null && comparisonSummary.sideMatchRate >= THRESHOLDS.TRADE_VERIFIED_MIN_SIDE_MATCH}
              value={comparisonSummary.sideMatchRate != null ? `${Number(comparisonSummary.sideMatchRate).toFixed(1)}%` : '-'}
            />
          </div>
        </div>
      )}

      {/* ── Tab 4: 시그널 vs 체결 비교 ─────────────── */}
      {!loading && activeTab === 'comparison' && (
        <div>
          {/* 2) comparison KPI 요약 */}
          {comparisonSummary.total > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <KpiCard
                label="검증 매칭"
                value={`${comparisonSummary.verified}/${comparisonSummary.total}`}
                sub="매칭 건수 요약"
                positive={comparisonSummary.total > 0 && comparisonSummary.verified / comparisonSummary.total >= 0.7}
              />
              <KpiCard
                label="방향 일치율"
                value={comparisonSummary.sideMatchRate != null ? `${Number(comparisonSummary.sideMatchRate).toFixed(1)}%` : '-'}
                sub="실제 거래와 일치한 비율"
                positive={comparisonSummary.sideMatchRate != null && comparisonSummary.sideMatchRate >= THRESHOLDS.TRADE_VERIFIED_MIN_SIDE_MATCH}
              />
              <KpiCard
                label="평균 가격 오차"
                value={comparisonSummary.avgPriceDiff != null ? `${comparisonSummary.avgPriceDiff.toFixed(2)}%` : '-'}
                sub="낮을수록 체결 정합성 높음"
                positive={comparisonSummary.avgPriceDiff != null && comparisonSummary.avgPriceDiff <= THRESHOLDS.TRADE_VERIFIED_MAX_PRICE_DIFF}
              />
            </div>
          )}

          {comparisonSummary.total > 0 && (
            <div className="mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300">
              최근 {comparisonSummary.total}개 시그널 중 {comparisonSummary.sideMatched}개 방향 일치
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              시그널과 실제 거래 비교 ({matches.length}건)
            </span>
            {matches.length > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                매칭: {comparisonSummary.verified}건
              </span>
            )}
          </div>
          <TradeComparisonTable matches={matches} />
        </div>
      )}
    </div>
  )
}

function ConditionRow({ label, met, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className={met ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}>
          {met ? '✓' : '○'}
        </span>
        <span className={met ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
          {label}
        </span>
      </div>
      <span className={`font-mono ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
        {value}
      </span>
    </div>
  )
}

import { cn } from '../../lib/cn'

const breakdownCard =
  'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900'

function BreakdownList({ items }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  if (!list.length) {
    return <p className="mt-3 text-sm text-slate-400">데이터 부족</p>
  }
  return (
    <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
      {list.map((line, i) => (
        <li key={i} className="leading-snug">
          {line}
        </li>
      ))}
    </ul>
  )
}

/** breakdown: buildStrategyBreakdown() 반환 객체 */
export default function StrategyBreakdownSection({ breakdown, className, showMeta = true }) {
  const b = breakdown && typeof breakdown === 'object' ? breakdown : {}
  const meta = b.meta ?? {}

  return (
    <section className={cn('mt-2', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Strategy Breakdown
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
            전략 해부
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            이 전략이 강한 구간과 약한 구간을 빠르게 확인하세요.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={breakdownCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-500">
            Strong Market
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            강한 시장
          </h4>
          <BreakdownList items={b.strongMarket} />
        </div>

        <div className={breakdownCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500">
            Weak Market
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            약한 시장
          </h4>
          <BreakdownList items={b.weakMarket} />
        </div>

        <div className={breakdownCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-blue-500">
            Winning Pattern
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            승리 패턴
          </h4>
          <BreakdownList items={b.winningPattern} />
        </div>

        <div className={breakdownCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-rose-500/90">
            Failure Pattern
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            실패 패턴
          </h4>
          <BreakdownList items={b.failurePattern} />
        </div>
      </div>

      {Array.isArray(b.bestFor) && b.bestFor.length > 0 && (
        <div className="mt-4">
          <div className={breakdownCard}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Best For
            </p>
            <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              추천 사용자
            </h4>
            <BreakdownList items={b.bestFor} />
          </div>
        </div>
      )}

      {showMeta && Number.isFinite(meta.sampleSize) && (
        <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
          엔진 거래 {meta.sampleSize}건 기준
          {meta.hasRegime ? ' · 시장 레짐(추세·변동성) 태그 반영' : ' · 레짐 태그 없이 요약'}
        </p>
      )}
    </section>
  )
}

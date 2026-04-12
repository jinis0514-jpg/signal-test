import { cn } from '../../lib/cn'

const riskCard =
  'min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900'

const riskDangerCard =
  'min-w-0 rounded-2xl border border-rose-200 bg-rose-50/70 p-5 sm:p-6 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20'

const riskWarnCard =
  'min-w-0 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20'

function BulletList({ items }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  if (!list.length) {
    return <p className="mt-3 text-sm text-slate-400">데이터 부족</p>
  }
  return (
    <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
      {list.map((line, i) => (
        <li key={i} className="leading-relaxed break-words [overflow-wrap:anywhere]">
          {line}
        </li>
      ))}
    </ul>
  )
}

/** risk: buildStrategyRiskBreakdown() 반환 객체 */
export default function StrategyRiskBreakdownSection({ risk, className, showMeta = true }) {
  const r = risk && typeof risk === 'object' ? risk : {}
  const meta = r.meta ?? {}
  const mdd = r.mddPct

  return (
    <section className={cn('mt-8', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Risk Breakdown
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
            리스크 해부
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            이 전략이 위험해지는 구간과 손실 패턴을 확인하세요.
          </p>
          {r.summaryLine && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-snug border-l-2 border-slate-200 dark:border-gray-600 pl-3">
              {r.summaryLine}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
        <div className={riskDangerCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-rose-500">
            Max Drawdown
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            최대 손실 구간
          </h4>
          <p className="mt-3 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {mdd != null && Number.isFinite(Number(mdd)) ? `-${Number(mdd).toFixed(1)}%` : '—'}
          </p>
          <BulletList items={r.mddBullets} />
        </div>

        <div className={riskWarnCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500">
            Losing Streak
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            연속 손실
          </h4>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {r.maxLosingStreak != null ? `${r.maxLosingStreak}회` : '—'}
          </p>
          <BulletList items={r.streakBullets} />
        </div>

        <div className={riskCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Risky Market
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            위험한 장세
          </h4>
          <BulletList items={r.riskyMarketBullets} />
        </div>

        <div className={riskCard}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Stop Loss Profile
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            손절 특성
          </h4>
          <BulletList items={r.stopLossBullets} />
        </div>
      </div>

      {r.recovery?.sub && (
        <div className="mt-4">
          <div className={riskCard}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Recovery
            </p>
            <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              회복 속도
            </h4>
            {r.recovery.headline && (
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {r.recovery.headline}
              </p>
            )}
            <p className={cn('text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words [overflow-wrap:anywhere]', r.recovery.headline ? 'mt-2' : 'mt-3')}>
              {r.recovery.sub}
            </p>
          </div>
        </div>
      )}

      {showMeta && Number.isFinite(meta.sampleSize) && (
        <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
          엔진 거래 {meta.sampleSize}건 기준
          {meta.hasRegime ? ' · 장세(추세·변동성) 태그 반영' : ''}
          {meta.lossClusterMarketType ? ` · 손실 집중: ${meta.lossClusterMarketType}` : ''}
        </p>
      )}
    </section>
  )
}

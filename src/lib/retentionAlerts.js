/**
 * 전략 건강도 경고 (검증·시그널 공통)
 * @param {object} opts
 * @param {number} opts.mdd
 * @param {number} opts.totalTrades
 * @param {{ pnl: number }[]} opts.recentTrades — 시간순, 끝이 최근
 * @param {{ mddMin?: number, tradesMin?: number, lossStreak?: number }} [thresholds]
 */
export function buildRetentionRiskAlerts(
  { mdd, totalTrades, recentTrades = [] },
  thresholds = {},
) {
  const mddMin = thresholds.mddMin ?? 12
  const tradesMin = thresholds.tradesMin ?? 8
  const lossStreak = thresholds.lossStreak ?? 3

  const alerts = []

  if (Number.isFinite(mdd) && mdd >= mddMin) {
    alerts.push({ key: 'mdd', level: 'warning', text: 'MDD가 높습니다' })
  }
  if (Number.isFinite(totalTrades) && totalTrades < tradesMin) {
    alerts.push({ key: 'trades', level: 'warning', text: '거래 수가 부족합니다' })
  }

  const tail = recentTrades.slice(-lossStreak)
  if (
    tail.length >= lossStreak
    && tail.every((t) => Number(t?.pnl) < 0)
  ) {
    alerts.push({ key: 'streak', level: 'danger', text: '연속 손실이 감지되었습니다' })
  }

  return alerts
}

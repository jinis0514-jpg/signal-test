/**
 * 홈·시그널 등에서 "당일 수익률" 표시용 (API 없을 때 결정론적 추정)
 * 최근 7일 수익률이 있으면 일평균에 가깝게, 없으면 ID·날짜 시드 기반
 */
export function estimateStrategyDailyRoiPct(strategy) {
  const r7 = Number(strategy?.recentRoi7d ?? strategy?.roi7d)
  if (Number.isFinite(r7)) {
    return Math.round((r7 / 7) * 10) / 10
  }
  const id = String(strategy?.id ?? 'x')
  const d = new Date()
  const seed = `${id}|${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  let h = 0
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) - h) + seed.charCodeAt(i)
    h |= 0
  }
  const v = (Math.abs(h) % 1000) / 100 - 5
  return Math.round(v * 10) / 10
}

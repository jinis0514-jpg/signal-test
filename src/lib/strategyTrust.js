export const TRUST_LEVEL = {
  NORMAL: '정상',
  CAUTION: '주의',
  DANGER: '위험',
}

export function buildTrustWarnings({ performance = {}, backtestMeta = {} } = {}) {
  const warnings = []
  const trades = Number(performance.totalTrades ?? performance.tradeCount ?? performance.trades ?? 0)
  const mdd = Number(performance.mdd ?? performance.maxDrawdown ?? 0)
  const roi = Number(performance.roi ?? performance.totalReturnPct ?? 0)
  const periodDays = Number(backtestMeta.periodDays ?? 0)
  const candleCount = Number(backtestMeta.candleCount ?? 0)

  if (Number.isFinite(trades) && trades < 10) {
    warnings.push('거래 수가 적어 신뢰도가 낮을 수 있습니다.')
  }
  if (Number.isFinite(periodDays) && periodDays > 0 && periodDays < 30) {
    warnings.push('테스트 기간이 짧아 과최적화 가능성이 높습니다.')
  }
  if (Number.isFinite(roi) && Math.abs(roi) >= 400) {
    warnings.push('수익률이 비정상적으로 커 보입니다. 과최적화/데이터 오류 가능성이 있습니다.')
  }
  if (Number.isFinite(mdd) && mdd >= 35) {
    warnings.push('낙폭(MDD)이 커서 실전 변동성이 클 수 있습니다.')
  }
  if (Number.isFinite(candleCount) && candleCount > 0 && candleCount < 80) {
    warnings.push('사용 데이터 범위(봉 수)가 적어 결과가 불안정할 수 있습니다.')
  }

  return warnings
}

export function computeStrategyStatus({ performance = {}, backtestMeta = {} } = {}) {
  const trades = Number(performance.totalTrades ?? performance.tradeCount ?? 0)
  const mdd = Number(performance.mdd ?? performance.maxDrawdown ?? 0)
  const periodDays = Number(backtestMeta.periodDays ?? 0)

  // 단순 기준(추후: 최근 ROI/승률 변화까지 확장)
  if ((Number.isFinite(mdd) && mdd >= 60) || (Number.isFinite(trades) && trades < 5)) {
    return TRUST_LEVEL.DANGER
  }
  if ((Number.isFinite(mdd) && mdd >= 35) || (Number.isFinite(trades) && trades < 10) || (Number.isFinite(periodDays) && periodDays > 0 && periodDays < 30)) {
    return TRUST_LEVEL.CAUTION
  }
  return TRUST_LEVEL.NORMAL
}


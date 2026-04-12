/**
 * 전략 자동 평가 한 줄 요약
 * — 최근 성과(7일 우선) + BTC 시장 상태 + 변동성(24h·캔들 레인지)
 */

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : NaN
}

function pickPerfPhrase(r7, totalRet, winRate) {
  if (Number.isFinite(r7)) {
    if (r7 >= 5) return '좋은 성과'
    if (r7 >= 1) return '양호한 성과'
    if (r7 >= -2) return '보통 수준의 성과'
    return '부진한 성과'
  }
  const ret = n(totalRet)
  const win = n(winRate)
  if (Number.isFinite(ret) && Number.isFinite(win)) {
    if (ret >= 15 && win >= 55) return '좋은 성과'
    if (ret >= 5) return '양호한 성과'
    if (ret >= -5) return '보통 수준의 성과'
    return '부진한 성과'
  }
  if (Number.isFinite(ret)) {
    if (ret >= 12) return '양호한 성과'
    if (ret >= -5) return '보통 수준의 성과'
    return '부진한 성과'
  }
  return null
}

function regimeFromBtc(changePct) {
  const ch = n(changePct)
  if (!Number.isFinite(ch)) return null
  if (ch >= 1.2) return '상승장'
  if (ch <= -1.2) return '하락장'
  if (ch >= 0.35) return '완만한 상승 흐름'
  if (ch <= -0.35) return '완만한 하락 흐름'
  return '횡보'
}

/** @param {number|null|undefined} avgRangePct — buildMarketBrief와 동일 기준 */
function volBucketFromRange(avgRangePct) {
  const ar = n(avgRangePct)
  if (!Number.isFinite(ar)) return null
  if (ar >= 2.2) return 'high'
  if (ar >= 1.0) return 'mid'
  return 'low'
}

/** BTC 24h 변동률 절댓값 — 홈 getBtcVolatilityToday와 동일 구간 */
function volBucketFromAbsChange(absCh) {
  const c = n(absCh)
  if (!Number.isFinite(c)) return null
  if (c >= 2.5) return 'high'
  if (c >= 1) return 'mid'
  return 'low'
}

function volSentence(bucket) {
  if (bucket === 'high') return ' 단기 변동성은 높은 편이라 체결·슬리피지에 유의하세요.'
  if (bucket === 'low') return ' 단기 변동성은 낮아 추세 신호가 드물 수 있습니다.'
  if (bucket === 'mid') return ' 단기 변동성은 보통 수준입니다.'
  return ''
}

/**
 * @param {{ recentRoi7d?: number|null, totalReturnPct?: number|null, winRate?: number|null }} strategyLike
 * @param {{ btcChangePercent?: number|null, avgRangePct?: number|null }} ctx
 */
export function buildStrategyAutoEvaluation(strategyLike = {}, ctx = {}) {
  const r7 = n(strategyLike.recentRoi7d)
  const hasR7 = Number.isFinite(r7)
  const perf = hasR7
    ? pickPerfPhrase(r7, null, null)
    : pickPerfPhrase(NaN, strategyLike.totalReturnPct, strategyLike.winRate)

  const regime = regimeFromBtc(ctx.btcChangePercent)
  const absBtc = Math.abs(n(ctx.btcChangePercent))
  let volB = volBucketFromRange(ctx.avgRangePct)
  if (volB == null) volB = volBucketFromAbsChange(absBtc)
  const vol = volSentence(volB)

  if (perf == null) {
    if (regime != null) {
      return `BTC 기준 최근 시장은 ${regime}에 가깝습니다.${vol}`
    }
    return `누적·최근 성과는 아래 요약 지표에서 확인할 수 있습니다.${vol}`
  }

  if (regime != null) {
    return `이 전략은 최근 ${regime}에서 ${perf}를 보였습니다.${vol}`
  }
  return `이 전략은 최근 성과 기준으로 ${perf}를 보였습니다.${vol}`
}

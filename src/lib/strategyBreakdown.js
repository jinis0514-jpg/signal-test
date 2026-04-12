/**
 * 전략 해부 카드용 문구 — 엔진 거래·성과 기반 (과장 없음)
 * 카드당 최대 3줄, 키포인트형
 */

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function clampStr(s, max = 22) {
  const t = String(s ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * @param {object} input
 * @param {Array<object>} input.trades — { pnl, win, dir?, exitReason?, entryNote?, trend?, vol? }
 * @param {object} [input.performance] — { winRate, mdd, trades, roi }
 * @param {Array<{key:string,n:number,winRate:number,avg:number}>} [input.comboRows]
 * @param {string} [input.assetHint] — 'BTC' | 'ALT' 등
 */
export function buildStrategyBreakdown({
  trades = [],
  performance = {},
  comboRows = null,
  assetHint = '',
}) {
  const list = Array.isArray(trades) ? trades : []
  const nTr = list.length
  const wr = safeNum(performance.winRate ?? performance.win_rate, NaN)
  const mdd = safeNum(performance.mdd ?? performance.maxDrawdown, NaN)
  const roi = safeNum(performance.roi ?? performance.totalReturnPct, NaN)

  const wins = list.filter((t) => safeNum(t.pnl) > 0)
  const losses = list.filter((t) => safeNum(t.pnl) < 0)

  const longTr = list.filter((t) => String(t.dir).toUpperCase() === 'LONG')
  const shortTr = list.filter((t) => String(t.dir).toUpperCase() === 'SHORT')
  const longWin = longTr.filter((t) => safeNum(t.pnl) > 0).length
  const shortWin = shortTr.filter((t) => safeNum(t.pnl) > 0).length
  const longRate = longTr.length ? longWin / longTr.length : null
  const shortRate = shortTr.length ? shortWin / shortTr.length : null

  const lossReasons = losses.map((t) => String(t.exitReason ?? ''))
  const stopLossN = lossReasons.filter((r) => r === 'stop').length
  const stopShare = losses.length ? stopLossN / losses.length : 0

  const hasTrend = list.some((t) => t.trend && t.trend !== '—')
  const byTrend = { 상승장: [], 하락장: [], 횡보장: [] }
  if (hasTrend) {
    for (const t of list) {
      const tr = String(t.trend ?? '')
      if (tr === '상승장') byTrend.상승장.push(t)
      else if (tr === '하락장') byTrend.하락장.push(t)
      else if (tr === '횡보장') byTrend.횡보장.push(t)
    }
  }

  const pnlSum = (arr) => arr.reduce((s, t) => s + safeNum(t.pnl), 0)
  const winN = (arr) => arr.filter((t) => safeNum(t.pnl) > 0).length

  const strongMarket = []
  if (hasTrend && byTrend.상승장.length >= 3) {
    const wrUp = winN(byTrend.상승장) / byTrend.상승장.length
    if (wrUp >= 0.5) {
      strongMarket.push(clampStr(`상승장 진입 구간에서 승률 ${(wrUp * 100).toFixed(0)}% 수준`))
    }
  }
  if (hasTrend && byTrend.횡보장.length >= 3) {
    const avgP = pnlSum(byTrend.횡보장) / byTrend.횡보장.length
    const avgUp = byTrend.상승장.length ? pnlSum(byTrend.상승장) / byTrend.상승장.length : null
    if (avgUp != null && avgUp > avgP + 0.05) {
      strongMarket.push(clampStr('상승 추세 구간 평균 손익이 횡보보다 높게 관측됨'))
    }
  }
  const hiVolWins = list.filter((t) => t.vol === '고변동성' && safeNum(t.pnl) > 0).length
  const hiVolN = list.filter((t) => t.vol === '고변동성').length
  if (hiVolN >= 4 && hiVolWins / hiVolN >= 0.45) {
    strongMarket.push(clampStr('변동성 큰 구간에서도 승리 비중이 유지되는 편'))
  }
  if (longRate != null && shortRate != null && longTr.length >= 3 && shortTr.length >= 3) {
    if (longRate > shortRate + 0.08) strongMarket.push(clampStr('LONG 쪽 진입 결과가 SHORT보다 양호한 편'))
    else if (shortRate > longRate + 0.08) strongMarket.push(clampStr('SHORT 쪽 진입 결과가 LONG보다 양호한 편'))
  }
  if (Number.isFinite(wr) && wr >= 52 && strongMarket.length < 3) {
    strongMarket.push(clampStr(`전체 승률 ${wr.toFixed(0)}%로 방향성 구간에서 유리한 편`))
  }
  const strongFallbacks = [
    '추세·변동성이 드러나는 구간에서 점검 가치가 있습니다',
    '눌림 후 재진입 구간에서 성과를 확인해 보세요',
  ]
  for (const f of strongFallbacks) {
    if (strongMarket.length >= 3) break
    strongMarket.push(clampStr(f))
  }

  const weakMarket = []
  if (hasTrend && byTrend.횡보장.length >= 3) {
    const wrR = winN(byTrend.횡보장) / byTrend.횡보장.length
    const lossShareR = losses.filter((t) => t.trend === '횡보장').length / Math.max(1, losses.length)
    if (wrR < 0.42 || lossShareR >= 0.45) {
      weakMarket.push(clampStr('횡보·박스권 구간에서 성과가 약해질 수 있습니다'))
    }
  }
  if (stopShare >= 0.35 && losses.length >= 4) {
    weakMarket.push(clampStr('손절 조건이 자주 걸리는 구간이 관측됩니다'))
  }
  if (Number.isFinite(wr) && wr < 48 && weakMarket.length < 3) {
    weakMarket.push(clampStr(`승률 ${wr.toFixed(0)}%로 횡보·반전에 취약할 수 있습니다`))
  }
  if (Number.isFinite(mdd) && mdd >= 18 && weakMarket.length < 3) {
    weakMarket.push(clampStr(`MDD ${mdd.toFixed(0)}% 수준으로 급변 시 부담이 클 수 있음`))
  }
  const weakFallbacks = [
    '가짜 돌파가 반복되면 성과가 흔들릴 수 있습니다',
    '방향성이 자주 바뀌는 장세에서는 보수적으로 보는 편이 낫습니다',
  ]
  for (const f of weakFallbacks) {
    if (weakMarket.length >= 3) break
    weakMarket.push(clampStr(f))
  }

  const winning = []
  const combos = Array.isArray(comboRows) ? comboRows.filter((r) => r.n >= 2) : []
  if (combos.length) {
    const best = [...combos].sort((a, b) => safeNum(b.avg) - safeNum(a.avg))[0]
    winning.push(clampStr(`「${String(best.key).slice(0, 14)}」근거에서 평균 ${safeNum(best.avg).toFixed(2)}%`))
  }
  const tpWins = wins.filter((t) => String(t.exitReason) === 'tp').length
  if (wins.length >= 4 && tpWins / wins.length >= 0.35) {
    winning.push(clampStr('익절 조건으로 마감된 거래 비중이 큼'))
  }
  if (longRate != null && longRate >= 0.55 && longTr.length >= 4) {
    winning.push(clampStr('LONG 방향에서 승리 비중이 높게 나타남'))
  } else if (shortRate != null && shortRate >= 0.55 && shortTr.length >= 4) {
    winning.push(clampStr('SHORT 방향에서 승리 비중이 높게 나타남'))
  }
  const winFallbacks = ['추세 방향과 맞는 진입에서 성과가 상대적으로 좋은 편']
  for (const f of winFallbacks) {
    if (winning.length >= 3) break
    winning.push(clampStr(f))
  }

  const failing = []
  if (combos.length >= 2) {
    const worst = [...combos].sort((a, b) => safeNum(a.avg) - safeNum(b.avg))[0]
    if (safeNum(worst.avg) < 0) {
      failing.push(clampStr(`「${String(worst.key).slice(0, 14)}」근거에서 평균 손실이 큼`))
    }
  }
  if (hasTrend && byTrend.횡보장.length) {
    const lossInR = losses.filter((t) => t.trend === '횡보장').length
    if (losses.length >= 4 && lossInR / losses.length >= 0.4) {
      failing.push(clampStr('손실이 횡보 구간 진입에 몰리는 경향'))
    }
  }
  if (stopShare >= 0.25 && losses.length >= 3) {
    failing.push(clampStr('손절·변동성 청산이 손실의 상당 부분을 차지'))
  }
  const failFallbacks = [
    '거래량 부족한 돌파 추격은 손실로 이어질 수 있음',
    '급격한 반전이 잦은 구간에서는 손실이 커질 수 있습니다',
  ]
  for (const f of failFallbacks) {
    if (failing.length >= 3) break
    failing.push(clampStr(f))
  }

  const bestFor = []
  if (Number.isFinite(wr) && wr >= 52) {
    bestFor.push(clampStr('방향성·추세를 따르는 스타일에 맞는 편'))
  } else {
    bestFor.push(clampStr('짧은 손절을 감수할 수 있는 사용자'))
  }
  if (Number.isFinite(mdd) && mdd <= 15) {
    bestFor.push(clampStr('낙폭 제한이 비교적 명확한 편'))
  } else {
    bestFor.push(clampStr('변동성 구간을 감내할 수 있는 사용자'))
  }
  if (String(assetHint).toUpperCase() === 'ALT') {
    bestFor.push(clampStr('알트 다종·분산에 익숙한 사용자'))
  } else {
    bestFor.push(clampStr('횡보보다 추세 장세를 선호하는 사용자'))
  }

  return {
    strongMarket: strongMarket.slice(0, 3),
    weakMarket: weakMarket.slice(0, 3),
    winningPattern: winning.slice(0, 3),
    failurePattern: failing.slice(0, 3),
    bestFor: bestFor.slice(0, 3),
    meta: { sampleSize: nTr, hasRegime: hasTrend },
  }
}

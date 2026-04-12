/**
 * 리스크 해부 카드용 — 거래·성과 기반, 과장 없음
 * 카드당 최대 3줄(본문), 키포인트형
 */

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function clampStr(s, max = 24) {
  const t = String(s ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function fmtShortDate(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return null
  try {
    const d = new Date(n)
    return `${d.getMonth() + 1}/${d.getDate()}`
  } catch {
    return null
  }
}

export function maxConsecutiveLosses(trades) {
  if (!Array.isArray(trades)) return 0
  let cur = 0
  let best = 0
  for (const t of trades) {
    const pnl = Number(t.pnl)
    if (!Number.isFinite(pnl)) continue
    if (pnl < 0) {
      cur += 1
      best = Math.max(best, cur)
    } else {
      cur = 0
    }
  }
  return best
}

/** 복리 에퀴티 곡선 기준 최대 낙폭·회복(거래 청산 시각) */
function analyzeDrawdownRecovery(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      mddCompound: null,
      troughIdx: -1,
      refPeakEq: 100,
      recoveryDays: null,
      recovered: false,
      worstRangeLabel: null,
      troughTime: null,
    }
  }
  const points = []
  let eq = 100
  for (const t of trades) {
    eq *= 1 + safeNum(t.pnl) / 100
    points.push({
      eq,
      t: Number(t.exitTime),
      pnl: safeNum(t.pnl),
    })
  }

  let peakEq = 100
  let maxDd = 0
  let troughIdx = -1
  let refPeakEq = 100

  for (let i = 0; i < points.length; i += 1) {
    if (points[i].eq > peakEq) peakEq = points[i].eq
    const dd = peakEq > 0 ? ((peakEq - points[i].eq) / peakEq) * 100 : 0
    if (dd > maxDd) {
      maxDd = dd
      troughIdx = i
      refPeakEq = peakEq
    }
  }

  let recovered = false
  let recoveryDays = null
  if (troughIdx >= 0 && troughIdx < points.length - 1) {
    for (let j = troughIdx + 1; j < points.length; j += 1) {
      if (points[j].eq >= refPeakEq - 1e-6) {
        recovered = true
        const dt = points[j].t - points[troughIdx].t
        if (Number.isFinite(dt) && dt >= 0) {
          recoveryDays = Math.max(1, Math.round(dt / 86400000))
        }
        break
      }
    }
  }

  let worstRangeLabel = null
  if (troughIdx >= 0) {
    let startIdx = 0
    for (let k = troughIdx; k >= 0; k -= 1) {
      if (points[k].eq >= refPeakEq - 0.02) {
        startIdx = k
        break
      }
    }
    const a = fmtShortDate(points[startIdx]?.t)
    const b = fmtShortDate(points[troughIdx]?.t)
    if (a && b) worstRangeLabel = `${a}~${b}`
    else if (b) worstRangeLabel = `${b} 인근`
  }

  return {
    mddCompound: Number.isFinite(maxDd) ? +maxDd.toFixed(2) : null,
    troughIdx,
    refPeakEq,
    recoveryDays,
    recovered,
    worstRangeLabel,
    troughTime: troughIdx >= 0 ? points[troughIdx]?.t : null,
  }
}

/**
 * @param {object} input
 * @param {Array<object>} input.trades — 엔진 거래( pnl, exitReason, exitTime )
 * @param {Array<object>|null} [input.tradeRows] — trend·vol 포함 시 장세 분석
 * @param {object} [input.performance] — mdd, winRate, totalTrades
 */
export function buildStrategyRiskBreakdown({
  trades = [],
  tradeRows = null,
  performance = {},
}) {
  const list = Array.isArray(trades) ? trades : []
  const rows = Array.isArray(tradeRows) && tradeRows.length ? tradeRows : null

  const mddPerf = safeNum(performance.mdd ?? performance.maxDrawdown, NaN)
  const winRate = safeNum(performance.winRate ?? performance.win_rate, NaN)
  const nTr = list.length

  const ddInfo = analyzeDrawdownRecovery(list)
  const mddDisplay = Number.isFinite(mddPerf) ? mddPerf : (ddInfo.mddCompound ?? NaN)

  const losses = list.filter((t) => safeNum(t.pnl) < 0)
  const wins = list.filter((t) => safeNum(t.pnl) > 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + safeNum(t.pnl), 0) / wins.length : null
  const avgLoss = losses.length ? losses.reduce((s, t) => s + safeNum(t.pnl), 0) / losses.length : null

  const streak = maxConsecutiveLosses(list)
  const stopInLosses = losses.filter((t) => String(t.exitReason) === 'stop').length
  const stopShare = losses.length ? stopInLosses / losses.length : 0

  const hasTrend = rows?.some((t) => t.trend && t.trend !== '—')
  let lossInSideways = 0
  let lossInHighVol = 0
  if (rows && losses.length) {
    const lossRows = rows.filter((t) => safeNum(t.pnl) < 0)
    lossInSideways = lossRows.filter((t) => t.trend === '횡보장').length
    lossInHighVol = lossRows.filter((t) => t.vol === '고변동성').length
  }
  const sidewaysShare = losses.length ? lossInSideways / losses.length : 0
  const highVolLossShare = losses.length ? lossInHighVol / losses.length : 0

  /** [1] 최대 손실 구간 */
  const mddBullets = []
  if (Number.isFinite(mddDisplay) && mddDisplay > 0) {
    mddBullets.push(clampStr(`최대 낙폭은 -${mddDisplay.toFixed(1)}% 수준으로 관측됩니다`))
  } else {
    mddBullets.push(clampStr('표본에서 유의미한 낙폭은 작게 관측됩니다'))
  }
  if (ddInfo.worstRangeLabel) {
    mddBullets.push(clampStr(`낙폭이 컸던 구간: ${ddInfo.worstRangeLabel}`))
  } else if (ddInfo.troughTime) {
    const ft = fmtShortDate(ddInfo.troughTime)
    if (ft) mddBullets.push(clampStr(`가장 깊었던 시점: ${ft} 청산 인근`))
  }
  if (ddInfo.recovered && ddInfo.recoveryDays != null) {
    mddBullets.push(clampStr(`회복까지 약 ${ddInfo.recoveryDays}일로 추정됩니다`))
  } else if (nTr >= 4 && Number.isFinite(mddDisplay) && mddDisplay > 3) {
    mddBullets.push(clampStr('표본 끝까지 완전 회복 여부는 추가 확인이 필요합니다'))
  }
  while (mddBullets.length > 3) mddBullets.pop()
  const mddFallbacks = ['급격한 반전 구간에서 낙폭이 커질 수 있습니다']
  for (const f of mddFallbacks) {
    if (mddBullets.length >= 2) break
    mddBullets.push(clampStr(f))
  }
  while (mddBullets.length > 3) mddBullets.pop()

  /** [2] 연속 손실 */
  const streakBullets = []
  if (streak > 0) {
    streakBullets.push(clampStr(`최대 ${streak}회 연속 손실이 발생했습니다`))
  } else {
    streakBullets.push(clampStr('연속 손실은 짧게 끊기는 편입니다'))
  }
  if (hasTrend && sidewaysShare >= 0.38 && losses.length >= 3) {
    streakBullets.push(clampStr('횡보 구간에서 손실이 이어지는 경향이 있습니다'))
  } else if (streak >= 3 && stopShare >= 0.3) {
    streakBullets.push(clampStr('짧은 손절이 연속될 수 있습니다'))
  } else if (streak >= 3) {
    streakBullets.push(clampStr('손실이 한쪽으로 몰릴 수 있어 분할·보수가 필요합니다'))
  }
  if (streakBullets.length < 3 && avgLoss != null && Math.abs(avgLoss) < 2.5) {
    streakBullets.push(clampStr('손실 평균 폭은 비교적 작은 편입니다'))
  }
  const streakFallbacks = ['횡보·반전 구간에서는 손실이 이어질 수 있습니다']
  for (const f of streakFallbacks) {
    if (streakBullets.length >= 3) break
    streakBullets.push(clampStr(f))
  }
  while (streakBullets.length > 3) streakBullets.pop()

  /** [3] 위험한 장세 */
  const riskyBullets = []
  if (hasTrend && sidewaysShare >= 0.35 && losses.length >= 3) {
    riskyBullets.push(clampStr('방향성 없는 횡보·박스권에서 불리할 수 있습니다'))
  }
  if (hasTrend && highVolLossShare >= 0.35 && losses.length >= 3) {
    riskyBullets.push(clampStr('고변동성 구간에서 손실 비중이 큽니다'))
  }
  const riskyFallbacks = [
    '가짜 돌파·재진입 실패가 잦은 구간은 피하는 편이 낫습니다',
    '뉴스성 급반전이 잦은 장세에서는 손실이 커질 수 있습니다',
  ]
  for (const f of riskyFallbacks) {
    if (riskyBullets.length >= 3) break
    riskyBullets.push(clampStr(f))
  }
  while (riskyBullets.length > 3) riskyBullets.pop()

  /** [4] 손절 특성 */
  const stopBullets = []
  if (losses.length >= 3 && stopShare >= 0.28) {
    stopBullets.push(clampStr(`손절 청산이 손실의 ${(stopShare * 100).toFixed(0)}% 내외를 차지합니다`))
  } else if (losses.length >= 3) {
    stopBullets.push(clampStr('손절 외 청산(목표·시간 등) 비중도 함께 확인하세요'))
  } else {
    stopBullets.push(clampStr('손절 표본이 적어 패턴은 참고 수준입니다'))
  }
  if (avgWin != null && avgLoss != null && avgWin > 0 && avgLoss < 0) {
    const aw = Math.abs(avgWin)
    const al = Math.abs(avgLoss)
    if (aw >= al * 1.15) {
      stopBullets.push(clampStr('평균 수익이 평균 손실보다 큰 편입니다'))
    } else if (al > aw * 1.1) {
      stopBullets.push(clampStr('평균 손실 폭이 수익보다 클 수 있습니다'))
    } else {
      stopBullets.push(clampStr('손익 평균 폭은 비슷한 편입니다'))
    }
  }
  if (stopBullets.length < 3 && stopShare >= 0.2 && losses.length >= 4) {
    stopBullets.push(clampStr('추격 진입 시 손절 빈도가 높아질 수 있습니다'))
  }
  const stopFallbacks = [
    '체결·슬리피지에 따라 실제 손실은 더 커질 수 있습니다',
  ]
  for (const f of stopFallbacks) {
    if (stopBullets.length >= 3) break
    stopBullets.push(clampStr(f))
  }
  while (stopBullets.length > 3) stopBullets.pop()

  /** [5] 회복 속도 (선택) */
  let recovery = null
  if (ddInfo.recovered && ddInfo.recoveryDays != null) {
    recovery = {
      days: ddInfo.recoveryDays,
      headline: `${ddInfo.recoveryDays}일`,
      sub: '최대 낙폭 이후 이전 고점 회복까지 걸린 추정 일수입니다.',
    }
  } else if (nTr >= 5 && !ddInfo.recovered && Number.isFinite(mddDisplay) && mddDisplay > 5) {
    recovery = {
      days: null,
      headline: null,
      sub: '표본 구간 안에서는 완전 회복 시점이 명확하지 않습니다.',
    }
  }

  /** 한 줄 요약 */
  const parts = []
  if (Number.isFinite(mddDisplay)) {
    if (mddDisplay >= 20) parts.push('낙폭 부담이 큰 편으로 보수적 접근이 필요할 수 있습니다')
    else if (mddDisplay >= 12) parts.push('리스크는 중간 수준이며 낙폭 구간은 존재합니다')
    else parts.push('낙폭은 상대적으로 제한적인 편으로 관측됩니다')
  }
  if (streak >= 4) parts.push('연속 손실 구간은 존재합니다')
  if (hasTrend && sidewaysShare >= 0.4) parts.push('횡보장에서 손실이 늘어날 수 있습니다')
  if (stopShare >= 0.35 && losses.length >= 4) parts.push('손절이 반복되면 자금 관리가 중요합니다')
  if (Number.isFinite(winRate) && winRate < 48 && nTr >= 10) {
    parts.push('전체 승률이 낮은 편으로 손실 구간이 길어질 수 있습니다')
  }
  let summaryLine = parts.slice(0, 2).join(' · ')
  if (!summaryLine) {
    summaryLine = '손실은 발생할 수 있으며 표본·시장에 따라 달라질 수 있습니다'
  }
  summaryLine = clampStr(summaryLine, 72)

  const lossClusterMarketType = hasTrend && sidewaysShare >= 0.4 ? '횡보' : hasTrend && highVolLossShare >= 0.35 ? '고변동성' : null

  return {
    mddPct: Number.isFinite(mddDisplay) ? +mddDisplay.toFixed(2) : null,
    mddBullets,
    maxLosingStreak: streak,
    streakBullets,
    riskyMarketBullets: riskyBullets,
    stopLossBullets: stopBullets,
    recovery,
    summaryLine,
    meta: {
      sampleSize: nTr,
      hasRegime: !!hasTrend,
      lossClusterMarketType,
      avgWinPct: avgWin != null ? +avgWin.toFixed(2) : null,
      avgLossPct: avgLoss != null ? +avgLoss.toFixed(2) : null,
      stopShare: losses.length ? +stopShare.toFixed(2) : null,
    },
  }
}

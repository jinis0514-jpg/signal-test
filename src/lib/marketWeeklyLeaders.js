/**
 * 마켓 목록에서 주간·승률·안정성 1위 추출 (roi7d 우선, 없으면 휴리스틱)
 */

function weekRoiScore(s) {
  const w = Number(s?.roi7d)
  if (Number.isFinite(w)) return w
  const r = Number(s?.totalReturnPct ?? s?.roi ?? 0)
  return Number.isFinite(r) ? r * 0.12 : 0
}

function isSignalish(s) {
  return String(s?.type ?? 'signal') !== 'method'
}

/**
 * @param {object[]} strategies — normalizeMarketStrategy 결과
 */
export function pickMarketWeeklyLeaders(strategies) {
  const list = (strategies ?? []).filter(isSignalish)
  if (!list.length) {
    return { weekRoi: null, winRate: null, lowMdd: null, weekRoiLabel: '이번주 수익률 1위' }
  }

  const byWeek = [...list].sort((a, b) => weekRoiScore(b) - weekRoiScore(a))[0]
  const byWin = [...list].sort((a, b) => Number(b.winRate ?? 0) - Number(a.winRate ?? 0))[0]
  const byMdd = [...list].sort((a, b) => {
    const ma = Number(a.maxDrawdown ?? Math.abs(a.mdd ?? 999))
    const mb = Number(b.maxDrawdown ?? Math.abs(b.mdd ?? 999))
    return ma - mb
  })[0]

  return {
    weekRoi: byWeek,
    winRate: byWin,
    lowMdd: byMdd,
    weekRoiLabel: '이번주 수익률 1위',
  }
}

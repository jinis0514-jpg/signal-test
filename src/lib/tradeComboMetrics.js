/**
 * 진입 근거(entryNote)별 집계 — 전략 해부·검증 테이블 공통
 */
export function groupByEntryCombo(trades) {
  const map = new Map()
  for (const t of trades) {
    const key = String(t.entryNote || '근거 미기록').trim() || '근거 미기록'
    const prev = map.get(key) ?? { key, n: 0, wins: 0, sum: 0, sumLoss: 0, lossN: 0 }
    const pnl = Number(t.pnl)
    prev.n += 1
    if (Number.isFinite(pnl)) {
      prev.sum += pnl
      if (pnl >= 0) prev.wins += 1
      else { prev.sumLoss += pnl; prev.lossN += 1 }
    }
    map.set(key, prev)
  }
  const rows = [...map.values()].map((r) => ({
    key: r.key,
    n: r.n,
    winRate: r.n ? +(r.wins / r.n * 100).toFixed(1) : 0,
    avg: r.n ? +(r.sum / r.n).toFixed(2) : 0,
    avgLoss: r.lossN ? +(r.sumLoss / r.lossN).toFixed(2) : 0,
  }))
  rows.sort((a, b) => (b.n - a.n) || (b.avg - a.avg))
  return rows
}

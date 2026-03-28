/**
 * strategyEngine.js
 * - 단순 이동평균 기반 엔진 (초기 버전)
 * - prices → signals → trades → performance/open position 계산
 *
 * 엔진 규칙:
 * - currentPrice > MA(lookback)  → LONG 진입
 * - currentPrice < MA(lookback)  → SHORT 진입
 * - 같은 방향 재진입 금지
 * - 반대 조건이면 EXIT 후 필요 시 반대 방향 ENTRY
 */

function safeNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function uid(prefix, time, i) {
  return `${prefix}_${String(time)}_${String(i)}`
}

/**
 * prices(숫자 배열 또는 {time,price} 배열) → {time, price} 배열로 통일
 * @param {Array<number>|Array<{time:number, price:number}>} prices
 * @returns {{time:number, price:number}[]}
 */
export function normalizePrices(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return []
  const first = prices[0]

  if (typeof first === 'object' && first !== null && 'price' in first) {
    return prices
      .map((p, i) => ({ time: safeNum(p.time, i), price: safeNum(p.price, 0) }))
      .filter((pt) => Number.isFinite(pt.price))
  }

  return prices
    .map((p, i) => ({ time: i, price: safeNum(p, 0) }))
    .filter((pt) => Number.isFinite(pt.price))
}

function movingAverage(series, endIdx, lookback) {
  const lb = Math.max(1, Math.floor(safeNum(lookback, 5)))
  const start = Math.max(0, endIdx - lb)
  const n = endIdx - start
  if (n <= 0) return null
  let sum = 0
  for (let i = start; i < endIdx; i++) sum += safeNum(series[i]?.price, 0)
  return sum / n
}

/**
 * @param {Array<number>|Array<{time:number, price:number}>} prices
 * @param {{lookback?:number, mode?:string}} strategyConfig
 * @returns {Array<{id:string, type:'ENTRY'|'EXIT', direction:'LONG'|'SHORT', price:number, time:number, note:string, open?:boolean}>}
 */
export function generateSignalsFromPrices(prices, strategyConfig) {
  const series = normalizePrices(prices)
  const lookback = Math.max(2, Math.floor(strategyConfig?.lookback ?? 5))

  if (series.length < lookback + 1) return []

  /** @type {null | {type:'LONG'|'SHORT', entryPrice:number, entryTime:number}} */
  let position = null
  const signals = []

  for (let i = lookback; i < series.length; i++) {
    const cur = series[i]
    const ma = movingAverage(series, i, lookback)
    if (ma === null) continue

    const wantsLong  = cur.price > ma
    const wantsShort = cur.price < ma
    const desiredDir = wantsLong ? 'LONG' : wantsShort ? 'SHORT' : null
    if (!desiredDir) continue

    if (!position) {
      position = { type: desiredDir, entryPrice: cur.price, entryTime: cur.time }
      signals.push({
        id: uid('entry', cur.time, i),
        type: 'ENTRY',
        direction: desiredDir,
        price: cur.price,
        time: cur.time,
        note: desiredDir === 'LONG' ? 'MA 상향 돌파' : 'MA 하향 이탈',
        open: true,
      })
      continue
    }

    /* 같은 방향 재진입 금지 */
    if (position.type === desiredDir) continue

    /* 반대 방향이면 EXIT 후 반대 ENTRY */
    signals.push({
      id: uid('exit', cur.time, i),
      type: 'EXIT',
      direction: position.type,
      price: cur.price,
      time: cur.time,
      note: '반대 조건 발생',
      open: false,
    })

    position = { type: desiredDir, entryPrice: cur.price, entryTime: cur.time }
    signals.push({
      id: uid('entry', cur.time, i + 1),
      type: 'ENTRY',
      direction: desiredDir,
      price: cur.price,
      time: cur.time,
      note: desiredDir === 'LONG' ? '반대 전환 진입' : '반대 전환 진입',
      open: true,
    })
  }

  /* open 플래그 정리: 마지막 ENTRY만 open=true */
  let lastEntryIdx = -1
  for (let i = 0; i < signals.length; i++) {
    if (signals[i].type === 'ENTRY') lastEntryIdx = i
  }
  for (let i = 0; i < signals.length; i++) {
    if (signals[i].type === 'ENTRY') signals[i].open = i === lastEntryIdx
  }

  return signals
}

function pnlPct(dir, entry, exit) {
  const ep = safeNum(entry, 0)
  const xp = safeNum(exit, 0)
  if (ep <= 0) return 0
  return dir === 'SHORT'
    ? ((ep - xp) / ep) * 100
    : ((xp - ep) / ep) * 100
}

/**
 * ENTRY + EXIT를 묶어서 trade history 생성
 * @param {Array<{type:'ENTRY'|'EXIT', direction:'LONG'|'SHORT', price:number, time:number}>} signals
 * @returns {Array<{id:string, dir:'LONG'|'SHORT', entry:number, exit:number, entryTime:number, exitTime:number, pnl:number, win:boolean}>}
 */
export function calculateTradeHistory(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return []

  const sorted = [...signals].sort((a, b) => safeNum(a.time, 0) - safeNum(b.time, 0))
  const trades = []
  let open = null
  let id = 1

  for (const s of sorted) {
    if (s.type === 'ENTRY') {
      if (!open) {
        open = { dir: s.direction, entry: s.price, entryTime: s.time }
      }
      continue
    }
    if (s.type === 'EXIT') {
      if (!open) continue
      const pnl = pnlPct(open.dir, open.entry, s.price)
      trades.push({
        id: String(id++),
        dir: open.dir,
        entry: open.entry,
        exit: s.price,
        entryTime: open.entryTime,
        exitTime: s.time,
        pnl: +pnl.toFixed(2),
        win: pnl >= 0,
      })
      open = null
    }
  }

  return trades
}

/**
 * 마지막 오픈 포지션 계산
 * @param {Array<{type:'ENTRY'|'EXIT', direction:'LONG'|'SHORT', price:number, time:number}>} signals
 * @param {number} currentPrice
 * @returns {null | {type:'LONG'|'SHORT', entryPrice:number, currentPrice:number, pnlPct:number, entryTime:number}}
 */
export function calculateOpenPosition(signals, currentPrice) {
  if (!Array.isArray(signals) || signals.length === 0) return null
  const cp = safeNum(currentPrice, NaN)
  if (!Number.isFinite(cp)) return null

  const sorted = [...signals].sort((a, b) => safeNum(a.time, 0) - safeNum(b.time, 0))
  let open = null

  for (const s of sorted) {
    if (s.type === 'ENTRY') {
      open = { type: s.direction, entryPrice: s.price, entryTime: s.time }
    } else if (s.type === 'EXIT') {
      open = null
    }
  }

  if (!open) return null
  const pnl = pnlPct(open.type, open.entryPrice, cp)
  return {
    type: open.type,
    entryPrice: open.entryPrice,
    currentPrice: cp,
    pnlPct: +pnl.toFixed(2),
    entryTime: open.entryTime,
  }
}

/**
 * trade history 기반 성과 지표 계산
 * @param {Array<{pnl:number}>} trades
 * @returns {{roi:number, winRate:number, totalTrades:number, mdd:number}}
 */
export function calculatePerformance(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { roi: 0, winRate: 0, totalTrades: 0, mdd: 0 }
  }

  const totalTrades = trades.length
  const wins = trades.filter((t) => safeNum(t.pnl, 0) >= 0).length
  const winRate = (wins / totalTrades) * 100

  /* 누적 수익 곡선 (간단 복리) */
  let equity = 100
  let peak = 100
  let maxDd = 0

  for (const t of trades) {
    equity *= 1 + safeNum(t.pnl, 0) / 100
    if (equity > peak) peak = equity
    const dd = peak > 0 ? (peak - equity) / peak * 100 : 0
    if (dd > maxDd) maxDd = dd
  }

  const roi = (equity - 100)
  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(1),
    totalTrades,
    mdd: +maxDd.toFixed(2),
  }
}


/**
 * 에디터 조건 ID → 롱/숏 불리언 평가 + AND/OR 트리
 *
 * conditionLogic (선택):
 * - 생략 시 `conditions` 배열은 모두 AND (롱은 각 조건의 long이 모두 참일 때만).
 * - 예: { op: 'OR', children: [
 *     { op: 'AND', children: ['ema_cross', 'rsi_mid'] },
 *     'macd_cross',
 *   ]}
 * - leaf는 에디터 ENTRY_CONDITIONS id 문자열.
 */

import { sma, ema, rsi, macd, bollingerBands, obv } from './indicators'

function safeNum(v, fb = NaN) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/**
 * 캔들 배열(옵션)으로 지표 컨텍스트 사전 계산
 * @param {{ time:number, price:number }[]} series
 * @param {Array<{time?:number, open?:number, high?:number, low?:number, close?:number, volume?:number}>} [candles] — series와 동일 길이 권장
 */
export function buildIndicatorContext(series, candles = null) {
  const n = series.length
  const closes = series.map((p) => safeNum(p.price, 0))
  const highs = candles?.length === n
    ? candles.map((c, i) => safeNum(c.high ?? c.close ?? closes[i], closes[i]))
    : closes.slice()
  const lows = candles?.length === n
    ? candles.map((c, i) => safeNum(c.low ?? c.close ?? closes[i], closes[i]))
    : closes.slice()
  const volumes = candles?.length === n
    ? candles.map((c) => safeNum(c.volume, 0))
    : null
  const opens = candles?.length === n
    ? candles.map((c, i) => safeNum(c.open ?? closes[i], closes[i]))
    : null

  const ema20 = ema(closes, 20)
  const ema50 = ema(closes, 50)
  const ema5 = ema(closes, 5)
  const ema13 = ema(closes, 13)
  const rsi14 = rsi(closes, 14)
  const { macd: macdLine, signal: macdSig } = macd(closes, 12, 26, 9)
  const bb = bollingerBands(closes, 20, 2)
  const volSma20 = volumes ? sma(volumes, 20) : null
  const obvLine = volumes ? obv(closes, volumes) : null

  return {
    n,
    closes,
    highs,
    lows,
    opens,
    volumes,
    ema20,
    ema50,
    ema5,
    ema13,
    rsi14,
    macdLine,
    macdSig,
    bb,
    volSma20,
    obvLine,
  }
}

/**
 * 단일 조건 ID를 i봉에서 평가
 * @returns {{ long: boolean, short: boolean }}
 */
export function evaluateConditionId(id, i, ctx) {
  const { closes, highs, lows, opens, volumes, ema20, ema50, ema5, ema13, rsi14, macdLine, macdSig, bb, volSma20 } = ctx
  const prev = (idx) => (idx > 0 ? idx - 1 : 0)

  const z = (arr, idx) => (arr && idx >= 0 && idx < arr.length ? arr[idx] : null)

  switch (id) {
    case 'ema_cross': {
      const a = z(ema20, i)
      const b = z(ema50, i)
      const ap = z(ema20, prev(i))
      const bp = z(ema50, prev(i))
      if (a == null || b == null || ap == null || bp == null) return { long: false, short: false }
      const long = ap <= bp && a > b
      const short = ap >= bp && a < b
      return { long, short }
    }
    case 'ema_cross_fast': {
      const a = z(ema5, i)
      const b = z(ema13, i)
      const ap = z(ema5, prev(i))
      const bp = z(ema13, prev(i))
      if (a == null || b == null || ap == null || bp == null) return { long: false, short: false }
      return {
        long: ap <= bp && a > b,
        short: ap >= bp && a < b,
      }
    }
    case 'macd_cross': {
      const m = z(macdLine, i)
      const s = z(macdSig, i)
      const mp = z(macdLine, prev(i))
      const sp = z(macdSig, prev(i))
      if (m == null || s == null || mp == null || sp == null) return { long: false, short: false }
      return {
        long: mp <= sp && m > s,
        short: mp >= sp && m < s,
      }
    }
    case 'rsi_ob_os': {
      const r = z(rsi14, i)
      const rp = z(rsi14, prev(i))
      if (r == null || rp == null) return { long: false, short: false }
      return {
        long: r < 30 && rp >= 30,
        short: r > 70 && rp <= 70,
      }
    }
    case 'rsi_mid': {
      const r = z(rsi14, i)
      const rp = z(rsi14, prev(i))
      if (r == null || rp == null) return { long: false, short: false }
      return {
        long: rp <= 50 && r > 50,
        short: rp >= 50 && r < 50,
      }
    }
    case 'bb_squeeze': {
      /* 밴드 폭이 좁은 구간에서 상·하단 돌파 (수축 후 변동성 확대 프록시) */
      const w = z(bb.width, i)
      const up = z(bb.upper, i)
      const lo = z(bb.lower, i)
      const cl = z(closes, i)
      const clp = z(closes, prev(i))
      if (w == null || up == null || lo == null || cl == null || clp == null) {
        return { long: false, short: false }
      }
      const tight = w < 0.06
      return {
        long: tight && clp <= up && cl > up,
        short: tight && clp >= lo && cl < lo,
      }
    }
    case 'bb_touch': {
      const up = z(bb.upper, i)
      const lo = z(bb.lower, i)
      const hi = z(highs, i)
      const lw = z(lows, i)
      if (up == null || lo == null || hi == null || lw == null) return { long: false, short: false }
      return {
        long: lw <= lo * 1.001,
        short: hi >= up * 0.999,
      }
    }
    case 'volume_surge': {
      if (!volumes || !volSma20) return { long: false, short: false }
      const v = z(volumes, i)
      const vs = z(volSma20, i)
      const c = z(closes, i)
      const cp = z(closes, prev(i))
      const o = opens ? z(opens, i) : null
      if (v == null || vs == null || c == null) return { long: false, short: false }
      const surge = v > 2 * vs
      if (!surge) return { long: false, short: false }
      if (o != null) {
        return { long: c > o, short: c < o }
      }
      return {
        long: c > cp,
        short: c < cp,
      }
    }
    case 'obv_div': {
      /* 고도화 여지: 가격 고점 vs OBV 고점 비교 — 현재는 약한 프록시 */
      if (!ctx.obvLine) return { long: false, short: false }
      if (i < 5) return { long: false, short: false }
      const o0 = z(ctx.obvLine, i)
      const o5 = z(ctx.obvLine, i - 5)
      const c0 = z(closes, i)
      const c5 = z(closes, i - 5)
      if (o0 == null || o5 == null) return { long: false, short: false }
      const priceUp = c0 > c5
      const obvDown = o0 < o5
      const priceDown = c0 < c5
      const obvUp = o0 > o5
      return {
        long: priceDown && obvUp,
        short: priceUp && obvDown,
      }
    }
    default:
      return { long: false, short: false }
  }
}

/**
 * @param {string | { op: 'AND'|'OR', children: any[] }} node
 * @param {'long'|'short'} side
 */
export function evaluateLogicNode(node, i, ctx, side) {
  if (node == null) return false
  if (typeof node === 'string') {
    const r = evaluateConditionId(node, i, ctx)
    return side === 'long' ? r.long : r.short
  }
  if (typeof node === 'object' && node.op && Array.isArray(node.children)) {
    const parts = node.children.map((c) => evaluateLogicNode(c, i, ctx, side))
    if (node.op === 'AND') return parts.every(Boolean)
    if (node.op === 'OR') return parts.some(Boolean)
  }
  return false
}

/**
 * conditions 배열만 있으면 전부 AND
 * conditionLogic 이 있으면 그것 사용
 */
export function resolveConditionRoot(conditions, conditionLogic) {
  if (conditionLogic) return conditionLogic
  const ids = Array.isArray(conditions) ? conditions.filter(Boolean) : []
  if (ids.length === 0) return null
  if (ids.length === 1) return ids[0]
  return { op: 'AND', children: ids }
}

/**
 * 기술적 지표 (종가 시계열 기준)
 * 배열은 입력과 동일한 길이이며, 유효하지 않은 구간은 null.
 */

function safeNum(v, fb = NaN) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/**
 * 단순이동평균
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function sma(values, period) {
  const n = values.length
  const out = new Array(n).fill(null)
  const p = Math.max(1, Math.floor(period))
  if (n < p) return out
  for (let i = p - 1; i < n; i++) {
    let s = 0
    for (let j = 0; j < p; j++) s += safeNum(values[i - j], 0)
    out[i] = s / p
  }
  return out
}

/**
 * 지수이동평균 (첫 값은 SMA로 시드)
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function ema(values, period) {
  const n = values.length
  const out = new Array(n).fill(null)
  const p = Math.max(1, Math.floor(period))
  if (n < p) return out
  const k = 2 / (p + 1)
  let sum = 0
  for (let i = 0; i < p; i++) sum += safeNum(values[i], 0)
  out[p - 1] = sum / p
  for (let i = p; i < n; i++) {
    out[i] = safeNum(values[i], 0) * k + out[i - 1] * (1 - k)
  }
  return out
}

/**
 * Wilder RSI
 * @param {number[]} closes
 * @param {number} period 기본 14
 */
export function rsi(closes, period = 14) {
  const n = closes.length
  const out = new Array(n).fill(null)
  const p = Math.max(2, Math.floor(period))
  if (n <= p) return out

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= p; i++) {
    const ch = safeNum(closes[i], 0) - safeNum(closes[i - 1], 0)
    if (ch >= 0) avgGain += ch
    else avgLoss -= ch
  }
  avgGain /= p
  avgLoss /= p

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss
  out[p] = 100 - 100 / (1 + rs0)

  for (let i = p + 1; i < n; i++) {
    const ch = safeNum(closes[i], 0) - safeNum(closes[i - 1], 0)
    const g = ch > 0 ? ch : 0
    const l = ch < 0 ? -ch : 0
    avgGain = (avgGain * (p - 1) + g) / p
    avgLoss = (avgLoss * (p - 1) + l) / p
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    out[i] = 100 - 100 / (1 + rs)
  }
  return out
}

/**
 * MACD 라인 / 시그널 / 히스토그램
 * @returns {{ macd: (number|null)[], signal: (number|null)[], hist: (number|null)[] }}
 */
export function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const n = closes.length
  const macdLine = new Array(n).fill(null)
  const eF = ema(closes, fast)
  const eS = ema(closes, slow)
  for (let i = 0; i < n; i++) {
    if (eF[i] == null || eS[i] == null) continue
    macdLine[i] = eF[i] - eS[i]
  }

  let last = 0
  const filled = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    if (macdLine[i] != null) last = macdLine[i]
    filled[i] = last
  }
  const sigRaw = ema(filled, signalPeriod)

  const signal = new Array(n).fill(null)
  const hist = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (macdLine[i] == null || sigRaw[i] == null) continue
    signal[i] = sigRaw[i]
    hist[i] = macdLine[i] - signal[i]
  }
  return { macd: macdLine, signal, hist }
}

function rollingStd(values, period) {
  const n = values.length
  const out = new Array(n).fill(null)
  const p = Math.max(2, Math.floor(period))
  for (let i = p - 1; i < n; i++) {
    let sum = 0
    let sumSq = 0
    for (let j = 0; j < p; j++) {
      const v = safeNum(values[i - j], 0)
      sum += v
      sumSq += v * v
    }
    const mean = sum / p
    const varc = Math.max(0, sumSq / p - mean * mean)
    out[i] = Math.sqrt(varc)
  }
  return out
}

/**
 * 볼린저 밴드
 * @returns {{ upper: (number|null)[], middle: (number|null)[], lower: (number|null)[], width: (number|null)[] }}
 */
export function bollingerBands(closes, period = 20, mult = 2) {
  const middle = sma(closes, period)
  const sd = rollingStd(closes, period)
  const n = closes.length
  const upper = new Array(n).fill(null)
  const lower = new Array(n).fill(null)
  const width = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (middle[i] == null || sd[i] == null) continue
    upper[i] = middle[i] + mult * sd[i]
    lower[i] = middle[i] - mult * sd[i]
    width[i] = middle[i] !== 0 ? (upper[i] - lower[i]) / middle[i] : null
  }
  return { upper, middle, lower, width }
}

/**
 * OBV (거래량 필수)
 * @param {number[]} closes
 * @param {number[]} volumes
 */
export function obv(closes, volumes) {
  const n = closes.length
  const out = new Array(n).fill(null)
  if (!volumes || volumes.length !== n) return out
  let acc = 0
  out[0] = 0
  for (let i = 1; i < n; i++) {
    const c0 = safeNum(closes[i - 1], 0)
    const c1 = safeNum(closes[i], 0)
    const v = safeNum(volumes[i], 0)
    if (c1 > c0) acc += v
    else if (c1 < c0) acc -= v
    out[i] = acc
  }
  return out
}

/**
 * 거래량 급증: 현재 봉 거래량이 SMA(period)의 multiplier 배 이상
 */
export function isVolumeSurgeAt(volumes, i, period = 20, multiplier = 2) {
  if (!volumes || volumes.length === 0 || i < 0) return false
  const vs = sma(volumes, period)
  if (vs[i] == null || vs[i] <= 0) return false
  return safeNum(volumes[i], 0) >= multiplier * vs[i]
}

/**
 * Wilder ATR (종가만 사용 — TR ≈ |close[i]-close[i-1]|)
 * @param {number[]} closes
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function atr(closes, period = 14) {
  const n = closes.length
  const out = new Array(n).fill(null)
  const p = Math.max(2, Math.floor(period))
  if (n <= p) return out
  const tr = new Array(n).fill(null)
  tr[0] = 0
  for (let i = 1; i < n; i++) {
    tr[i] = Math.abs(safeNum(closes[i], 0) - safeNum(closes[i - 1], 0))
  }
  let sum = 0
  for (let i = 1; i <= p; i++) sum += safeNum(tr[i], 0)
  out[p] = sum / p
  for (let i = p + 1; i < n; i++) {
    out[i] = (out[i - 1] * (p - 1) + safeNum(tr[i], 0)) / p
  }
  return out
}

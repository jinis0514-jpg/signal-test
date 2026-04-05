/**
 * strategyEngine.js
 * - 가격 시계열 → 시그널 → 트레이드/성과
 * - 레거시: 조건 없음 → MA
 * - 프리셋: string[] / { kind:'preset' } → strategyConditions.evaluateConditionId
 * - 리치 객체: { indicator:'RSI'|'EMA_CROSS'|... } → evaluateCondition
 */

import {
  buildIndicatorContext,
  evaluateConditionId,
  evaluateLogicNode,
  resolveConditionRoot,
} from './strategyConditions'
import { ema, sma, rsi, macd, bollingerBands, isVolumeSurgeAt, atr } from './indicators'
import { normalizeStrategyPayload, DEFAULT_RISK_CONFIG } from './strategyPayload'

function safeNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function uid(prefix, time, i) {
  return `${prefix}_${String(time)}_${String(i)}`
}

/**
 * prices(숫자 배열 또는 {time,price} 배열) → {time, price} 배열로 통일
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
 * risk_config → 엔진용 수치 (stopType: fixed_pct | percent 등 퍼센트 손절만 활성)
 */
export function normalizeEngineRisk(risk = {}) {
  const rawType = String(risk.stopType ?? 'fixed_pct').toLowerCase()
  const percentStopTypes = new Set(['fixed_pct', 'percent', 'pct', ''])
  const usesPercentStop = percentStopTypes.has(rawType)
  const stopPct = usesPercentStop ? safeNum(risk.stopValue, 0) : 0
  const tpPct = safeNum(risk.takeProfitPct, 0)
  let trailingPct = safeNum(risk.trailingStopPct, 0)
  if (rawType === 'trailing' && trailingPct <= 0) {
    trailingPct = safeNum(risk.stopValue, 0)
  }
  const timeExitBars = Math.max(0, Math.floor(safeNum(risk.timeExitBars, 0)))
  const atrPeriod = Math.max(2, Math.floor(safeNum(risk.atrPeriod, 14)))
  const atrMult = safeNum(risk.atrMult, 2)
  const posSizeRaw = risk.posSize
  const posSizeNum = posSizeRaw === '' || posSizeRaw == null ? 0 : safeNum(posSizeRaw, 0)
  const positionWeight = posSizeNum > 0 ? posSizeNum / 100 : 1
  const maxOpenPos = Math.max(1, Math.floor(safeNum(risk.maxOpenPos, 1)))
  const allowReentry = risk.allowReentry === true || risk.allowReentry === 'true'
  const maxLossPct = safeNum(risk.maxLossPct ?? risk.maxDrawdownPct, 0)
  return {
    stopPct,
    tpPct,
    trailingPct,
    timeExitBars,
    atrPeriod,
    atrMult,
    positionWeight,
    maxOpenPos,
    allowReentry,
    stopType: rawType,
    usesPercentStop,
    maxLossPct,
  }
}

function checkRiskExit(position, price, stopPct, tpPct) {
  if (!position) return null
  const ep = safeNum(position.entryPrice, 0)
  if (ep <= 0) return null
  const p = safeNum(price, 0)
  if (position.type === 'LONG') {
    if (stopPct > 0 && p <= ep * (1 - stopPct / 100)) return 'stop'
    if (tpPct > 0 && p >= ep * (1 + tpPct / 100)) return 'tp'
  } else {
    if (stopPct > 0 && p >= ep * (1 + stopPct / 100)) return 'stop'
    if (tpPct > 0 && p <= ep * (1 - tpPct / 100)) return 'tp'
  }
  return null
}

/** @returns {{ note: string, exitReason: string } | null} */
function checkAdvancedRiskExit(position, price, i, riskState, atrLine) {
  if (!position) return null
  const ep = safeNum(position.entryPrice, 0)
  const p = safeNum(price, 0)
  const st = riskState.stopType

  if (riskState.timeExitBars > 0 && position.entryIdx != null) {
    if (i - position.entryIdx >= riskState.timeExitBars) {
      return { note: `시간 청산 (${riskState.timeExitBars}봉)`, exitReason: 'time' }
    }
  }

  if (st === 'trailing' && riskState.trailingPct > 0) {
    const hw = safeNum(position.highWater, p)
    const lw = safeNum(position.lowWater, p)
    if (position.type === 'LONG') {
      const trail = hw * (1 - riskState.trailingPct / 100)
      if (p <= trail) return { note: `트레일링 ${riskState.trailingPct}%`, exitReason: 'trail' }
    } else {
      const trail = lw * (1 + riskState.trailingPct / 100)
      if (p >= trail) return { note: `트레일링 ${riskState.trailingPct}%`, exitReason: 'trail' }
    }
  }

  if (st === 'atr_stop' && atrLine && atrLine[i] != null && riskState.atrMult > 0) {
    const av = safeNum(atrLine[i], 0)
    if (av > 0) {
      if (position.type === 'LONG' && p <= ep - av * riskState.atrMult) {
        return { note: `ATR 손절 (×${riskState.atrMult})`, exitReason: 'atr' }
      }
      if (position.type === 'SHORT' && p >= ep + av * riskState.atrMult) {
        return { note: `ATR 손절 (×${riskState.atrMult})`, exitReason: 'atr' }
      }
    }
  }

  const rx = checkRiskExit(position, p, riskState.stopPct, riskState.tpPct)
  if (rx === 'stop') return { note: `손절 ${riskState.stopPct}%`, exitReason: 'stop' }
  if (rx === 'tp') return { note: `익절 ${riskState.tpPct}%`, exitReason: 'tp' }
  return null
}

/** 청산 시 손익 % (롱/숏) — calculateTradeHistory / calculatePerformance와 동일 식 */
function pnlPct(dir, entry, exit) {
  const ep = safeNum(entry, 0)
  const xp = safeNum(exit, 0)
  if (ep <= 0) return 0
  return dir === 'SHORT'
    ? ((ep - xp) / ep) * 100
    : ((xp - ep) / ep) * 100
}

function entryNote(dir, risk) {
  const parts = [dir === 'LONG' ? '롱 진입' : '숏 진입']
  const ps = safeNum(risk.posSize, 0)
  if (ps > 0) parts.push(`포지션 ${ps}%`)
  return parts.join(' · ')
}

/**
 * 통합 포지션 루프
 * - 우선순위: 손절/익절(청산) → 동일 봉에서 반대 시그널은 청산만, 진입은 다음 봉(pending)
 * - maxLossPct: 누적 자산 곡선 피크 대비 낙폭 초과 시 이후 신규 진입 중단
 */
function runUnifiedPositionLoop(series, strategyConfig, startIdx, getWants, noteOpts = {}) {
  const riskState = normalizeEngineRisk(strategyConfig.risk_config ?? {})
  const allowReentry = riskState.allowReentry
  const maxOpenPos = riskState.maxOpenPos
  const maxLossLimitPct = safeNum(riskState.maxLossPct, 0)

  const closes = series.map((s) => safeNum(s.price, 0))
  const atrLine = riskState.stopType === 'atr_stop'
    ? atr(closes, riskState.atrPeriod)
    : null

  const riskRaw = strategyConfig.risk_config ?? {}
  const minBars = Math.max(0, Math.floor(strategyConfig.minBarsBetweenEntries ?? 1))
  const minGapMs = Math.max(0, safeNum(strategyConfig.minEntryGapMs, 0))

  const entryPosSize = safeNum(riskRaw.posSize, 0) > 0 ? safeNum(riskRaw.posSize, 0) / 100 : 1

  let position = null
  let lastExitIdx = -1e9
  let lastExitTime = -1e18
  let blockSameDir = null
  /** 반대 시그널로 청산한 뒤 다음 봉에서만 진입 */
  let pendingDir = null
  let equity = 100
  let peak = 100
  let tradingHalted = false
  const signals = []

  const nl = noteOpts.entryNoteLong ?? (() => entryNote('LONG', riskRaw))
  const ns = noteOpts.entryNoteShort ?? (() => entryNote('SHORT', riskRaw))

  const recordExitEquity = (closedPos, exitPrice) => {
    if (maxLossLimitPct <= 0) return
    const rawPct = pnlPct(closedPos.type, closedPos.entryPrice, exitPrice)
    const pnl = rawPct * entryPosSize
    equity *= 1 + pnl / 100
    peak = Math.max(peak, equity)
    if (!tradingHalted && peak > 0 && ((peak - equity) / peak) * 100 >= maxLossLimitPct) {
      tradingHalted = true
    }
  }

  for (let i = startIdx; i < series.length; i++) {
    const cur = series[i]
    const price = safeNum(cur.price, 0)
    const t = safeNum(cur.time, i)
    const w = getWants(i, position)
    const wantLong = !!w.wantLong
    const wantShort = !!w.wantShort

    if (position) {
      if (position.type === 'LONG') {
        position.highWater = Math.max(safeNum(position.highWater, price), price)
      } else {
        position.lowWater = Math.min(safeNum(position.lowWater, price), price)
      }

      const adv = checkAdvancedRiskExit(position, price, i, riskState, atrLine)
      if (adv) {
        const closed = position
        signals.push({
          id: uid('exit', t, i),
          type: 'EXIT',
          direction: closed.type,
          price,
          time: t,
          note: adv.note,
          open: false,
          exitReason: adv.exitReason,
        })
        recordExitEquity(closed, price)
        const closedDir = closed.type
        position = null
        pendingDir = null
        lastExitIdx = i
        lastExitTime = t
        if (!allowReentry) blockSameDir = closedDir
        continue
      }

      if (position.type === 'LONG' && wantLong) continue
      if (position.type === 'SHORT' && wantShort) continue

      if (position.type === 'LONG' && wantShort && !wantLong) {
        const closed = position
        signals.push({
          id: uid('exit', t, i),
          type: 'EXIT',
          direction: 'LONG',
          price,
          time: t,
          note: '반대 시그널(숏)',
          open: false,
          exitReason: 'signal',
        })
        recordExitEquity(closed, price)
        position = null
        lastExitIdx = i
        lastExitTime = t
        pendingDir = 'SHORT'
        if (!allowReentry) blockSameDir = 'LONG'
        continue
      }

      if (position.type === 'SHORT' && wantLong && !wantShort) {
        const closed = position
        signals.push({
          id: uid('exit', t, i),
          type: 'EXIT',
          direction: 'SHORT',
          price,
          time: t,
          note: '반대 시그널(롱)',
          open: false,
          exitReason: 'signal',
        })
        recordExitEquity(closed, price)
        position = null
        lastExitIdx = i
        lastExitTime = t
        pendingDir = 'LONG'
        if (!allowReentry) blockSameDir = 'SHORT'
        continue
      }

      continue
    }

    if (maxOpenPos < 1) continue

    const cooldownOk = (i - lastExitIdx >= minBars) && (minGapMs <= 0 || t - lastExitTime >= minGapMs)

    if (pendingDir) {
      if (!cooldownOk) continue
      if (wantLong && wantShort) {
        pendingDir = null
        continue
      }
      const match =
        (pendingDir === 'LONG' && wantLong && !wantShort)
        || (pendingDir === 'SHORT' && wantShort && !wantLong)
      if (match) {
        if (tradingHalted) {
          pendingDir = null
          continue
        }
        if (pendingDir === 'LONG') {
          if (!allowReentry && blockSameDir === 'LONG') {
            pendingDir = null
            continue
          }
          position = {
            type: 'LONG',
            entryPrice: price,
            entryTime: t,
            entryIdx: i,
            highWater: price,
            lowWater: price,
          }
          blockSameDir = null
          pendingDir = null
          signals.push({
            id: uid('entry', t, i),
            type: 'ENTRY',
            direction: 'LONG',
            price,
            time: t,
            note: nl(),
            open: true,
            positionSize: entryPosSize,
          })
        } else {
          if (!allowReentry && blockSameDir === 'SHORT') {
            pendingDir = null
            continue
          }
          position = {
            type: 'SHORT',
            entryPrice: price,
            entryTime: t,
            entryIdx: i,
            highWater: price,
            lowWater: price,
          }
          blockSameDir = null
          pendingDir = null
          signals.push({
            id: uid('entry', t, i),
            type: 'ENTRY',
            direction: 'SHORT',
            price,
            time: t,
            note: ns(),
            open: true,
            positionSize: entryPosSize,
          })
        }
        continue
      }
      pendingDir = null
    }

    if (!cooldownOk) continue
    if (tradingHalted) continue

    if (wantLong && wantShort) continue

    if (wantLong && !wantShort) {
      if (!allowReentry && blockSameDir === 'LONG') continue
      position = {
        type: 'LONG',
        entryPrice: price,
        entryTime: t,
        entryIdx: i,
        highWater: price,
        lowWater: price,
      }
      blockSameDir = null
      signals.push({
        id: uid('entry', t, i),
        type: 'ENTRY',
        direction: 'LONG',
        price,
        time: t,
        note: nl(),
        open: true,
        positionSize: entryPosSize,
      })
      continue
    }

    if (wantShort && !wantLong) {
      if (!allowReentry && blockSameDir === 'SHORT') continue
      position = {
        type: 'SHORT',
        entryPrice: price,
        entryTime: t,
        entryIdx: i,
        highWater: price,
        lowWater: price,
      }
      blockSameDir = null
      signals.push({
        id: uid('entry', t, i),
        type: 'ENTRY',
        direction: 'SHORT',
        price,
        time: t,
        note: ns(),
        open: true,
        positionSize: entryPosSize,
      })
    }
  }

  let lastEntryPos = -1
  for (let j = 0; j < signals.length; j++) {
    if (signals[j].type === 'ENTRY') lastEntryPos = j
  }
  for (let j = 0; j < signals.length; j++) {
    if (signals[j].type === 'ENTRY') signals[j].open = j === lastEntryPos
  }

  return signals
}

function generateLegacyMaSignals(series, lookback, strategyConfig = null) {
  const lb = Math.max(2, Math.floor(lookback ?? 5))
  if (series.length < lb + 1) return []

  const cfg = strategyConfig && typeof strategyConfig === 'object'
    ? strategyConfig
    : { risk_config: {}, minBarsBetweenEntries: 1, minEntryGapMs: 0 }

  return runUnifiedPositionLoop(series, cfg, lb, (i) => {
    const cur = series[i]
    const ma = movingAverage(series, i, lb)
    if (ma === null) return { wantLong: false, wantShort: false }
    const wantsLong = cur.price > ma
    const wantsShort = cur.price < ma
    return { wantLong: wantsLong, wantShort: wantsShort }
  }, {
    entryNoteLong: () => 'MA 상향 돌파',
    entryNoteShort: () => 'MA 하향 이탈',
  })
}

/** 지표 캐시 + evaluateConditionId 호환 필드 */
export function buildUnifiedContext(series, candles = null) {
  const base = buildIndicatorContext(series, candles)
  const closes = base.closes
  const emaCache = {}
  const smaCache = {}
  const rsiCache = {}
  const macdCache = {}
  const bbCache = {}

  return {
    ...base,
    getEma(period) {
      const p = Math.max(1, Math.floor(safeNum(period, 20)))
      if (!emaCache[p]) emaCache[p] = ema(closes, p)
      return emaCache[p]
    },
    getSma(period) {
      const p = Math.max(1, Math.floor(safeNum(period, 20)))
      if (!smaCache[p]) smaCache[p] = sma(closes, p)
      return smaCache[p]
    },
    getRsi(period) {
      const p = Math.max(2, Math.floor(safeNum(period, 14)))
      if (!rsiCache[p]) rsiCache[p] = rsi(closes, p)
      return rsiCache[p]
    },
    getMacd(fast = 12, slow = 26, sig = 9) {
      const key = `${fast}-${slow}-${sig}`
      if (!macdCache[key]) macdCache[key] = macd(closes, fast, slow, sig)
      return macdCache[key]
    },
    getBb(period = 20, mult = 2) {
      const key = `${period}-${mult}`
      if (!bbCache[key]) bbCache[key] = bollingerBands(closes, period, mult)
      return bbCache[key]
    },
  }
}

function compareOp(a, op, b) {
  switch (op) {
    case '<':  return a < b
    case '<=': return a <= b
    case '>':  return a > b
    case '>=': return a >= b
    case '==': return a === b
    default:   return a < b
  }
}

/**
 * 단일 조건 (프리셋 문자열 · {kind:preset} · 리치 객체)
 * @param {unknown} condition
 * @param {ReturnType<typeof buildUnifiedContext>} ctx `buildUnifiedContext` 결과
 * @param {number} i 현재 봉 인덱스 (시계열 배열 기준)
 * @returns {{ long: boolean, short: boolean }}
 */
export function evaluateCondition(condition, ctx, i) {
  if (condition == null) return { long: false, short: false }

  if (typeof condition === 'string') {
    return evaluateConditionId(condition, i, ctx)
  }

  if (typeof condition === 'object' && condition.kind === 'preset' && condition.presetId) {
    return evaluateConditionId(condition.presetId, i, ctx)
  }

  const ind = String(condition.indicator || '').toUpperCase()

  switch (ind) {
    case 'RSI': {
      const period = safeNum(condition.period, 14)
      const arr = ctx.getRsi(period)
      const r = arr[i]
      const rp = i > 0 ? arr[i - 1] : null
      if (r == null) return { long: false, short: false }

      /* 에디터: RSI 과매수/과매도 구간 크로스 (과매도 진입 / 과매수 숏) */
      if (condition.crossoverZones) {
        if (rp == null) return { long: false, short: false }
        const os = safeNum(condition.oversold, 30)
        const ob = safeNum(condition.overbought, 70)
        return {
          long: r < os && rp >= os,
          short: r > ob && rp <= ob,
        }
      }

      /* 에디터: 중심선 크로스 */
      if (condition.crossoverMid != null) {
        if (rp == null) return { long: false, short: false }
        const mid = safeNum(condition.crossoverMid, 50)
        return {
          long: rp <= mid && r > mid,
          short: rp >= mid && r < mid,
        }
      }

      const op = condition.operator || '<'
      const val = safeNum(condition.value, 30)
      const dir = String(condition.direction || 'LONG').toUpperCase()

      if (dir === 'LONG') {
        return { long: compareOp(r, op, val), short: false }
      }
      if (dir === 'SHORT') {
        return { long: false, short: compareOp(r, op, val) }
      }
      /* BOTH — 레벨형 */
      const os = safeNum(condition.oversold, 30)
      const ob = safeNum(condition.overbought, 70)
      return { long: r < os, short: r > ob }
    }

    case 'EMA_CROSS': {
      const fp = safeNum(condition.fastPeriod, 20)
      const sp = safeNum(condition.slowPeriod, 50)
      const ef = ctx.getEma(fp)
      const es = ctx.getEma(sp)
      if (i < 1) return { long: false, short: false }
      if (ef[i] == null || es[i] == null || ef[i - 1] == null || es[i - 1] == null) {
        return { long: false, short: false }
      }
      const longX = ef[i - 1] <= es[i - 1] && ef[i] > es[i]
      const shortX = ef[i - 1] >= es[i - 1] && ef[i] < es[i]
      const dir = String(condition.direction || 'BOTH').toUpperCase()
      if (dir === 'LONG') return { long: longX, short: false }
      if (dir === 'SHORT') return { long: false, short: shortX }
      return { long: longX, short: shortX }
    }

    case 'SMA_CROSS': {
      const fp = safeNum(condition.fastPeriod, 20)
      const sp = safeNum(condition.slowPeriod, 50)
      const sf = ctx.getSma(fp)
      const ss = ctx.getSma(sp)
      if (i < 1) return { long: false, short: false }
      if (sf[i] == null || ss[i] == null || sf[i - 1] == null || ss[i - 1] == null) {
        return { long: false, short: false }
      }
      const longX = sf[i - 1] <= ss[i - 1] && sf[i] > ss[i]
      const shortX = sf[i - 1] >= ss[i - 1] && sf[i] < ss[i]
      const dir = String(condition.direction || 'BOTH').toUpperCase()
      if (dir === 'LONG') return { long: longX, short: false }
      if (dir === 'SHORT') return { long: false, short: shortX }
      return { long: longX, short: shortX }
    }

    case 'MACD_CROSS': {
      const fast = safeNum(condition.fastPeriod, 12)
      const slow = safeNum(condition.slowPeriod, 26)
      const sigp = safeNum(condition.signalPeriod, 9)
      const { macd: mLine, signal: sLine } = ctx.getMacd(fast, slow, sigp)
      if (i < 1) return { long: false, short: false }
      const m = mLine[i]
      const s = sLine[i]
      const mp = mLine[i - 1]
      const sp = sLine[i - 1]
      if (m == null || s == null || mp == null || sp == null) return { long: false, short: false }
      const longX = mp <= sp && m > s
      const shortX = mp >= sp && m < s
      const dir = String(condition.direction || 'BOTH').toUpperCase()
      if (dir === 'LONG') return { long: longX, short: false }
      if (dir === 'SHORT') return { long: false, short: shortX }
      return { long: longX, short: shortX }
    }

    case 'BB_TOUCH': {
      const period = safeNum(condition.period, 20)
      const mult = safeNum(condition.mult ?? condition.multiplier, 2)
      const bb = ctx.getBb(period, mult)
      const hi = ctx.highs[i]
      const lw = ctx.lows[i]
      if (bb.upper[i] == null || bb.lower[i] == null || hi == null || lw == null) {
        return { long: false, short: false }
      }
      const touchLong = lw <= bb.lower[i] * 1.002
      const touchShort = hi >= bb.upper[i] * 0.998
      const dir = String(condition.direction || 'BOTH').toUpperCase()
      if (dir === 'LONG') return { long: touchLong, short: false }
      if (dir === 'SHORT') return { long: false, short: touchShort }
      return { long: touchLong, short: touchShort }
    }

    case 'VOLUME_SURGE': {
      const vol = ctx.volumes
      const per = safeNum(condition.volumePeriod ?? condition.period, 20)
      const mult = safeNum(condition.multiplier ?? condition.mult, 2)
      if (!vol || i < per - 1) return { long: false, short: false }
      const surge = isVolumeSurgeAt(vol, i, per, mult)
      if (!surge) return { long: false, short: false }
      const c = ctx.closes[i]
      const cp = ctx.closes[i - 1]
      const o = ctx.opens ? ctx.opens[i] : null
      const dir = String(condition.direction || 'BOTH').toUpperCase()
      if (o != null) {
        if (dir === 'LONG') return { long: c > o, short: false }
        if (dir === 'SHORT') return { long: false, short: c < o }
        return { long: c > o, short: c < o }
      }
      if (dir === 'LONG') return { long: c > cp, short: false }
      if (dir === 'SHORT') return { long: false, short: c < cp }
      return { long: c > cp, short: c < cp }
    }

    case 'BB_SQUEEZE': {
      const period = safeNum(condition.period, 20)
      const mult = safeNum(condition.mult ?? condition.multiplier, 2)
      const widthTh = safeNum(condition.widthThreshold, 0.06)
      const bb = ctx.getBb(period, mult)
      const w = bb.width[i]
      const up = bb.upper[i]
      const lo = bb.lower[i]
      const cl = ctx.closes[i]
      const clp = i > 0 ? ctx.closes[i - 1] : null
      if (w == null || up == null || lo == null || cl == null || clp == null) {
        return { long: false, short: false }
      }
      const tight = w < widthTh
      return {
        long: tight && clp <= up && cl > up,
        short: tight && clp >= lo && cl < lo,
      }
    }

    case 'PRICE_VS_SMA':
    case 'PRICE_VS_EMA': {
      const period = safeNum(condition.period, 20)
      const lineArr = ind === 'PRICE_VS_SMA' ? ctx.getSma(period) : ctx.getEma(period)
      const c = ctx.closes[i]
      const lv = lineArr[i]
      if (c == null || lv == null) return { long: false, short: false }
      const op = condition.operator || '>'
      const hit = compareOp(c, op, lv)
      if (op === '>' || op === '>=') return { long: hit, short: false }
      if (op === '<' || op === '<=') return { long: false, short: hit }
      return { long: false, short: false }
    }

    case 'VOLUME_RATIO': {
      const vol = ctx.volumes
      const per = safeNum(condition.volumePeriod ?? condition.period, 20)
      const mult = safeNum(condition.multiplier, 2)
      const op = condition.operator || '>'
      if (!vol || i < per - 1) return { long: false, short: false }
      let sum = 0
      for (let k = 0; k < per; k++) sum += safeNum(vol[i - k], 0)
      const avg = sum / per
      if (avg <= 0) return { long: false, short: false }
      const ratio = safeNum(vol[i], 0) / avg
      const hit = compareOp(ratio, op, mult)
      if (op === '>' || op === '>=') return { long: hit, short: false }
      if (op === '<' || op === '<=') return { long: false, short: hit }
      return { long: false, short: false }
    }

    case 'DSL_OR': {
      const clauses = Array.isArray(condition.clauses) ? condition.clauses : []
      let long = false
      let short = false
      for (const sub of clauses) {
        const r = evaluateCondition(sub, ctx, i)
        long = long || r.long
        short = short || r.short
      }
      return { long, short }
    }

    default:
      return { long: false, short: false }
  }
}

/**
 * 1차: 전체 AND. OR 그룹은 `conditionLogic` + leaf가 전부 문자열 preset일 때 `evaluateLogicNode` 경로.
 * @param {unknown[]} conditions
 * @param {ReturnType<typeof buildUnifiedContext>} ctx
 * @param {number} i
 */
export function evaluateConditions(conditions, ctx, i) {
  const list = Array.isArray(conditions) ? conditions : []
  if (list.length === 0) return { long: false, short: false }
  let long = true
  let short = true
  for (const c of list) {
    const r = evaluateCondition(c, ctx, i)
    long = long && r.long
    short = short && r.short
  }
  return { long, short }
}

function isPresetOnlyConditions(conditions) {
  if (!Array.isArray(conditions)) return true
  return conditions.every((c) => {
    if (typeof c === 'string') return true
    if (c && typeof c === 'object' && c.kind === 'preset') return true
    return false
  })
}

function shouldUseLogicTree(strategyConfig) {
  const cl = strategyConfig.conditionLogic
  if (!cl) return false
  /* OR/AND 트리 leaf는 현재 preset 문자열만 지원 */
  const conds = strategyConfig.conditions || []
  return conds.length > 0 && conds.every((c) => typeof c === 'string')
}

function computeWarmupBars(conditions) {
  let max = 55
  const list = Array.isArray(conditions) ? conditions : []
  for (const c of list) {
    if (typeof c === 'string') continue
    if (!c || typeof c !== 'object') continue
    if (c.kind === 'preset') continue
    const ind = String(c.indicator || '').toUpperCase()
    if (ind === 'DSL_OR' && Array.isArray(c.clauses)) {
      max = Math.max(max, computeWarmupBars(c.clauses))
      continue
    }
    max = Math.max(
      max,
      safeNum(c.period, 0) + 5,
      safeNum(c.fastPeriod, 0) + 5,
      safeNum(c.slowPeriod, 0) + 5,
      safeNum(c.volumePeriod, 0) + 5,
      55,
    )
  }
  return Math.min(Math.max(max, 20), 250)
}

/** 동일 조건 중복(예: preset 두 번)으로 신호가 과도하게 좁아지지 않도록 1회만 평가 */
function conditionDedupeKey(c) {
  if (typeof c === 'string') return `s:${c}`
  if (!c || typeof c !== 'object') return `u:${String(c)}`
  if (c.kind === 'preset' && c.presetId) return `p:${String(c.presetId)}`
  const ind = String(c.indicator || '').toUpperCase()
  const dir = String(c.direction || '')
  const op = String(c.operator || '')
  return `i:${ind}:${dir}:${op}:${safeNum(c.period, 0)}:${safeNum(c.value, 0)}:${safeNum(c.fastPeriod, 0)}:${safeNum(c.slowPeriod, 0)}:${safeNum(c.volumePeriod ?? c.period, 0)}`
}

function dedupeEngineConditions(conditions) {
  const list = Array.isArray(conditions) ? conditions : []
  const seen = new Set()
  const out = []
  for (const cond of list) {
    const k = conditionDedupeKey(cond)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(cond)
  }
  return out
}

function runPositionLoop(series, strategyConfig, ctx, warmup) {
  const split =
    strategyConfig.entryExitSplit === true
    && Array.isArray(strategyConfig.entryConditions)
    && strategyConfig.entryConditions.length > 0
    && Array.isArray(strategyConfig.exitConditions)
    && strategyConfig.exitConditions.length > 0

  const entryConds = dedupeEngineConditions(
    split ? strategyConfig.entryConditions : strategyConfig.conditions ?? [],
  )
  const exitConds = dedupeEngineConditions(
    split ? strategyConfig.exitConditions : strategyConfig.conditions ?? [],
  )

  const cfg = {
    ...strategyConfig,
    conditions: dedupeEngineConditions(strategyConfig.conditions ?? []),
  }
  const conditions = cfg.conditions ?? []
  const useTree = !split && shouldUseLogicTree(cfg)
  const root = useTree ? resolveConditionRoot(conditions, cfg.conditionLogic) : null

  return runUnifiedPositionLoop(series, cfg, warmup, (i, position) => {
    if (split) {
      const list = position ? exitConds : entryConds
      const r = evaluateConditions(list, ctx, i)
      return { wantLong: r.long, wantShort: r.short }
    }
    if (useTree && root) {
      return {
        wantLong: evaluateLogicNode(root, i, ctx, 'long'),
        wantShort: evaluateLogicNode(root, i, ctx, 'short'),
      }
    }
    const r = evaluateConditions(conditions, ctx, i)
    return { wantLong: r.long, wantShort: r.short }
  })
}

/**
 * 에디터 conditions + risk + 메타 → 엔진용 strategyConfig
 */
export function buildStrategyConfigFromConditions(conditions = [], riskConfig = {}, meta = {}) {
  const rc = { ...DEFAULT_RISK_CONFIG, ...riskConfig }
  const minBars = rc.minSignalGap !== '' && rc.minSignalGap != null
    ? Math.max(0, Math.floor(Number(rc.minSignalGap)) || 1)
    : (meta.minBarsBetweenEntries ?? 1)
  const allowReentry = rc.allowReentry === true || rc.allowReentry === 'true'

  return {
    conditions,
    risk_config: rc,
    conditionLogic: meta.conditionLogic ?? null,
    mode: meta.mode ?? 'trend',
    timeframe: meta.timeframe ?? '1h',
    asset: meta.asset ?? 'BTC',
    lookback: meta.lookback ?? 5,
    candles: meta.candles,
    minBarsBetweenEntries: allowReentry ? 0 : minBars,
    minEntryGapMs: meta.minEntryGapMs ?? 0,
    entryExitSplit: meta.entryExitSplit === true,
    entryConditions: meta.entryConditions,
    exitConditions: meta.exitConditions,
  }
}

/** 시뮬/검증 mock 전략 id → 기본 엔진 조건 (preset ID 문자열 AND) */
const CATALOG_ENGINE_DEFAULTS = {
  'btc-trend': {
    conditions: ['ema_cross', 'rsi_mid'],
    mode: 'trend',
    lookback: 5,
  },
  'eth-range': {
    conditions: ['bb_touch'],
    mode: 'volatility',
    lookback: 5,
  },
  'btc-breakout': {
    conditions: ['volume_surge'],
    mode: 'trend',
    lookback: 5,
  },
  'sol-momentum': {
    conditions: ['macd_cross'],
    mode: 'momentum',
    lookback: 5,
  },
}

/**
 * 내 전략 → 시뮬/검증 설정
 */
export function buildEngineConfigFromUserStrategy(userStrat, options = {}) {
  if (!userStrat) {
    return buildStrategyConfigFromConditions([], {}, { candles: options.candles, lookback: 5, mode: 'trend' })
  }
  const p = normalizeStrategyPayload(userStrat)
  const ec = Array.isArray(p.entryConditions) ? p.entryConditions : []
  const xc = Array.isArray(p.exitConditions) ? p.exitConditions : []
  const split = p.entryExitSplit === true && ec.length > 0 && xc.length > 0
  return buildStrategyConfigFromConditions(split ? ec : p.conditions, p.risk_config, {
    mode: p.mode,
    timeframe: p.timeframe,
    asset: p.asset,
    candles: options.candles,
    conditionLogic: p.conditionLogic,
    minEntryGapMs: p.minEntryGapMs,
    minBarsBetweenEntries: p.minBarsBetweenEntries,
    lookback: 5,
    entryExitSplit: split,
    entryConditions: split ? ec : undefined,
    exitConditions: split ? xc : undefined,
  })
}

/**
 * 앱 내장(카탈로그) 전략 행 → 엔진용 설정. id별 기본 preset 조건 + 메타.
 * @param {{ id?: string, symbol?: string, timeframe?: string }} catalogStrategy
 * @param {{ candles?: object[] }} options
 */
export function buildCatalogStrategyEngineConfig(catalogStrategy, options = {}) {
  const id = catalogStrategy?.id
  const catalog = CATALOG_ENGINE_DEFAULTS[id] ?? { conditions: [], lookback: 5, mode: 'trend' }
  const sym = catalogStrategy?.symbol ?? ''
  const asset = String(sym).replace(/USDT$/i, '').trim() || 'BTC'
  const tf = catalogStrategy?.timeframe ?? '1h'
  return buildStrategyConfigFromConditions(catalog.conditions, {}, {
    mode: catalog.mode,
    timeframe: tf,
    asset,
    lookback: catalog.lookback ?? 5,
    candles: options.candles,
    conditionLogic: catalog.conditionLogic ?? null,
    minEntryGapMs: 0,
    minBarsBetweenEntries: 1,
  })
}

function hasConditionsArray(conditions) {
  return Array.isArray(conditions) && conditions.length > 0
}

function shouldFallbackMa(series, strategyConfig) {
  const conds = strategyConfig.conditions
  if (!hasConditionsArray(conds)) return true
  const w = computeWarmupBars(conds)
  if (series.length < w + 2) return true
  /* 리치 객체가 전부 unknown indicator면 신호 없음 → MA로 */
  let anyKnown = false
  for (const c of conds) {
    if (typeof c === 'string' || (c && c.kind === 'preset')) {
      anyKnown = true
      break
    }
    if (c && typeof c === 'object' && c.indicator) {
      const ind = String(c.indicator).toUpperCase()
      if ([
        'RSI', 'EMA_CROSS', 'SMA_CROSS', 'MACD_CROSS', 'BB_TOUCH', 'VOLUME_SURGE',
        'PRICE_VS_SMA', 'PRICE_VS_EMA', 'VOLUME_RATIO', 'DSL_OR',
      ].includes(ind)) {
        anyKnown = true
        break
      }
    }
  }
  if (!anyKnown && conds.some((c) => typeof c === 'object' && c && !c.kind)) {
    return true
  }
  return false
}

/**
 * 정규화된 시계열 + strategyConfig → 시그널
 */
export function generateSignalsFromSeries(series, strategyConfig = {}) {
  if (!Array.isArray(series) || series.length === 0) return []

  const conds = strategyConfig.conditions
  if (!hasConditionsArray(conds)) {
    const lookback = Math.max(2, Math.floor(strategyConfig?.lookback ?? 5))
    return generateLegacyMaSignals(series, lookback, strategyConfig)
  }

  if (shouldFallbackMa(series, strategyConfig)) {
    const lookback = Math.max(2, Math.floor(strategyConfig?.lookback ?? 5))
    return generateLegacyMaSignals(series, lookback, strategyConfig)
  }

  const candles = strategyConfig.candles
  const ctx = buildUnifiedContext(series, candles)
  const warmup =
    strategyConfig.entryExitSplit
    && Array.isArray(strategyConfig.entryConditions)
    && strategyConfig.entryConditions.length > 0
    && Array.isArray(strategyConfig.exitConditions)
    && strategyConfig.exitConditions.length > 0
      ? Math.max(
          computeWarmupBars(strategyConfig.entryConditions),
          computeWarmupBars(strategyConfig.exitConditions),
        )
      : computeWarmupBars(conds)
  return runPositionLoop(series, strategyConfig, ctx, warmup)
}

/**
 * @param {Array<number>|Array<{time:number, price:number}>} prices
 */
export function generateSignalsFromPrices(prices, strategyConfig = {}) {
  const series = normalizePrices(prices)
  return generateSignalsFromSeries(series, strategyConfig)
}

/**
 * 동일 입력에 대해 미리보기·시뮬·검증이 같은 파이프라인을 쓰도록 한 번에 실행
 * @param {Array<number>|Array<{time:number, price:number}>} prices
 * @param {object} [strategyLike] normalizeStrategyPayload에 넣을 수 있는 전략 객체
 * @param {{
 *   candles?: object[],
 *   strategyConfig?: object,
 *   catalogStrategy?: { id?: string, symbol?: string, timeframe?: string },
 * }} [options]
 * - `strategyConfig`가 있으면 그대로 사용 (에디터에서 buildStrategyConfigFromConditions 등으로 만든 값)
 * - `catalogStrategy`가 있으면 카탈로그 기본 조건으로 구성
 * - 둘 다 없으면 `strategyLike`를 normalize 후 내 전략 경로
 */
export function runEnginePipeline(prices, strategyLike, options = {}) {
  let strategyConfig
  if (options.strategyConfig) {
    strategyConfig = options.strategyConfig
  } else if (options.catalogStrategy) {
    strategyConfig = buildCatalogStrategyEngineConfig(options.catalogStrategy, {
      candles: options.candles,
    })
  } else {
    const p = normalizeStrategyPayload(strategyLike ?? {})
    strategyConfig = buildEngineConfigFromUserStrategy(p, { candles: options.candles })
  }
  const signals = generateSignalsFromPrices(prices, strategyConfig)
  const trades = calculateTradeHistory(signals)
  const performance = calculatePerformance(trades)
  return {
    signals,
    trades,
    performance,
    strategyConfig,
  }
}

export function calculateTradeHistory(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return []

  const sorted = [...signals].sort((a, b) => {
    const ta = safeNum(a.time, 0)
    const tb = safeNum(b.time, 0)
    if (ta !== tb) return ta - tb
    if (a.type === b.type) return 0
    return a.type === 'EXIT' ? -1 : 1
  })
  const trades = []
  let open = null
  let id = 1

  for (const s of sorted) {
    if (s.type === 'ENTRY') {
      if (!open) {
        const w = s.positionSize != null && s.positionSize !== undefined
          ? safeNum(s.positionSize, 1)
          : 1
        open = {
          dir: s.direction,
          entry: s.price,
          entryTime: s.time,
          weight: Math.max(0, w),
          entryNote: s.note ?? '',
          entryId: s.id ?? null,
        }
      }
      continue
    }
    if (s.type === 'EXIT') {
      if (!open) continue
      const rawPct = pnlPct(open.dir, open.entry, s.price)
      const weight = open.weight > 0 ? open.weight : 1
      const pnl = rawPct * weight
      trades.push({
        id: String(id++),
        dir: open.dir,
        entry: open.entry,
        exit: s.price,
        entryTime: open.entryTime,
        exitTime: s.time,
        pnl: +pnl.toFixed(2),
        pnlRawPct: +rawPct.toFixed(4),
        weight,
        win: pnl >= 0,
        exitReason: s.exitReason ?? 'signal',
        entryNote: open.entryNote ?? '',
        exitNote: s.note ?? '',
        entrySignalId: open.entryId ?? null,
        exitSignalId: s.id ?? null,
      })
      open = null
    }
  }

  return trades
}

export function calculateOpenPosition(signals, currentPrice) {
  if (!Array.isArray(signals) || signals.length === 0) return null
  const cp = safeNum(currentPrice, NaN)
  if (!Number.isFinite(cp)) return null

  const sorted = [...signals].sort((a, b) => {
    const ta = safeNum(a.time, 0)
    const tb = safeNum(b.time, 0)
    if (ta !== tb) return ta - tb
    if (a.type === b.type) return 0
    return a.type === 'EXIT' ? -1 : 1
  })
  let open = null

  for (const s of sorted) {
    if (s.type === 'ENTRY') {
      const w = s.positionSize != null && s.positionSize !== undefined
        ? safeNum(s.positionSize, 1)
        : 1
      open = {
        type: s.direction,
        entryPrice: s.price,
        entryTime: s.time,
        weight: Math.max(0, w),
      }
    } else if (s.type === 'EXIT') {
      open = null
    }
  }

  if (!open) return null
  const rawPct = pnlPct(open.type, open.entryPrice, cp)
  const weight = open.weight > 0 ? open.weight : 1
  const pnl = rawPct * weight
  return {
    type: open.type,
    entryPrice: open.entryPrice,
    currentPrice: cp,
    pnlPct: +pnl.toFixed(2),
    pnlRawPct: +rawPct.toFixed(2),
    weight,
    entryTime: open.entryTime,
  }
}

export function calculatePerformance(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { roi: 0, winRate: 0, totalTrades: 0, mdd: 0 }
  }

  const totalTrades = trades.length
  const wins = trades.filter((t) => safeNum(t.pnl, 0) >= 0).length
  const winRate = (wins / totalTrades) * 100

  let equity = 100
  let peak = 100
  let maxDd = 0

  for (const t of trades) {
    equity *= 1 + safeNum(t.pnl, 0) / 100
    if (equity > peak) peak = equity
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
    if (dd > maxDd) maxDd = dd
  }

  const roi = equity - 100
  return {
    roi: +roi.toFixed(2),
    winRate: +winRate.toFixed(1),
    totalTrades,
    mdd: +maxDd.toFixed(2),
  }
}

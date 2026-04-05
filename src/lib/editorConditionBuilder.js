/**
 * 에디터에서 선택한 preset ID + 사용자 수치 → 엔진 조건 객체 배열
 */

import { normalizeConditions } from './strategyPayload'

function safeNum(v, fb) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

export const DEFAULT_COND_PARAMS = {
  ema_cross: { fastPeriod: 20, slowPeriod: 50 },
  ema_cross_fast: { fastPeriod: 5, slowPeriod: 13 },
  rsi_ob_os: { period: 14, oversold: 30, overbought: 70 },
  rsi_mid: { period: 14, mid: 50 },
  macd_cross: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bb_squeeze: { period: 20, mult: 2, widthThreshold: 0.06 },
  bb_touch: { period: 20, mult: 2 },
  volume_surge: { volumePeriod: 20, multiplier: 2 },
  obv_div: {},
}

/**
 * @param {string[]} selectedIds
 * @param {Record<string, object>} paramMap presetId → 부분 파라미터
 */
export function buildEngineConditionsFromEditor(selectedIds, paramMap = {}) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return []

  return selectedIds.map((id) => {
    const def = DEFAULT_COND_PARAMS[id] || {}
    const u = { ...def, ...(paramMap[id] || {}) }

    switch (id) {
      case 'ema_cross':
      case 'ema_cross_fast':
        return {
          indicator: 'EMA_CROSS',
          fastPeriod: safeNum(u.fastPeriod, id === 'ema_cross_fast' ? 5 : 20),
          slowPeriod: safeNum(u.slowPeriod, id === 'ema_cross_fast' ? 13 : 50),
          direction: 'BOTH',
          id,
        }
      case 'rsi_ob_os':
        return {
          indicator: 'RSI',
          period: safeNum(u.period, 14),
          crossoverZones: true,
          oversold: safeNum(u.oversold, 30),
          overbought: safeNum(u.overbought, 70),
          id,
        }
      case 'rsi_mid':
        return {
          indicator: 'RSI',
          period: safeNum(u.period, 14),
          crossoverMid: safeNum(u.mid, 50),
          id,
        }
      case 'macd_cross':
        return {
          indicator: 'MACD_CROSS',
          fastPeriod: safeNum(u.fastPeriod, 12),
          slowPeriod: safeNum(u.slowPeriod, 26),
          signalPeriod: safeNum(u.signalPeriod, 9),
          direction: 'BOTH',
          id,
        }
      case 'bb_touch':
        return {
          indicator: 'BB_TOUCH',
          period: safeNum(u.period, 20),
          mult: safeNum(u.mult ?? u.multiplier, 2),
          direction: 'BOTH',
          id,
        }
      case 'volume_surge':
        return {
          indicator: 'VOLUME_SURGE',
          volumePeriod: safeNum(u.volumePeriod ?? u.period, 20),
          multiplier: safeNum(u.multiplier ?? u.mult, 2),
          direction: 'BOTH',
          id,
        }
      case 'bb_squeeze': {
        const u = { ...DEFAULT_COND_PARAMS.bb_squeeze, ...(paramMap[id] || {}) }
        return {
          indicator: 'BB_SQUEEZE',
          period: safeNum(u.period, 20),
          mult: safeNum(u.mult ?? u.multiplier, 2),
          widthThreshold: safeNum(u.widthThreshold, 0.06),
          id,
        }
      }
      case 'obv_div':
      default:
        return { kind: 'preset', presetId: id, id }
    }
  })
}

/** 저장용: 엔진 객체 → 직렬화 가능한 조건 배열 (리치는 그대로, preset은 문자열 가능) */
export function engineConditionsToSaved(conditions) {
  if (!Array.isArray(conditions)) return []
  return conditions.map((c) => {
    if (typeof c === 'string') return { kind: 'preset', presetId: c, id: c }
    if (c && typeof c === 'object' && c.indicator) return { ...c }
    return c
  })
}

/**
 * DB/저장된 조건에서 에디터 paramMap 복원
 */
export function extractParamMapFromConditions(rawConditions) {
  const list = normalizeConditions(rawConditions)
  const out = {}
  for (const c of list) {
    if (!c || typeof c !== 'object') continue

    if (c.indicator === 'EMA_CROSS') {
      const pid = c.id || c.presetId || (
        safeNum(c.fastPeriod) === 5 && safeNum(c.slowPeriod) === 13
          ? 'ema_cross_fast'
          : 'ema_cross'
      )
      out[pid] = {
        fastPeriod: safeNum(c.fastPeriod, DEFAULT_COND_PARAMS.ema_cross.fastPeriod),
        slowPeriod: safeNum(c.slowPeriod, DEFAULT_COND_PARAMS.ema_cross.slowPeriod),
      }
      continue
    }

    const id = c.id || c.presetId
    if (!id) continue

    if (c.indicator === 'RSI' && c.crossoverZones) {
      out[id] = {
        period: safeNum(c.period, 14),
        oversold: safeNum(c.oversold, 30),
        overbought: safeNum(c.overbought, 70),
      }
    } else if (c.indicator === 'RSI' && c.crossoverMid != null) {
      out[id] = {
        period: safeNum(c.period, 14),
        mid: safeNum(c.crossoverMid, 50),
      }
    } else if (c.indicator === 'MACD_CROSS') {
      out[id] = {
        fastPeriod: safeNum(c.fastPeriod, 12),
        slowPeriod: safeNum(c.slowPeriod, 26),
        signalPeriod: safeNum(c.signalPeriod, 9),
      }
    } else if (c.indicator === 'BB_TOUCH') {
      out[id] = {
        period: safeNum(c.period, 20),
        mult: safeNum(c.mult ?? c.multiplier, 2),
      }
    } else if (c.indicator === 'VOLUME_SURGE') {
      out[id] = {
        volumePeriod: safeNum(c.volumePeriod, 20),
        multiplier: safeNum(c.multiplier, 2),
      }
    } else if (c.indicator === 'BB_SQUEEZE') {
      out[id] = {
        period: safeNum(c.period, 20),
        mult: safeNum(c.mult ?? c.multiplier, 2),
        widthThreshold: safeNum(c.widthThreshold, 0.06),
      }
    }
  }
  return out
}

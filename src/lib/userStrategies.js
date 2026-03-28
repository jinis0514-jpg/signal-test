/**
 * userStrategies.js
 * 사용자 직접 제작 전략 localStorage 유틸리티
 *
 * localStorage key: bb_user_strategies
 * 형태: UserStrategy[]
 */
import { seededRng, strToSeed } from './seedRandom'

const LS_KEY     = 'bb_user_strategies'
const LS_KEY_OLD = 'bb_strategies'          // 이전 키 (마이그레이션용)

/* ── UUID v4 ───────────────────────────────── */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/* ── 조건 배열 → 전략 유형 추론 ─────────────── */
const TREND_CONDS = ['ema_cross', 'ema_cross_fast', 'macd_cross', 'volume_surge', 'obv_div']
const RANGE_CONDS = ['rsi_ob_os', 'rsi_mid', 'bb_touch']
const BREAK_CONDS = ['bb_squeeze']

function inferType(conditions = []) {
  const t = conditions.filter((c) => TREND_CONDS.includes(c)).length
  const r = conditions.filter((c) => RANGE_CONDS.includes(c)).length
  const b = conditions.filter((c) => BREAK_CONDS.includes(c)).length
  if (b > 0 && b >= t && b >= r) return { type: 'breakout', typeLabel: '돌파'     }
  if (r > t)                      return { type: 'range',    typeLabel: '레인지'   }
  return                                 { type: 'trend',    typeLabel: '추세 추종' }
}

/* ── asset → 연결 sim/val 전략 ID ─────────── */
export const ASSET_TO_SIM_ID = {
  BTC: 'btc-trend',
  ETH: 'eth-range',
  SOL: 'sol-momentum',
  ALT: 'btc-trend',
}

/* ── seed 기반 mock 메트릭 ──────────────────── */
function generateMockMetrics(name, riskLevel) {
  const rng  = seededRng(strToSeed((name || 'default') + (riskLevel || 'mid')))
  const risk = { low: 0.6, mid: 1.0, high: 1.6 }[riskLevel] ?? 1.0
  return {
    roi:     +(10 + rng() * 25 * risk).toFixed(1),
    winRate: +(48 + rng() * 25).toFixed(1),
    mdd:     -(+(4 + rng() * 12 * risk).toFixed(1)),
    trades:  Math.floor(25 + rng() * 80),
    roi7d:   +(rng() * 8 - 2).toFixed(1),
  }
}

/* ── localStorage 로드 ──────────────────────── */
export function loadUserStrategies() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
    /* 이전 키 마이그레이션 */
    const oldRaw = localStorage.getItem(LS_KEY_OLD)
    if (oldRaw) {
      const old = JSON.parse(oldRaw)
      if (Array.isArray(old) && old.length > 0) {
        localStorage.setItem(LS_KEY, oldRaw)
        try { localStorage.removeItem(LS_KEY_OLD) } catch {}
        return old
      }
    }
    return []
  } catch {
    return []
  }
}

/* ── localStorage 저장 ──────────────────────── */
export function saveUserStrategies(strategies) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(strategies))
  } catch {}
}

/**
 * Upsert: id가 같은 전략이 있으면 업데이트, 없으면 신규 추가
 * @param {object} data   EditorPage 폼 데이터 (id 있으면 업데이트)
 * @param {'draft'|'submitted'} status
 * @returns {object}  저장된 전략 객체
 */
export function upsertUserStrategy(data, status = 'submitted') {
  const { type, typeLabel } = inferType(data.conditions ?? [])
  const asset               = (data.asset || 'BTC').toUpperCase()
  const metrics             = generateMockMetrics(data.name, data.riskLevel)

  const strategy = {
    /* ID: 신규면 생성, 업데이트면 유지 */
    id:        data.id || `user-${uuid()}`,
    createdAt: data.createdAt || Date.now(),
    updatedAt: Date.now(),

    /* 폼 데이터 */
    name:         (data.name || '이름 없는 전략').trim(),
    tags:         data.tags ?? [],
    asset,
    assetType:    asset.toLowerCase(),
    timeframe:    data.timeframe || '1h',
    mode:         data.mode     || 'nocode',
    type,
    typeLabel,
    riskLevel:    data.riskLevel    || 'mid',
    conditions:   data.conditions   ?? [],
    stopType:     data.stopType     || 'fixed_pct',
    stopValue:    data.stopValue    || '',
    takeProfitPct: data.takeProfitPct || '',
    posSize:      data.posSize      || '',
    maxOpenPos:   data.maxOpenPos   || '1',
    code:         data.code         || '',

    /* 메타 */
    creator:        'me',
    status,
    isUserStrategy: true,

    /* mock 성과 */
    ...metrics,

    /* StrategyCard / MarketPage 호환 */
    ctaStatus:      'not_started',
    recommendBadge: null,
    fitSummary:     `직접 제작한 ${typeLabel} 전략`,
    fitDetail:      '백테스트 완료 후 적합도가 표시됩니다.',
    author:         '나',
    desc:           data.name ? `${data.name} — 사용자가 직접 제작한 전략입니다.` : '사용자가 직접 제작한 전략입니다.',
    recentSignals:  [],
    signals:        0,
    avgHolding:     '—',
  }

  const existing = loadUserStrategies()
  const idx      = existing.findIndex((s) => s.id === strategy.id)
  const updated  = idx >= 0
    ? existing.map((s, i) => (i === idx ? strategy : s))
    : [strategy, ...existing]

  saveUserStrategies(updated)
  return strategy
}

/** 하위 호환 alias */
export function addUserStrategy(data) {
  return upsertUserStrategy(data, 'submitted')
}

/* ── 검수 상태 정의 ─────────────────────────── */
export const REVIEW_STATUS = {
  draft:        { label: '작성 중',  badge: 'default', market: false },
  submitted:    { label: '검토 대기', badge: 'info',    market: false },
  under_review: { label: '검토 중',  badge: 'warning',  market: false },
  approved:     { label: '승인됨',   badge: 'success',  market: true  },
  rejected:     { label: '반려됨',   badge: 'danger',   market: false },
}

/**
 * 특정 전략 상태 변경 + reviewNote 선택 저장
 * @param {string} id
 * @param {string} status
 * @param {string} [reviewNote]
 * @returns {object[]}  업데이트된 전략 배열
 */
export function updateStrategyStatus(id, status, reviewNote) {
  const strategies = loadUserStrategies()
  const updated = strategies.map((s) => {
    if (s.id !== id) return s
    return {
      ...s,
      status,
      updatedAt: Date.now(),
      ...(reviewNote !== undefined ? { reviewNote } : {}),
    }
  })
  saveUserStrategies(updated)
  return updated
}

export function approveStrategy(id) {
  return updateStrategyStatus(id, 'approved', '')
}

export function rejectStrategy(id, note) {
  return updateStrategyStatus(id, 'rejected', note)
}

export function markUnderReview(id) {
  return updateStrategyStatus(id, 'under_review')
}

/** ID가 user 전략인지 여부 */
export function isUserStrategyId(id) {
  return typeof id === 'string' && id.startsWith('user-')
}

/** ID로 user 전략 찾기 */
export function getUserStrategyById(id) {
  return loadUserStrategies().find((s) => s.id === id) ?? null
}

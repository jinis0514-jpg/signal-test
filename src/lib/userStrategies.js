/**
 * userStrategies.js
 * 사용자 전략 — Supabase 로그인 시 DB가 단일 소스(SSOT), localStorage는
 * 오프라인·초기 페인트용 캐시 및 비로그인 로컬 편집용.
 *
 * localStorage key: bb_user_strategies
 * 형태: UserStrategy[]
 */
import { seededRng, strToSeed } from './seedRandom'
import {
  normalizeStrategyPayload,
  extractConditionIds,
  DEFAULT_RISK_CONFIG,
} from './strategyPayload'
import { buildCanonicalCodeFromPayload } from './strategyCodeExport'
import { normalizeAltValidationSymbols } from './assetValidationUniverse'

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

/* ── 조건 배열 → (실행)전략 스타일 추론 ─────────────── */
const TREND_CONDS = ['ema_cross', 'ema_cross_fast', 'macd_cross', 'volume_surge', 'obv_div']
const RANGE_CONDS = ['rsi_ob_os', 'rsi_mid', 'bb_touch']
const BREAK_CONDS = ['bb_squeeze']

function inferStrategyType(conditions = []) {
  const ids = extractConditionIds(conditions)
  const t = ids.filter((c) => TREND_CONDS.includes(c)).length
  const r = ids.filter((c) => RANGE_CONDS.includes(c)).length
  const b = ids.filter((c) => BREAK_CONDS.includes(c)).length
  if (b > 0 && b >= t && b >= r) return { strategyType: 'breakout', strategyTypeLabel: '돌파' }
  if (r > t)                      return { strategyType: 'range',    strategyTypeLabel: '레인지' }
  return                                 { strategyType: 'trend',    strategyTypeLabel: '추세 추종' }
}

/* ── asset → 연결 sim/val 전략 ID ─────────── */
export const ASSET_TO_SIM_ID = {
  BTC: 'btc-trend',
  ETH: 'eth-range',
  SOL: 'sol-momentum',
  ALT: 'alt-basket',
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
  const p = normalizeStrategyPayload(data)
  const kind = String(p.type ?? data?.type ?? 'signal')
  const { strategyType, strategyTypeLabel } = inferStrategyType(p.conditions)
  const asset = (p.asset || 'BTC').toUpperCase()
  const metricsObj = generateMockMetrics(p.name, p.riskLevel)
  const risk = { ...DEFAULT_RISK_CONFIG, ...p.risk_config }
  const canonicalCode = buildCanonicalCodeFromPayload(data)
  const altValidationSymbols = normalizeAltValidationSymbols(
    p.altValidationSymbols ?? data?.alt_validation_symbols,
  )

  const strategy = {
    id:        p.id || data.id || `user-${uuid()}`,
    createdAt: data.createdAt || p.createdAt || Date.now(),
    updatedAt: Date.now(),

    name:         p.name,
    description:  p.description,
    tags:         p.tags,
    asset,
    assetType:    asset.toLowerCase(),
    timeframe:    p.timeframe || '1h',
    mode:         'code',
    type: kind === 'method' ? 'method' : 'signal',
    typeLabel: kind === 'method' ? '매매법' : '전략',
    strategyType,
    strategyTypeLabel,
    riskLevel:    p.riskLevel || 'mid',
    conditions:   p.conditions,
    conditionLogic: p.conditionLogic ?? null,
    risk_config:  risk,
    code:         canonicalCode,
    altValidationSymbols,

    metrics: {
      roi: metricsObj.roi,
      winRate: metricsObj.winRate,
      mdd: metricsObj.mdd,
      trades: metricsObj.trades,
      roi7d: metricsObj.roi7d,
    },
    price_tier: data.price_tier ?? p.price_tier ?? 'free',

    method_pdf_path: p.method_pdf_path ?? data?.method_pdf_path ?? null,
    method_pdf_preview_path: p.method_pdf_preview_path ?? data?.method_pdf_preview_path ?? null,
    method_preview_mode: p.method_preview_mode ?? data?.method_preview_mode ?? 'none',
    linked_signal_strategy_id: p.linked_signal_strategy_id ?? data?.linked_signal_strategy_id ?? null,

    stopType:     risk.stopType ?? 'fixed_pct',
    stopValue:    risk.stopValue ?? '',
    takeProfitPct: risk.takeProfitPct ?? '',
    posSize:      risk.posSize ?? '',
    maxOpenPos:   risk.maxOpenPos ?? '1',
    minSignalGap: risk.minSignalGap ?? '',
    allowReentry: !!risk.allowReentry,

    creator:        'me',
    status,
    is_public: status === 'approved' || status === 'published',
    isUserStrategy: true,

    ...metricsObj,

    ctaStatus:      'not_started',
    recommendBadge: null,
    fitSummary:     kind === 'method'
      ? 'PDF 매매법 — 연결 전략으로 바로 실행'
      : `직접 제작한 ${strategyTypeLabel} 전략`,
    fitDetail:      '백테스트 완료 후 적합도가 표시됩니다.',
    author:         '나',
    desc:           p.description || `${p.name} — 사용자가 직접 제작한 전략입니다.`,
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
  draft:        { label: '작성 중',      badge: 'default', market: false },
  submitted:    { label: '검수 대기',    badge: 'info',    market: false },
  under_review: { label: '검수 중',      badge: 'warning', market: false },
  approved:     { label: '마켓 승인',  badge: 'success', market: true  },
  rejected:     { label: '반려',         badge: 'danger',  market: false },
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

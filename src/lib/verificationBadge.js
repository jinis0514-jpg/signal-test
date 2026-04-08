/**
 * 전략 인증 배지 3단계 판정 로직
 *
 * backtest_only  → 백테스트 전략
 * live_verified  → 실시간 검증 전략 (7일+, 10개+ 시그널)
 * trade_verified → 실거래 인증 전략 (매칭률 60%+, 가격오차 0.5%↓, 방향 80%+)
 */

export const VERIFICATION_LEVELS = {
  BACKTEST_ONLY: 'backtest_only',
  LIVE_VERIFIED: 'live_verified',
  TRADE_VERIFIED: 'trade_verified',
}

const BADGE_CONFIG = {
  [VERIFICATION_LEVELS.BACKTEST_ONLY]: {
    level: VERIFICATION_LEVELS.BACKTEST_ONLY,
    label: '백테스트 전략',
    shortLabel: '백테스트',
    color: 'slate',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-600 dark:text-slate-300',
    borderClass: 'border-slate-300 dark:border-slate-600',
    dotClass: 'bg-slate-400',
    rank: 0,
  },
  [VERIFICATION_LEVELS.LIVE_VERIFIED]: {
    level: VERIFICATION_LEVELS.LIVE_VERIFIED,
    label: '실시간 검증 전략',
    shortLabel: '실시간 검증',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-600',
    dotClass: 'bg-blue-500',
    rank: 1,
  },
  [VERIFICATION_LEVELS.TRADE_VERIFIED]: {
    level: VERIFICATION_LEVELS.TRADE_VERIFIED,
    label: '실거래 인증 전략',
    shortLabel: '실거래 인증',
    color: 'emerald',
    bgClass: 'bg-emerald-50 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-600',
    dotClass: 'bg-emerald-500',
    rank: 2,
  },
}

// ── 실시간 검증 최소 조건 ───────────────────────────────────
const LIVE_VERIFIED_MIN_DAYS = 7
const LIVE_VERIFIED_MIN_SIGNALS = 10

// ── 실거래 인증 최소 조건 ───────────────────────────────────
const TRADE_VERIFIED_MIN_MATCH_RATE = 60
const TRADE_VERIFIED_MAX_PRICE_DIFF = 0.5
const TRADE_VERIFIED_MIN_SIDE_MATCH = 80

export function getVerificationBadgeConfig(level) {
  return BADGE_CONFIG[level] ?? BADGE_CONFIG[VERIFICATION_LEVELS.BACKTEST_ONLY]
}

export function getAllBadgeConfigs() {
  return Object.values(BADGE_CONFIG)
}

export function isEligibleForLiveVerified({ signalCount, daysSinceLive }) {
  return (
    Number.isFinite(daysSinceLive) &&
    daysSinceLive >= LIVE_VERIFIED_MIN_DAYS &&
    Number.isFinite(signalCount) &&
    signalCount >= LIVE_VERIFIED_MIN_SIGNALS
  )
}

export function isEligibleForTradeVerified({ matchRate, avgPriceDiff, sideMatchRate }) {
  const mr = Number(matchRate ?? 0)
  const pd = Number(avgPriceDiff ?? Infinity)
  const sr = Number(sideMatchRate ?? 0)

  return (
    mr >= TRADE_VERIFIED_MIN_MATCH_RATE &&
    pd <= TRADE_VERIFIED_MAX_PRICE_DIFF &&
    sr >= TRADE_VERIFIED_MIN_SIDE_MATCH
  )
}

/**
 * strategy_verification_summary 기반으로 배지 레벨 판정
 * @param {object} summary  strategy_verification_summary row
 * @returns {string} VERIFICATION_LEVELS 값
 */
export function computeVerificationLevel(summary) {
  if (!summary) return VERIFICATION_LEVELS.BACKTEST_ONLY

  // DB에 이미 계산된 값이 있으면 사용
  if (summary.verified_badge_level && summary.verified_badge_level !== 'backtest_only') {
    return summary.verified_badge_level
  }

  return VERIFICATION_LEVELS.BACKTEST_ONLY
}

/**
 * 전략 객체에서 배지 정보를 빠르게 추출
 * 프론트 표시용: is_live_tracked / is_trade_verified / verified_badge_level 읽기
 */
export function getStrategyVerificationBadge(strategy) {
  const level =
    strategy?.verified_badge_level ??
    VERIFICATION_LEVELS.BACKTEST_ONLY
  return getVerificationBadgeConfig(level)
}

/**
 * 프론트에서 읽을 수 있는 인증 상태 요약
 */
export function extractVerificationDisplayFields(strategy, summary) {
  const s = strategy ?? {}
  const v = summary ?? {}
  return {
    is_live_tracked: s.is_live_tracked ?? false,
    is_trade_verified: s.is_trade_verified ?? false,
    verified_badge_level: v.verified_badge_level ?? s.verified_badge_level ?? 'backtest_only',
    match_rate: v.match_rate ?? 0,
    avg_price_diff_pct: v.avg_price_diff_pct ?? 0,
    verified_return_pct: v.verified_return_pct ?? 0,
  }
}

export const THRESHOLDS = {
  LIVE_VERIFIED_MIN_DAYS,
  LIVE_VERIFIED_MIN_SIGNALS,
  TRADE_VERIFIED_MIN_MATCH_RATE,
  TRADE_VERIFIED_MAX_PRICE_DIFF,
  TRADE_VERIFIED_MIN_SIDE_MATCH,
}

/**
 * 유저 플랜 유틸리티
 *
 * user 상태 형태:
 * {
 *   plan:                'free' | 'trial' | 'subscribed',
 *   trialDaysLeft:       7,                         // trial 상태일 때 남은 일수
 *   unlockedStrategyIds: ['btc-trend'],             // 접근 허용된 시뮬레이션 전략 ID 목록
 * }
 */

export const TRIAL_DAYS        = 7
export const FREE_SIGNAL_LIMIT = 3

/** 무료 접근 가능한 전략 ID */
export const FREE_SIM_ID    = 'btc-trend'
export const FREE_MARKET_ID = 's1'

/** 초기 user 상태 */
export const INITIAL_USER = {
  plan:                'free',
  trialDaysLeft:       TRIAL_DAYS,
  unlockedStrategyIds: ['btc-trend'],
}

/**
 * 시뮬레이션 / 검증 전략이 잠겨있는지
 * - free 플랜이면서 unlockedStrategyIds에 없는 경우 잠금
 */
export function isSimLocked(strategyId, user) {
  if (user.plan !== 'free') return false
  return !user.unlockedStrategyIds.includes(strategyId)
}

/**
 * 마켓 전략이 잠겨있는지
 * - free 플랜이면서 기본 무료 전략(s1)이 아닌 경우 잠금
 */
export function isMarketLocked(marketId, user) {
  if (user.plan !== 'free') return false
  return marketId !== FREE_MARKET_ID
}

/**
 * 노출할 시그널 최대 개수
 * - subscribed만 전체, 나머지는 3개 제한
 */
export function getSignalLimit(user) {
  return user.plan === 'subscribed' ? Infinity : FREE_SIGNAL_LIMIT
}

/** 플랜 라벨 (Topbar 표시용) */
export function getPlanLabel(user) {
  if (user.plan === 'subscribed') return '구독 중'
  if (user.plan === 'trial')      return `체험 ${user.trialDaysLeft}일 남음`
  return '무료'
}

/**
 * 체험 긴박감 텍스트 색상
 * 5~7일 기본 / 3일 이하 주황 / 1일 빨강
 */
export function getTrialUrgencyClass(trialDaysLeft) {
  if (trialDaysLeft <= 1) return 'text-red-600 dark:text-red-500'
  if (trialDaysLeft <= 3) return 'text-amber-600 dark:text-amber-500'
  return 'text-slate-500 dark:text-slate-400'
}

/**
 * 체험 긴박감 배지 배경/보더 색상
 */
export function getTrialUrgencyBg(trialDaysLeft) {
  if (trialDaysLeft <= 1)
    return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/40'
  if (trialDaysLeft <= 3)
    return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40'
  return 'bg-slate-50 border-slate-200 dark:bg-gray-800/40 dark:border-gray-700'
}

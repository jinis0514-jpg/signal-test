/**
 * 전략별 시그널 알림 설정 (user.strategyNotifySettings 에 저장)
 * 기본값: 모두 ON
 */

/** @typedef {{ all: boolean, long: boolean, short: boolean, exit: boolean }} StrategyNotifySettings */

export const DEFAULT_STRATEGY_NOTIFY = Object.freeze({
  all: true,
  long: true,
  short: true,
  exit: true,
})

/**
 * @param {object} [raw]
 * @returns {StrategyNotifySettings}
 */
export function normalizeStrategyNotifySettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STRATEGY_NOTIFY }
  }
  if (raw.enabled === false) {
    return { all: false, long: false, short: false, exit: false }
  }
  return {
    all: raw.all !== false,
    long: raw.long !== false,
    short: raw.short !== false,
    exit: raw.exit !== false,
  }
}

/**
 * @param {object} user
 * @param {string} strategyId
 * @returns {StrategyNotifySettings}
 */
export function getStrategyNotifySettings(user, strategyId) {
  const raw = user?.strategyNotifySettings?.[strategyId]
  return normalizeStrategyNotifySettings(raw)
}

/**
 * @param {StrategyNotifySettings} settings
 * @param {'long'|'short'|'exit'} kind
 */
export function shouldSendStrategySignalNotification(settings, kind) {
  const s = normalizeStrategyNotifySettings(settings)
  if (!s.all) return false
  if (kind === 'long') return s.long
  if (kind === 'short') return s.short
  if (kind === 'exit') return s.exit
  return false
}

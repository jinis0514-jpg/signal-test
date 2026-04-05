import { isSimLocked } from './userPlan'
import { isUserStrategyId } from './userStrategies'
import {
  getStrategyNotifySettings,
  shouldSendStrategySignalNotification,
} from './strategyNotificationSettings'

/**
 * 시그널 알림 대상 여부 (카탈로그: 이용·언락된 SIM 전략만 / 사용자 전략: 목록에 있는 본인 전략만)
 */
export function isStrategySignalSubscribed({ strategyId, user, userStrategyIds }) {
  const sid = String(strategyId ?? '')
  if (!sid || !user) return false
  if (isUserStrategyId(sid)) {
    const set =
      userStrategyIds instanceof Set
        ? userStrategyIds
        : new Set(Array.isArray(userStrategyIds) ? userStrategyIds : [])
    return set.has(sid)
  }
  return !isSimLocked(sid, user)
}

/**
 * 브라우저·인앱·DB 시그널 알림 공통 게이트
 * 1) 로그인 2) 구독(이용권) 3) 전략별 알림 설정
 *
 * @param {{
 *   currentUser: { id?: string } | null,
 *   user: object,
 *   strategyId: string,
 *   kind: 'long'|'short'|'exit',
 *   userStrategyIds?: Set<string>|string[],
 * }} p
 */
export function shouldNotifySignal(p) {
  const { currentUser, user, strategyId, kind, userStrategyIds } = p
  if (!currentUser?.id) return false
  if (!user) return false
  if (!isStrategySignalSubscribed({ strategyId, user, userStrategyIds })) return false
  const st = getStrategyNotifySettings(user, strategyId)
  return shouldSendStrategySignalNotification(st, kind)
}

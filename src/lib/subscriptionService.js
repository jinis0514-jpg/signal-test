import { fetchMyUserPlan, mergeUserPlanIntoUser } from './userPlanService'

/**
 * 레거시 호환 파일.
 * 결제/플랜 상태 변경은 프론트에서 수행하지 않으며, 서버 웹훅만 허용한다.
 */
export class SubscriptionServiceError extends Error {
  constructor(message, code = 'READ_ONLY') {
    super(message)
    this.name = 'SubscriptionServiceError'
    this.code = code
  }
}

export async function fetchMySubscription(userId) {
  return fetchMyUserPlan(userId)
}

export function mergeSubscriptionIntoUser(localUser, row, now = Date.now()) {
  return mergeUserPlanIntoUser(localUser, row, now)
}

function readonlyError() {
  return new SubscriptionServiceError(
    '플랜/결제 상태는 서버 웹훅에서만 변경할 수 있습니다. 프론트 직접 갱신은 허용되지 않습니다.',
    'READ_ONLY',
  )
}

export async function startTrial() {
  throw readonlyError()
}

export async function startPaidPlan() {
  throw readonlyError()
}

export async function cancelMySubscription() {
  throw readonlyError()
}

export async function upsertMySubscription() {
  throw readonlyError()
}


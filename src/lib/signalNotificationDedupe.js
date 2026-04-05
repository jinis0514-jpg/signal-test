/**
 * 시그널 알림 전역 중복 방지 (세션 동안 동일 시그널 1회만)
 * — 인앱 / OS / Supabase insert 경로가 같은 키를 공유
 */

const MAX_KEYS = 4000

/** @type {Set<string>} */
const sentSignalKeys = new Set()

/**
 * @param {string} strategyId
 * @param {{ id?: string, type?: string, time?: number, direction?: string, price?: number }} signal
 */
export function makeSignalNotifyKey(strategyId, signal) {
  const sid = String(strategyId ?? '')
  const sigId = signal?.id
  if (sigId != null && String(sigId).length > 0) {
    return `${sid}::${sigId}`
  }
  return `${sid}::${signal?.type}|${signal?.time}|${signal?.direction ?? ''}|${signal?.price ?? ''}`
}

function trimKeys() {
  if (sentSignalKeys.size <= MAX_KEYS) return
  const drop = Math.floor(MAX_KEYS / 2)
  let n = 0
  for (const k of sentSignalKeys) {
    sentSignalKeys.delete(k)
    n += 1
    if (n >= drop) break
  }
}

/**
 * 동일 시그널에 대한 알림이 아직 없으면 true 반환 후 키 등록.
 * @returns {boolean}
 */
export function tryConsumeSignalNotifyOnce(strategyId, signal) {
  const k = makeSignalNotifyKey(strategyId, signal)
  if (sentSignalKeys.has(k)) return false
  sentSignalKeys.add(k)
  trimKeys()
  return true
}

/** 훅 등에서 이미 소비된 시그널이면 true (Supabase 등 두 번째 경로 생략용) */
export function isSignalNotifyKeyRecorded(strategyId, signal) {
  return sentSignalKeys.has(makeSignalNotifyKey(strategyId, signal))
}

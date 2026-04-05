import { supabase, isSupabaseConfigured } from './supabase'
import { TRIAL_DAYS } from './userPlan'

/** mock 유료 구독 기간(일) — 이후 Stripe 등으로 대체 */
export const PAID_PLAN_PERIOD_DAYS = 30

export class SubscriptionServiceError extends Error {
  /**
   * @param {string} message
   * @param {string} code NO_SUPABASE | NO_USER | ALREADY_TRIAL | ALREADY_PAID | NETWORK | UNKNOWN
   */
  constructor(message, code = 'UNKNOWN') {
    super(message)
    this.name = 'SubscriptionServiceError'
    this.code = code
  }
}

function toMillis(iso) {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * DB 행 → UI/권한용 user 필드 병합 (단일 판정入口)
 * - row 없음: effective plan = free (DB 조회 결과 기준)
 * - trial + expires_at 경과 → free
 * - subscribed + status expired/canceled → free (즉시 유료 기능 해제)
 * - trialDaysLeft: expires_at 기준
 *
 * @param {object | null} localUser
 * @param {object | null} row subscriptions 테이블 행
 * @param {number} [now]
 */
export function mergeSubscriptionIntoUser(localUser, row, now = Date.now()) {
  const base = localUser && typeof localUser === 'object' ? localUser : {}

  if (!row) {
    return {
      ...base,
      plan: 'free',
      trialDaysLeft: TRIAL_DAYS,
      subscriptionExpiresAt: null,
      subscriptionStartedAt: null,
      subscriptionStatus: null,
      subscriptionRecordPlan: null,
      subscriptionSource: 'remote',
      /** DB에 티어 컬럼이 없을 때 클라이언트 표시용 — free면 무시 */
      billingTier: null,
    }
  }

  const exp = toMillis(row.expires_at)
  const expiredByTime = exp != null && exp <= now
  const statusInactive = row.status === 'expired' || row.status === 'canceled'

  let plan = row.plan
  if (expiredByTime || statusInactive) {
    plan = 'free'
  }

  let trialDaysLeft = base.trialDaysLeft ?? TRIAL_DAYS
  if (plan === 'trial' && exp != null && !expiredByTime) {
    trialDaysLeft = Math.max(0, Math.ceil((exp - now) / 86_400_000))
  } else if (plan !== 'trial') {
    trialDaysLeft = TRIAL_DAYS
  }

  return {
    ...base,
    plan,
    trialDaysLeft,
    subscriptionExpiresAt: row.expires_at,
    subscriptionStartedAt: row.started_at,
    subscriptionStatus: row.status,
    subscriptionRecordPlan: row.plan,
    subscriptionSource: 'remote',
    /** subscribed일 때만 pro/premium 구분 (Stripe 연동 시 서버 메타로 대체 가능) */
    billingTier: plan === 'subscribed' ? (base.billingTier ?? 'pro') : null,
  }
}

/**
 * 로그인 사용자의 subscriptions 행 1건 조회 (user_id unique)
 */
export async function fetchMySubscription(userId) {
  if (!isSupabaseConfigured() || !supabase || !userId) return null
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id,user_id,plan,status,started_at,expires_at,created_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

/**
 * 조회 + 병합 한 번에 (App / 마이페이지 새로고침용)
 * @param {string} userId
 * @param {object | null} localUser
 */
export async function refreshMySubscription(userId, localUser) {
  if (!userId) {
    throw new SubscriptionServiceError('로그인이 필요합니다.', 'NO_USER')
  }
  try {
    const row = await fetchMySubscription(userId)
    return mergeSubscriptionIntoUser(localUser, row)
  } catch (e) {
    if (e instanceof SubscriptionServiceError) throw e
    const msg = e?.message ?? '구독 정보를 불러오지 못했습니다.'
    throw new SubscriptionServiceError(
      typeof msg === 'string' ? msg : '네트워크 오류가 발생했습니다.',
      'NETWORK',
    )
  }
}

function assertSupabaseUser(userId) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new SubscriptionServiceError(
      'Supabase가 설정되지 않았습니다. 환경 변수를 확인해 주세요.',
      'NO_SUPABASE',
    )
  }
  if (!userId) {
    throw new SubscriptionServiceError('로그인이 필요합니다.', 'NO_USER')
  }
}

function isActiveNotExpired(row, now) {
  if (!row || row.status !== 'active') return false
  const exp = toMillis(row.expires_at)
  if (exp == null) return true
  return exp > now
}

/**
 * 7일 무료 체험 시작/재시작 (mock 결제 없음)
 * - 이미 active trial 이고 미만료 → 거부
 * - 이미 active subscribed 이고 미만료 → 거부
 * - 만료/해지 후 → 새 trial 행으로 갱신
 */
export async function startTrial(userId) {
  assertSupabaseUser(userId)
  const now = Date.now()
  const row = await fetchMySubscription(userId).catch((e) => {
    throw new SubscriptionServiceError(
      e?.message ?? '구독 정보를 불러오지 못했습니다.',
      'NETWORK',
    )
  })

  if (row && isActiveNotExpired(row, now)) {
    if (row.plan === 'trial') {
      throw new SubscriptionServiceError(
        '이미 체험 중입니다. 만료 후 다시 시작할 수 있습니다.',
        'ALREADY_TRIAL',
      )
    }
    if (row.plan === 'subscribed') {
      throw new SubscriptionServiceError(
        '이미 유료 구독 중입니다. 체험 대신 구독 연장을 이용해 주세요.',
        'ALREADY_PAID',
      )
    }
  }

  const startedAt = new Date(now).toISOString()
  const expiresAt = new Date(now + TRIAL_DAYS * 86_400_000).toISOString()

  if (row?.id) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan: 'trial',
        status: 'active',
        started_at: startedAt,
        expires_at: expiresAt,
        updated_at: startedAt,
      })
      .eq('id', row.id)
      .select()
      .single()
    if (error) throw new SubscriptionServiceError(error.message ?? '체험 저장 실패', 'UNKNOWN')
    return data
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan: 'trial',
      status: 'active',
      started_at: startedAt,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw new SubscriptionServiceError(error.message ?? '체험 생성 실패', 'UNKNOWN')
  return data
}

/**
 * 유료 플랜 mock 활성화 (30일) — 이후 결제 웹훅에서 동일 패치 호출 가능
 * @param {string} userId
 * @param {string} [planName]
 */
export async function startPaidPlan(userId, planName = 'subscribed') {
  assertSupabaseUser(userId)
  const now = Date.now()
  const row = await fetchMySubscription(userId).catch((e) => {
    throw new SubscriptionServiceError(
      e?.message ?? '구독 정보를 불러오지 못했습니다.',
      'NETWORK',
    )
  })

  if (row && isActiveNotExpired(row, now) && row.plan === 'subscribed') {
    throw new SubscriptionServiceError(
      '이미 유료 구독이 활성화되어 있습니다.',
      'ALREADY_PAID',
    )
  }

  const startedAt = new Date(now).toISOString()
  const expiresAt = new Date(now + PAID_PLAN_PERIOD_DAYS * 86_400_000).toISOString()

  if (row?.id) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan: planName,
        status: 'active',
        started_at: startedAt,
        expires_at: expiresAt,
        updated_at: startedAt,
      })
      .eq('id', row.id)
      .select()
      .single()
    if (error) throw new SubscriptionServiceError(error.message ?? '구독 저장 실패', 'UNKNOWN')
    return data
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan: planName,
      status: 'active',
      started_at: startedAt,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw new SubscriptionServiceError(error.message ?? '구독 생성 실패', 'UNKNOWN')
  return data
}

/**
 * 구독 해지 — 행은 유지, status만 canceled → merge 시 free
 */
export async function cancelMySubscription(userId) {
  assertSupabaseUser(userId)
  const row = await fetchMySubscription(userId).catch((e) => {
    throw new SubscriptionServiceError(
      e?.message ?? '구독 정보를 불러오지 못했습니다.',
      'NETWORK',
    )
  })
  if (!row?.id) {
    throw new SubscriptionServiceError('취소할 구독 정보가 없습니다.', 'UNKNOWN')
  }
  const ts = new Date().toISOString()
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: ts,
    })
    .eq('id', row.id)
    .select()
    .single()
  if (error) throw new SubscriptionServiceError(error.message ?? '해지 처리 실패', 'UNKNOWN')
  return data
}

/**
 * @deprecated 새 코드는 startTrial / startPaidPlan 사용
 * 결제 연동 전 수동 upsert용 저수준 API
 */
export async function upsertMySubscription(userId, { plan, expiresAt = null }) {
  if (!isSupabaseConfigured() || !supabase || !userId) return null

  const existing = await fetchMySubscription(userId)
  const ts = new Date().toISOString()
  const patch = {
    plan,
    status: 'active',
    started_at: ts,
    expires_at: expiresAt,
    updated_at: ts,
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan,
      status: 'active',
      started_at: ts,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

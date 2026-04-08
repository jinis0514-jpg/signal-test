import { supabase, isSupabaseConfigured } from './supabase'

export class UserPlanServiceError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message)
    this.name = 'UserPlanServiceError'
    this.code = code
  }
}

function toMillis(iso) {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

function isActivePlanRow(row, now = Date.now()) {
  if (!row) return false
  const status = String(row.status ?? '').toLowerCase()
  if (status !== 'active' && status !== 'trialing') return false
  const end = toMillis(row.current_period_end)
  if (end == null) return true
  return end > now
}

export async function fetchMyUserPlan(userId) {
  if (!isSupabaseConfigured() || !supabase || !userId) return null
  const { data, error } = await supabase
    .from('user_plans')
    .select('id,user_id,plan,status,started_at,current_period_start,current_period_end,cancel_at_period_end,source,updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export function mergeUserPlanIntoUser(localUser, row, now = Date.now()) {
  const base = localUser && typeof localUser === 'object' ? localUser : {}
  const active = isActivePlanRow(row, now)
  const rawPlan = active ? String(row?.plan ?? 'free').toLowerCase() : 'free'
  const nextPlan = ['free', 'standard', 'pro', 'premium'].includes(rawPlan) ? rawPlan : 'free'
  const periodEnd = row?.current_period_end ?? null

  return {
    ...base,
    plan: nextPlan,
    subscriptionExpiresAt: periodEnd,
    subscriptionStartedAt: row?.started_at ?? null,
    subscriptionStatus: row?.status ?? null,
    subscriptionRecordPlan: row?.plan ?? null,
    subscriptionSource: 'remote',
    billingTier: null,
  }
}


import { supabase, isSupabaseConfigured } from './supabase'

function mustSupa() {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
}

export async function getMyStrategies(userId) {
  if (!isSupabaseConfigured() || !supabase) return []
  if (!userId) return []
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('creator_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getApprovedStrategies() {
  if (!isSupabaseConfigured() || !supabase) return []
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .in('status', ['approved', 'published'])
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * 운영자 검수용 목록 (draft 제외)
 * - RLS가 admin 전체 조회를 허용해야 동작합니다.
 */
export async function getReviewStrategies() {
  mustSupa()
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .neq('status', 'draft')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getStrategyById(id) {
  if (!isSupabaseConfigured() || !supabase) return null
  if (!id) return null
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function createStrategy(strategy) {
  mustSupa()
  const { data, error } = await supabase
    .from('strategies')
    .insert(strategy)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateStrategy(id, patch) {
  mustSupa()
  const { data, error } = await supabase
    .from('strategies')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteStrategy(id) {
  mustSupa()
  const { error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}

export async function submitStrategy(id) {
  return updateStrategy(id, { status: 'submitted', review_note: '' })
}


import { supabase, isSupabaseConfigured } from './supabase'

export async function getMyProfile(userId) {
  if (!isSupabaseConfigured() || !supabase) return null
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nickname,role,created_at,updated_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function ensureProfile(user) {
  if (!isSupabaseConfigured() || !supabase) return null
  const userId = user?.id
  if (!userId) return null

  const existing = await getMyProfile(userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, nickname: 'guest', role: 'user' })
    .select('id,nickname,role,created_at,updated_at')
    .single()
  if (error) throw error
  return data ?? null
}

export async function updateProfile(userId, patch) {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase 미설정')
  if (!userId) throw new Error('userId 필요')
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id,nickname,role,created_at,updated_at')
    .single()
  if (error) throw error
  return data
}


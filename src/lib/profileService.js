import { supabase, isSupabaseConfigured } from './supabase'

/** 이메일 로컬파트로 기본 닉네임 (프로필 자동 생성용) */
function nicknameFromUser(user) {
  const email = String(user?.email ?? '').trim()
  const local = email.split('@')[0] || ''
  const safe = local.replace(/[^a-zA-Z0-9가-힣._-]/g, '').slice(0, 20)
  if (safe.length >= 2) return safe
  return `user_${String(user?.id ?? '').slice(0, 8) || 'guest'}`
}

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

  const nickname = nicknameFromUser(user)

  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, nickname, role: 'user' })
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


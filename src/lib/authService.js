import { supabase, isSupabaseConfigured } from './supabase'

export async function getCurrentSession() {
  if (!isSupabaseConfigured() || !supabase) return { session: null }
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return { session: data.session ?? null }
}

export async function getCurrentUser() {
  const { session } = await getCurrentSession()
  return session?.user ?? null
}

export async function signInWithOtp(email) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }

  const redirectTo = `${window.location.origin}`

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  })

  if (error) throw error
  return true
}

export async function signOut() {
  if (!isSupabaseConfigured() || !supabase) return true
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  return true
}


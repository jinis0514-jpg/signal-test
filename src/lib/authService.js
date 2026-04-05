import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Supabase Auth 에러 → 사용자용 문구 (로그인/가입/비밀번호 재설정 공통)
 */
export function mapAuthErrorToMessage(error) {
  const msg = String(error?.message ?? '')
  const lower = msg.toLowerCase()

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return '이메일 인증을 완료한 뒤 다시 로그인해 주세요. 메일함을 확인해 주세요.'
  }
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return '이미 가입된 이메일입니다. 로그인을 시도해 주세요.'
  }
  if (lower.includes('password should be at least') || lower.includes('password')) {
    if (lower.includes('6')) return '비밀번호는 6자 이상으로 설정해 주세요.'
  }
  if (lower.includes('signup_disabled') || lower.includes('signups not allowed')) {
    return '현재 새 계정 가입이 제한되어 있습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return '네트워크 오류가 발생했습니다. 연결을 확인해 주세요.'
  }
  if (msg && msg.length < 200) return msg
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

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
    options: { emailRedirectTo: redirectTo },
  })
  if (error) throw error
  return true
}

/** 이메일 + 비밀번호 회원가입 */
export async function signUpWithEmail(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }
  if (!email || !password) throw new Error('이메일과 비밀번호를 입력해 주세요.')
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.')

  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/app/home`,
    },
  })
  if (error) throw new Error(mapAuthErrorToMessage(error))
  return data
}

/** 이메일 + 비밀번호 로그인 */
export async function signInWithPassword(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }
  if (!email || !password) throw new Error('이메일과 비밀번호를 입력해 주세요.')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(mapAuthErrorToMessage(error))
  return data
}

/** 비밀번호 재설정 메일 (매직링크 최소화용 — 사용자가 메일에서 새 비밀번호 설정) */
export async function resetPasswordForEmail(email) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }
  const trimmed = String(email ?? '').trim()
  if (!trimmed.includes('@')) throw new Error('올바른 이메일 주소를 입력해 주세요.')

  const redirectTo = `${window.location.origin}/auth?mode=recovery`
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
  if (error) throw new Error(mapAuthErrorToMessage(error))
  return true
}

export async function signOut() {
  if (!isSupabaseConfigured() || !supabase) return true
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  return true
}


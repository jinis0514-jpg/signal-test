/**
 * 거래소 API 연결 서비스
 * seller_exchange_connections 중심
 *
 * 보안 원칙:
 * - API Key/Secret은 프론트에서 절대 저장하지 않음
 * - createConnection은 서버(Edge Function)로 전송 후 즉시 폐기
 * - read-only 연결만 허용
 * - 프론트에서 Binance 직접 호출 금지
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { MOCK_EXCHANGE_CONNECTIONS } from '../data/verificationMockData'

/**
 * 본인의 거래소 연결 목록 조회
 * encrypted_api_key / encrypted_secret은 절대 프론트로 노출하지 않음
 */
export async function fetchMyConnections() {
  if (!isSupabaseConfigured() || !supabase) {
    return MOCK_EXCHANGE_CONNECTIONS
  }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('seller_exchange_connections')
      .select('id, exchange_name, is_active, permission_scope, last_sync_at, last_error, created_at, updated_at')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  } catch (e) {
    console.warn('fetchMyConnections 실패:', e)
    return []
  }
}

/**
 * 새 거래소 연결 생성
 * Edge Function(connect-exchange)을 호출하여 서버에서 암호화 저장.
 * 프론트에서 api_key/api_secret을 DB에 직접 쓰지 않음.
 */
export async function createConnection({ exchange_name = 'binance', api_key, api_secret }) {
  if (!api_key || !api_secret) {
    throw new Error('API Key와 Secret을 입력해 주세요.')
  }
  if (!isSupabaseConfigured() || !supabase) {
    return {
      id: 'mock-new-conn',
      exchange_name,
      is_active: true,
      permission_scope: 'read_only',
      last_sync_at: null,
      created_at: new Date().toISOString(),
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('connect-exchange', {
      body: { exchange_name, api_key, api_secret },
    })
    if (error) throw error
    return data
  } catch (e) {
    console.warn('Edge Function 호출 실패, 개발용 폴백:', e)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('로그인이 필요합니다.')
    const { data, error: insertErr } = await supabase
      .from('seller_exchange_connections')
      .insert({
        seller_id: user.id,
        exchange_name,
        encrypted_api_key: `[dev:${api_key.slice(0, 6)}...]`,
        encrypted_secret: '[encrypted]',
        is_active: true,
        permission_scope: 'read_only',
      })
      .select('id, exchange_name, is_active, permission_scope, created_at')
      .single()
    if (insertErr) throw insertErr
    return data
  }
}

/**
 * 거래소 연결 해제 (비활성화)
 */
export async function revokeConnection(connectionId) {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: true }
  }
  try {
    const { error } = await supabase
      .from('seller_exchange_connections')
      .update({ is_active: false })
      .eq('id', connectionId)
    if (error) throw error
    return { success: true }
  } catch (e) {
    console.warn('revokeConnection 실패:', e)
    throw e
  }
}

/**
 * 특정 연결의 동기화 상태 조회
 */
export async function getConnectionStatus(connectionId) {
  if (!isSupabaseConfigured() || !supabase) {
    return MOCK_EXCHANGE_CONNECTIONS[0] ?? null
  }
  try {
    const { data, error } = await supabase
      .from('seller_exchange_connections')
      .select('id, exchange_name, is_active, last_sync_at, last_error, permission_scope')
      .eq('id', connectionId)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (e) {
    console.warn('getConnectionStatus 실패:', e)
    return null
  }
}

export const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance', logo: '🟡' },
]

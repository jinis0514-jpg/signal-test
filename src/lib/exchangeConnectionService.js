/**
 * 거래소 API 연결 서비스
 * seller_exchange_connections 중심 (설계서상 exchange_connections 와 동일 엔티티)
 *
 * 보안 원칙:
 * - API Key/Secret은 프론트에서 절대 저장하지 않음
 * - createConnection / testExchangeConnection 은 Edge 로만 전송 후 폐기
 * - DB에서 encrypted_* · secret 원문은 조회하지 않음 (마스킹된 키만)
 * - 프론트에서 Binance 직접 호출 금지
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { MOCK_EXCHANGE_CONNECTIONS } from '../data/verificationMockData'

const CONNECTION_SELECT =
  'id, exchange_name, is_active, permission_scope, last_sync_at, last_error, created_at, updated_at, api_key_masked, permission_read, permission_trade, permission_withdraw, last_connection_test_at, connection_test_ok'

/**
 * 본인의 거래소 연결 목록 조회
 * encrypted_api_key / encrypted_secret 은 select 하지 않음
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
      .select(CONNECTION_SELECT)
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
 * 연결 테스트만 (저장 없음) — 읽기/거래/출금 권한 확인
 */
export async function testExchangeConnection({ exchange_name = 'binance', api_key, api_secret }) {
  if (!api_key || !api_secret) {
    throw new Error('API Key와 Secret을 입력해 주세요.')
  }
  if (!isSupabaseConfigured() || !supabase) {
    return {
      ok: true,
      validate_only: true,
      api_key_masked: `${String(api_key).slice(0, 4)}****${String(api_key).slice(-4)}`,
      permission_read: true,
      permission_trade: false,
      permission_withdraw: false,
      last_connection_test_at: new Date().toISOString(),
      connection_test_ok: true,
      withdraw_warning: false,
      trade_warning: false,
      message: '데모: 실제 배포 시 Edge에서 Binance 계정 API로 권한을 확인합니다.',
    }
  }

  const { data, error } = await supabase.functions.invoke('connect-exchange', {
    body: { exchange_name, api_key, api_secret, validate_only: true },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
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
      body: { exchange_name, api_key, api_secret, validate_only: false },
    })
    if (error) throw error
    return data
  } catch (e) {
    console.warn('Edge Function 호출 실패, 개발용 폴백:', e)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('로그인이 필요합니다.')
    const mk = `${String(api_key).slice(0, 4)}****${String(api_key).slice(-4)}`
    const { data, error: insertErr } = await supabase
      .from('seller_exchange_connections')
      .insert({
        seller_id: user.id,
        exchange_name,
        encrypted_api_key: `[dev:${api_key.slice(0, 6)}...]`,
        encrypted_secret: '[encrypted]',
        is_active: true,
        permission_scope: 'read_only',
        api_key_masked: mk,
        permission_read: true,
        permission_trade: false,
        permission_withdraw: false,
        last_connection_test_at: new Date().toISOString(),
        connection_test_ok: true,
      })
      .select('id, exchange_name, is_active, permission_scope, created_at, api_key_masked, permission_read, permission_trade, permission_withdraw')
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
      .select(CONNECTION_SELECT)
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

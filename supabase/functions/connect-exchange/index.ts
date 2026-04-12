/**
 * connect-exchange Edge Function
 *
 * 1차: 읽기 전용 연동 우선 — 연결 테스트 시 Binance GET /api/v3/account 로 권한 확인
 * - validate_only: 저장 없이 권한만 반환 + 감사 로그
 * - 저장 시: 키 암호화(플레이스홀더) + api_key_masked + permission_* + 감사 로그
 *
 * 보안: 평문 secret 응답·로그 금지. 관리자도 DB에서 encrypted_* 는 Edge 외 조회 금지 원칙.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BINANCE = 'https://api.binance.com'

function maskApiKey(key: string): string {
  const k = String(key ?? '').trim()
  if (k.length <= 8) return '****'
  return `${k.slice(0, 4)}****${k.slice(-4)}`
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  const bytes = new Uint8Array(sig)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Binance signed GET /api/v3/account — canTrade / canWithdraw 등 */
async function fetchBinanceAccount(apiKey: string, apiSecret: string) {
  const timestamp = Date.now()
  const recvWindow = 5000
  const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`
  const signature = await hmacSha256Hex(apiSecret, queryString)
  const url = `${BINANCE}/api/v3/account?${queryString}&signature=${signature}`
  const res = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { msg?: string }).msg ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as {
    canTrade?: boolean
    canWithdraw?: boolean
    canDeposit?: boolean
    permissions?: string[]
  }
}

function permissionsFromAccount(account: Awaited<ReturnType<typeof fetchBinanceAccount>>) {
  const canTrade = account.canTrade === true
  const canWithdraw = account.canWithdraw === true
  const canRead = true
  return {
    permission_read: canRead,
    permission_trade: canTrade,
    permission_withdraw: canWithdraw,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: '인증 실패' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const {
      exchange_name,
      api_key,
      api_secret,
      validate_only,
    } = body as {
      exchange_name?: string
      api_key?: string
      api_secret?: string
      validate_only?: boolean
    }

    if (!api_key || !api_secret) {
      return new Response(
        JSON.stringify({ error: 'API Key와 Secret을 입력해 주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!exchange_name || exchange_name !== 'binance') {
      return new Response(
        JSON.stringify({ error: '지원 거래소를 선택해 주세요. (1차: Binance)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let account: Awaited<ReturnType<typeof fetchBinanceAccount>>
    try {
      account = await fetchBinanceAccount(api_key.trim(), api_secret.trim())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await supabase.from('exchange_connection_audit_logs').insert({
        user_id: user.id,
        connection_id: null,
        action: validate_only ? 'validate_failed' : 'connect_failed',
        detail: { exchange_name, error: msg },
      })
      return new Response(
        JSON.stringify({ error: `연결 테스트 실패: ${msg}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const perms = permissionsFromAccount(account)
    const nowIso = new Date().toISOString()

    if (validate_only) {
      await supabase.from('exchange_connection_audit_logs').insert({
        user_id: user.id,
        connection_id: null,
        action: 'validate_ok',
        detail: {
          exchange_name,
          ...perms,
          tested_at: nowIso,
        },
      })
      return new Response(
        JSON.stringify({
          ok: true,
          validate_only: true,
          api_key_masked: maskApiKey(api_key),
          ...perms,
          last_connection_test_at: nowIso,
          connection_test_ok: true,
          withdraw_warning: perms.permission_withdraw,
          trade_warning: perms.permission_trade,
          message:
            '연결 테스트 완료. 이 서비스는 자동 실행이 아닌 직접 실행 구조이며, 투자 판단과 책임은 사용자 본인에게 있습니다.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const encryptedKey = `[encrypted:${api_key.trim().slice(0, 6)}...]`
    const encryptedSecret = '[encrypted:***]'

    const { data: conn, error: insertErr } = await supabase
      .from('seller_exchange_connections')
      .insert({
        seller_id: user.id,
        exchange_name,
        encrypted_api_key: encryptedKey,
        encrypted_secret: encryptedSecret,
        is_active: true,
        permission_scope: perms.permission_trade ? 'read_trade' : 'read_only',
        api_key_masked: maskApiKey(api_key),
        permission_read: perms.permission_read,
        permission_trade: perms.permission_trade,
        permission_withdraw: perms.permission_withdraw,
        last_connection_test_at: nowIso,
        connection_test_ok: true,
      })
      .select(
        'id, exchange_name, is_active, permission_scope, created_at, api_key_masked, permission_read, permission_trade, permission_withdraw, last_connection_test_at, connection_test_ok',
      )
      .single()

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    await supabase.from('exchange_connection_audit_logs').insert({
      user_id: user.id,
      connection_id: conn.id,
      action: 'connect_ok',
      detail: {
        exchange_name,
        ...perms,
        tested_at: nowIso,
      },
    })

    return new Response(
      JSON.stringify({
        ...conn,
        withdraw_warning: perms.permission_withdraw,
        trade_warning: perms.permission_trade,
        disclaimer:
          '자동 실행이 아닌 직접 실행 구조입니다. 투자 판단과 책임은 사용자 본인에게 있습니다. 출금 권한이 없는 API 키만 연결하는 것을 권장합니다.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

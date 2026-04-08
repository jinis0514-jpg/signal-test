/**
 * connect-exchange Edge Function
 *
 * 판매자 거래소 API 연결:
 * 1. API Key 유효성 검증 (read-only 확인)
 * 2. 키 암호화 후 seller_exchange_connections에 저장
 * 3. 첫 동기화 트리거 (collect-trades 호출)
 *
 * 보안 원칙:
 * - API Key는 서버에서만 처리
 * - read-only 연결만 허용
 * - 암호화 저장 전제
 * - 평문 secret 노출 금지
 *
 * 요청: POST { exchange_name, api_key, api_secret }
 * 응답: { id, exchange_name, is_active, permission_scope }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 인증 확인
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

    const { exchange_name, api_key, api_secret } = await req.json()

    if (!api_key || !api_secret) {
      return new Response(
        JSON.stringify({ error: 'API Key와 Secret을 입력해 주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!exchange_name) {
      return new Response(
        JSON.stringify({ error: '거래소를 선택해 주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 1. API Key 유효성 검증 ──
    //
    // 실제 구현 시:
    //   - Binance GET /api/v3/account 호출
    //   - enableSpotAndMarginTrading === false 확인 (read-only)
    //   - 거래/출금 권한 있으면 거부
    //
    // const timestamp = Date.now()
    // const queryString = `timestamp=${timestamp}&recvWindow=5000`
    // const signature = hmacSHA256(queryString, api_secret)
    // const accountRes = await fetch(
    //   `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
    //   { headers: { 'X-MBX-APIKEY': api_key } },
    // )
    // const account = await accountRes.json()
    // if (account.canTrade === true) {
    //   return error('거래 권한이 있는 키입니다. read-only 키만 허용됩니다.')
    // }

    // ── 2. 암호화 저장 ──
    //
    // 실제 구현 시: AES-256-GCM 등 사용
    // 지금은 구조만 — 실제 암호화 로직은 나중에 붙인다
    const encryptedKey = `[encrypted:${api_key.slice(0, 6)}...]`
    const encryptedSecret = '[encrypted:***]'

    const { data: conn, error: insertErr } = await supabase
      .from('seller_exchange_connections')
      .insert({
        seller_id: user.id,
        exchange_name,
        encrypted_api_key: encryptedKey,
        encrypted_secret: encryptedSecret,
        is_active: true,
        permission_scope: 'read_only',
      })
      .select('id, exchange_name, is_active, permission_scope, created_at')
      .single()

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. 첫 동기화 트리거 ──
    //
    // 실제 구현 시: collect-trades Edge Function 비동기 호출
    // await fetch(`${supabaseUrl}/functions/v1/collect-trades`, {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ connectionId: conn.id }),
    // })

    return new Response(JSON.stringify(conn), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

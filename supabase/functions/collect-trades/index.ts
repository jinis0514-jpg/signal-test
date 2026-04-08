/**
 * syncSellerTrades(connectionId)
 *
 * 처리 흐름:
 * 1. seller_exchange_connections에서 활성 연결 조회
 * 2. 거래소 API에서 실제 체결 로그 읽기 (read-only)
 * 3. seller_trade_logs에 upsert
 *
 * API Key는 서버에서만 복호화하여 사용.
 * 프론트에서 절대 Binance 직접 호출 금지.
 *
 * 트리거: pg_cron (5분 간격) 또는 connect-exchange 후 즉시 1회
 * 요청: POST { connectionId }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BINANCE_BASE = 'https://api.binance.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── 핵심 함수: syncSellerTrades ─────────────────────────────
async function syncSellerTrades(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
) {
  // 1. seller_exchange_connections 조회
  const { data: conn, error: connErr } = await supabase
    .from('seller_exchange_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('is_active', true)
    .single()

  if (connErr || !conn) {
    throw new Error(`연결 조회 실패: ${connErr?.message ?? '존재하지 않거나 비활성 연결'}`)
  }

  // 2. 거래소 API에서 체결 로그 읽기
  //
  // 실제 구현 시:
  //   - conn.encrypted_api_key / conn.encrypted_secret 복호화
  //   - HMAC-SHA256 서명 생성
  //   - GET /api/v3/myTrades?symbol=BTCUSDT&timestamp=...&signature=...
  //   - X-MBX-APIKEY 헤더에 복호화된 API Key 사용
  //   - read-only 권한 확인 (enableSpotAndMarginTrading === false)
  //
  // 지금은 구조만 잡아두고, 실제 API 호출은 나중에 붙인다.
  //
  // const decryptedKey = decrypt(conn.encrypted_api_key)
  // const decryptedSecret = decrypt(conn.encrypted_secret)
  // const timestamp = Date.now()
  // const queryString = `timestamp=${timestamp}&recvWindow=5000`
  // const signature = hmacSHA256(queryString, decryptedSecret)
  // const res = await fetch(
  //   `${BINANCE_BASE}/api/v3/myTrades?symbol=BTCUSDT&${queryString}&signature=${signature}`,
  //   { headers: { 'X-MBX-APIKEY': decryptedKey } },
  // )
  // const trades = await res.json()

  const trades: Array<{
    id: number
    symbol: string
    isBuyer: boolean
    price: string
    qty: string
    time: number
    orderId: number
  }> = []

  // 3. seller_trade_logs에 upsert
  //    - exchange_connection_id로 어떤 연결에서 수집했는지 추적
  //    - trade_id로 거래소별 중복 방지 (uq_seller_trade_logs_exchange_trade)
  let inserted = 0
  for (const trade of trades) {
    const side = trade.isBuyer ? 'BUY' : 'SELL'

    const { error: upsertErr } = await supabase
      .from('seller_trade_logs')
      .upsert(
        {
          seller_id: conn.seller_id,
          exchange_connection_id: conn.id,
          exchange_name: conn.exchange_name,
          symbol: trade.symbol,
          side,
          executed_at: new Date(trade.time).toISOString(),
          executed_price: Number(trade.price),
          qty: Number(trade.qty),
          order_id: String(trade.orderId),
          trade_id: String(trade.id),
          raw_payload: trade,
        },
        { onConflict: 'id' },
      )

    if (!upsertErr) inserted++
  }

  // 동기화 시간 갱신
  await supabase
    .from('seller_exchange_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', connectionId)

  return { connectionId, inserted, total: trades.length }
}

// ── HTTP Handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { connectionId } = await req.json()
    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: 'connectionId가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const result = await syncSellerTrades(supabase, connectionId)

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    // 에러 시 연결 상태 갱신
    try {
      const body = await req.clone().json().catch(() => ({}))
      if (body.connectionId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )
        await supabase
          .from('seller_exchange_connections')
          .update({ last_error: e.message })
          .eq('id', body.connectionId)
      }
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

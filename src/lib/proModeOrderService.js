/**
 * PRO MODE — 사용자가 버튼을 눌렀을 때만 주문 요청 (자동 실행 없음)
 * 서버(Edge)에서만 복호화·거래소 호출. 프론트는 키를 저장하지 않음.
 */

import { supabase, isSupabaseConfigured } from './supabase'

/**
 * @param {object} p
 * @param {string} p.connectionId — seller_exchange_connections.id
 * @param {string} p.symbol — 예: BTCUSDT
 * @param {'LONG'|'SHORT'} p.side
 * @param {number} [p.recommendedKrw] — 참고 금액(원)
 */
export async function executeProModeOrderClick({
  connectionId,
  symbol,
  side,
  recommendedKrw,
}) {
  if (!connectionId) {
    return { ok: false, message: '먼저 마이페이지에서 거래소 API를 연결해 주세요.' }
  }

  const sym = String(symbol ?? 'BTCUSDT').toUpperCase()
  const sd = String(side ?? 'LONG').toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG'

  if (!isSupabaseConfigured() || !supabase) {
    return {
      ok: true,
      demo: true,
      message:
        '데모 환경: 실제 주문 API는 Supabase·Edge 배포 후 같은 버튼으로만 전달됩니다. 자동 실행은 없습니다.',
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('pro-mode-order', {
      body: {
        connection_id: connectionId,
        symbol: sym,
        side: sd,
        quote_order_qty_krw: recommendedKrw != null ? Number(recommendedKrw) : null,
        /** 서버에서 자동 주문과 구분 */
        trigger: 'manual_button',
      },
    })
    if (error) throw error
    return { ok: true, data }
  } catch (e) {
    const msg = String(e?.message ?? e ?? '')
    return {
      ok: false,
      demo: true,
      message:
        msg.includes('Failed to fetch') || msg.includes('not found')
          ? '주문 Edge 함수가 아직 배포되지 않았습니다. UI·흐름만 확인 중이며, 자동 주문은 없습니다.'
          : (msg || '주문 요청에 실패했습니다.'),
    }
  }
}

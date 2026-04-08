/**
 * 실거래 인증 데이터 조회 서비스
 * strategy_verification_summary / trade_verification_matches 중심
 *
 * 프론트에서 읽기 전용으로 사용.
 * 쓰기/매칭 로직은 서버(Edge Functions)에서만 수행.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import {
  getMockVerificationSummary,
  getMockTradeMatches,
  getMockLiveSignals,
  getMockSellerTrades,
} from '../data/verificationMockData'

/**
 * strategy_verification_summary 조회
 * 프론트 표시용: match_rate, avg_price_diff_pct, verified_return_pct 등
 */
export async function fetchVerificationSummary(strategyId) {
  if (!isSupabaseConfigured() || !supabase) {
    return getMockVerificationSummary(strategyId)
  }
  try {
    const { data, error } = await supabase
      .from('strategy_verification_summary')
      .select('*')
      .eq('strategy_id', strategyId)
      .maybeSingle()
    if (error) throw error
    return data ?? getMockVerificationSummary(strategyId)
  } catch (e) {
    console.warn('fetchVerificationSummary 실패:', e)
    return getMockVerificationSummary(strategyId)
  }
}

/**
 * trade_verification_matches 조회 (시그널·체결 정보 join)
 */
export async function fetchTradeMatches(strategyId, { limit = 50, offset = 0 } = {}) {
  if (!isSupabaseConfigured() || !supabase) {
    const matches = getMockTradeMatches(strategyId)
    const signals = getMockLiveSignals(strategyId)
    const trades = getMockSellerTrades(strategyId)
    return enrichMatchesWithDetails(matches, signals, trades).slice(offset, offset + limit)
  }
  try {
    const { data, error } = await supabase
      .from('trade_verification_matches')
      .select(`
        *,
        signal:live_signals(*),
        trade:seller_trade_logs(*)
      `)
      .eq('strategy_id', strategyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error
    return (data ?? []).map((row) => ({
      ...row,
      signal_time: row.signal?.signal_time,
      signal_price: row.signal?.price,
      signal_direction: row.signal?.direction,
      signal_symbol: row.signal?.symbol,
      trade_time: row.trade?.executed_at,
      trade_price: row.trade?.executed_price,
      trade_side: row.trade?.side,
      trade_symbol: row.trade?.symbol,
    }))
  } catch (e) {
    console.warn('fetchTradeMatches 실패:', e)
    const matches = getMockTradeMatches(strategyId)
    const signals = getMockLiveSignals(strategyId)
    const trades = getMockSellerTrades(strategyId)
    return enrichMatchesWithDetails(matches, signals, trades).slice(offset, offset + limit)
  }
}

/**
 * 프론트 표시용 배지 정보
 * is_live_tracked / is_trade_verified / verified_badge_level / match_rate 등
 */
export async function fetchVerificationBadgeInfo(strategyId) {
  const summary = await fetchVerificationSummary(strategyId)
  return {
    verified_badge_level: summary?.verified_badge_level ?? 'backtest_only',
    match_rate: summary?.match_rate ?? 0,
    avg_price_diff_pct: summary?.avg_price_diff_pct ?? 0,
    avg_time_diff_sec: summary?.avg_time_diff_sec ?? 0,
    verified_return_pct: summary?.verified_return_pct ?? 0,
    last_30_signal_count: summary?.last_30_signal_count ?? 0,
    matched_signal_count: summary?.matched_signal_count ?? 0,
  }
}

function enrichMatchesWithDetails(matches, signals, trades) {
  const sigMap = Object.fromEntries((signals ?? []).map((s) => [s.id, s]))
  const tradeMap = Object.fromEntries((trades ?? []).map((t) => [t.id, t]))
  return matches.map((m) => {
    const sig = sigMap[m.signal_id]
    const tr = tradeMap[m.trade_log_id]
    return {
      ...m,
      signal_time: sig?.signal_time,
      signal_price: sig?.price,
      signal_direction: sig?.direction,
      signal_symbol: sig?.symbol,
      trade_time: tr?.executed_at,
      trade_price: tr?.executed_price,
      trade_side: tr?.side,
      trade_symbol: tr?.symbol,
    }
  })
}

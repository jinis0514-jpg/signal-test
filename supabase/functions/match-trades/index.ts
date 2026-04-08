/**
 * matchTradesToSignals(strategyId) + updateVerificationSummary(strategyId)
 *
 * 처리 흐름 B: 시그널 vs 실거래 매칭
 * 1. 해당 전략 live_signals 조회
 * 2. 해당 판매자 seller_trade_logs 조회
 * 3. 시간/가격/방향 기준으로 비교
 * 4. trade_verification_matches 저장
 *
 * 처리 흐름 C: 요약 갱신
 * 1. 최근 30개 시그널 기준 집계
 * 2. 매칭률 / 평균 가격 오차 / 평균 시간 오차 계산
 * 3. verified_badge_level 계산
 * 4. strategy_verification_summary 업데이트
 *
 * 매칭 기준:
 * - symbol 동일
 * - 방향 동일
 * - 시그널 발생 후 0~3분 이내 (0~180초)
 * - 진입가 기준 ±0.5% 이내
 * - 수량은 비교하지 않음
 *
 * 트리거: collect-trades 완료 후 또는 pg_cron
 * 요청: POST { strategyId }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── 매칭 기준 상수 ─────────────────────────────────────────
const MAX_TIME_DIFF_SEC = 180        // 시그널 후 0~3분
const MAX_PRICE_DIFF_PCT = 0.5       // ±0.5%

// ── 배지 판정 기준 ─────────────────────────────────────────
const LIVE_VERIFIED_MIN_DAYS = 7
const LIVE_VERIFIED_MIN_SIGNALS = 10
const TRADE_VERIFIED_MIN_MATCH_RATE = 60     // 60%
const TRADE_VERIFIED_MAX_PRICE_DIFF = 0.5    // 0.5%
const TRADE_VERIFIED_MIN_SIDE_MATCH = 80     // 80%

// ── 단일 매칭 판정 함수 ────────────────────────────────────
function evaluateMatch(
  signal: { symbol: string; direction: string; price: number; signal_time: string },
  trade: { symbol: string; side: string; executed_price: number; executed_at: string },
): {
  isMatch: boolean
  timeDiffSec: number
  priceDiffPct: number
  sideMatched: boolean
} {
  // symbol 비교
  if (signal.symbol !== trade.symbol) {
    return { isMatch: false, timeDiffSec: -1, priceDiffPct: -1, sideMatched: false }
  }

  // 방향 비교: signal.direction(LONG/SHORT) vs trade.side(BUY/SELL)
  const signalSide = signal.direction === 'LONG' ? 'BUY' : 'SELL'
  const sideMatched = signalSide === trade.side

  // 시간 비교: 시그널 발생 후 0~3분 이내만 인정
  const sigMs = new Date(signal.signal_time).getTime()
  const tradeMs = new Date(trade.executed_at).getTime()
  const timeDiffSec = (tradeMs - sigMs) / 1000

  // 가격 비교
  const priceDiffPct = Math.abs(signal.price - trade.executed_price) / signal.price * 100

  const isMatch =
    sideMatched &&
    timeDiffSec >= 0 &&
    timeDiffSec <= MAX_TIME_DIFF_SEC &&
    priceDiffPct <= MAX_PRICE_DIFF_PCT

  return {
    isMatch,
    timeDiffSec: Math.round(timeDiffSec),
    priceDiffPct: +priceDiffPct.toFixed(4),
    sideMatched,
  }
}

// ── B. matchTradesToSignals ─────────────────────────────────
async function matchTradesToSignals(
  supabase: ReturnType<typeof createClient>,
  strategyId: string,
) {
  // 1. 해당 전략의 ENTRY 시그널 조회 (최근 100개)
  const { data: signals, error: sigErr } = await supabase
    .from('live_signals')
    .select('*')
    .eq('strategy_id', strategyId)
    .eq('signal_type', 'ENTRY')
    .order('signal_time', { ascending: false })
    .limit(100)

  if (sigErr) throw new Error(`시그널 조회 실패: ${sigErr.message}`)
  if (!signals?.length) return { strategyId, matched: 0, total: 0, message: '시그널 없음' }

  // 2. 해당 전략의 판매자(creator) 확인
  const { data: strategy } = await supabase
    .from('strategies')
    .select('creator_id')
    .eq('id', strategyId)
    .single()

  if (!strategy?.creator_id) {
    return { strategyId, matched: 0, total: signals.length, message: '전략 크리에이터 없음' }
  }

  // 3. 해당 판매자의 체결 로그 조회
  const { data: trades, error: tradeErr } = await supabase
    .from('seller_trade_logs')
    .select('*')
    .eq('seller_id', strategy.creator_id)
    .order('executed_at', { ascending: false })
    .limit(500)

  if (tradeErr) throw new Error(`체결 로그 조회 실패: ${tradeErr.message}`)
  if (!trades?.length) return { strategyId, matched: 0, total: signals.length, message: '체결 로그 없음' }

  // 4. 시그널별 최적 매칭 수행
  const usedTradeIds = new Set<string>()
  const matchRows: Array<Record<string, unknown>> = []

  for (const sig of signals) {
    let bestMatch: { trade: typeof trades[0]; result: ReturnType<typeof evaluateMatch> } | null = null
    let bestTimeDiff = Infinity

    for (const trade of trades) {
      if (usedTradeIds.has(trade.id)) continue

      const result = evaluateMatch(sig, trade)
      if (result.isMatch && result.timeDiffSec < bestTimeDiff) {
        bestMatch = { trade, result }
        bestTimeDiff = result.timeDiffSec
      }
    }

    if (bestMatch) {
      usedTradeIds.add(bestMatch.trade.id)
      matchRows.push({
        strategy_id: strategyId,
        signal_id: sig.id,
        trade_log_id: bestMatch.trade.id,
        time_diff_sec: bestMatch.result.timeDiffSec,
        price_diff_pct: bestMatch.result.priceDiffPct,
        side_matched: bestMatch.result.sideMatched,
        is_verified_match: true,
      })
    }
  }

  // 5. trade_verification_matches 저장
  if (matchRows.length > 0) {
    const { error: insertErr } = await supabase
      .from('trade_verification_matches')
      .upsert(matchRows, { onConflict: 'id' })

    if (insertErr) throw new Error(`매칭 저장 실패: ${insertErr.message}`)
  }

  return { strategyId, matched: matchRows.length, total: signals.length }
}

// ── C. updateVerificationSummary ────────────────────────────
async function updateVerificationSummary(
  supabase: ReturnType<typeof createClient>,
  strategyId: string,
) {
  // 1. 최근 30개 ENTRY 시그널 조회
  const { data: recentSignals } = await supabase
    .from('live_signals')
    .select('id')
    .eq('strategy_id', strategyId)
    .eq('signal_type', 'ENTRY')
    .order('signal_time', { ascending: false })
    .limit(30)

  const last30Count = recentSignals?.length ?? 0
  if (last30Count === 0) {
    await supabase
      .from('strategy_verification_summary')
      .upsert({
        strategy_id: strategyId,
        last_30_signal_count: 0,
        matched_signal_count: 0,
        match_rate: 0,
        avg_price_diff_pct: 0,
        avg_time_diff_sec: 0,
        verified_return_pct: 0,
        verified_badge_level: 'backtest_only',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'strategy_id' })

    return { strategyId, badgeLevel: 'backtest_only' }
  }

  const signalIds = recentSignals!.map((s) => s.id)

  // 2. 해당 시그널들의 매칭 결과 조회
  const { data: matches } = await supabase
    .from('trade_verification_matches')
    .select('*')
    .in('signal_id', signalIds)
    .eq('is_verified_match', true)

  const matchedCount = matches?.length ?? 0

  // 3. 매칭률 계산
  const matchRate = last30Count > 0 ? (matchedCount / last30Count) * 100 : 0

  // 4. 평균 가격 오차 계산
  const avgPriceDiff = matchedCount > 0
    ? (matches!.reduce((sum, m) => sum + (Number(m.price_diff_pct) || 0), 0) / matchedCount)
    : 0

  // 5. 평균 시간 오차 계산
  const avgTimeDiff = matchedCount > 0
    ? (matches!.reduce((sum, m) => sum + (Number(m.time_diff_sec) || 0), 0) / matchedCount)
    : 0

  // 6. 방향 일치율 계산
  const sideMatchedCount = matches?.filter((m) => m.side_matched).length ?? 0
  const sideMatchRate = matchedCount > 0 ? (sideMatchedCount / matchedCount) * 100 : 0

  // 7. 검증 수익률 계산 (매칭된 시그널들의 pnl 합산)
  const { data: matchedSignals } = await supabase
    .from('live_signals')
    .select('pnl_pct')
    .in('id', signalIds)
    .not('pnl_pct', 'is', null)

  const verifiedReturnPct = matchedSignals?.reduce((sum, s) => sum + (Number(s.pnl_pct) || 0), 0) ?? 0

  // 8. 전체 시그널 수 (limit 없이)
  const { count: totalSignalCount } = await supabase
    .from('live_signals')
    .select('id', { count: 'exact', head: true })
    .eq('strategy_id', strategyId)
    .eq('signal_type', 'ENTRY')

  // 9. 가장 오래된 시그널 기준 라이브 일수 추정
  const { data: oldestSignal } = await supabase
    .from('live_signals')
    .select('signal_time')
    .eq('strategy_id', strategyId)
    .order('signal_time', { ascending: true })
    .limit(1)
    .single()

  const liveDays = oldestSignal?.signal_time
    ? Math.floor((Date.now() - new Date(oldestSignal.signal_time).getTime()) / 86400000)
    : 0

  // 10. verified_badge_level 계산
  let badgeLevel = 'backtest_only'

  // 실시간 검증: 7일+, 10개+ 시그널
  if (liveDays >= LIVE_VERIFIED_MIN_DAYS && (totalSignalCount ?? 0) >= LIVE_VERIFIED_MIN_SIGNALS) {
    badgeLevel = 'live_verified'
  }

  // 실거래 인증: 매칭률 60%+, 가격 오차 0.5%↓, 방향 80%+
  if (
    matchRate >= TRADE_VERIFIED_MIN_MATCH_RATE &&
    avgPriceDiff <= TRADE_VERIFIED_MAX_PRICE_DIFF &&
    sideMatchRate >= TRADE_VERIFIED_MIN_SIDE_MATCH &&
    last30Count >= 10
  ) {
    badgeLevel = 'trade_verified'
  }

  // 11. strategy_verification_summary 업데이트
  await supabase
    .from('strategy_verification_summary')
    .upsert({
      strategy_id: strategyId,
      last_30_signal_count: last30Count,
      matched_signal_count: matchedCount,
      match_rate: +matchRate.toFixed(2),
      avg_price_diff_pct: +avgPriceDiff.toFixed(4),
      avg_time_diff_sec: +avgTimeDiff.toFixed(1),
      verified_return_pct: +verifiedReturnPct.toFixed(2),
      verified_badge_level: badgeLevel,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'strategy_id' })

  // strategies 테이블에도 동기화
  await supabase
    .from('strategies')
    .update({
      verified_badge_level: badgeLevel,
      is_live_tracked: liveDays > 0,
      is_trade_verified: badgeLevel === 'trade_verified',
    })
    .eq('id', strategyId)

  return {
    strategyId,
    badgeLevel,
    matchRate: +matchRate.toFixed(2),
    avgPriceDiff: +avgPriceDiff.toFixed(4),
    avgTimeDiff: +avgTimeDiff.toFixed(1),
    sideMatchRate: +sideMatchRate.toFixed(2),
  }
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

    const { strategyId } = await req.json()
    if (!strategyId) {
      return new Response(
        JSON.stringify({ error: 'strategyId가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // B. 매칭 수행
    const matchResult = await matchTradesToSignals(supabase, strategyId)

    // C. 요약 갱신
    const summaryResult = await updateVerificationSummary(supabase, strategyId)

    return new Response(
      JSON.stringify({
        ok: true,
        match: matchResult,
        summary: summaryResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

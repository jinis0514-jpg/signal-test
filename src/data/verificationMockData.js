/**
 * 실거래 인증 시스템 개발/데모용 mock 데이터
 * 3층 구조: 백테스트 / 라이브 검증 / 실거래 인증
 *
 * 새 스키마 필드명에 맞춤:
 * - seller_exchange_connections: seller_id, exchange_name, encrypted_api_key, ...
 * - seller_trade_logs: seller_id, exchange_name, executed_price, qty, order_id, ...
 * - trade_verification_matches: signal_id, trade_log_id, side_matched, ...
 * - strategy_verification_summary: last_30_signal_count, matched_signal_count, avg_time_diff_sec, verified_return_pct, verified_badge_level, ...
 */

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

function dateStr(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

// ── 1층. 백테스트 메트릭 ───────────────────────────────────
export const MOCK_BACKTEST_METRICS = {
  s1: {
    strategy_id: 's1',
    total_return_pct: 87.3,
    win_rate: 62.5,
    max_drawdown: 14.2,
    trade_count: 156,
    sharpe_ratio: 1.82,
    period_days: 365,
    candle_count: 8760,
  },
  s2: {
    strategy_id: 's2',
    total_return_pct: 45.1,
    win_rate: 71.3,
    max_drawdown: 8.7,
    trade_count: 312,
    sharpe_ratio: 2.14,
    period_days: 180,
    candle_count: 4320,
  },
  s6: {
    strategy_id: 's6',
    total_return_pct: 124.8,
    win_rate: 58.9,
    max_drawdown: 18.5,
    trade_count: 89,
    sharpe_ratio: 1.56,
    period_days: 365,
    candle_count: 2190,
  },
}

// ── 2층. 라이브 시그널 ─────────────────────────────────────
export const MOCK_LIVE_SIGNALS = {
  s1: [
    { id: 'ls-1', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 67250, confidence: 78, signal_time: daysAgo(0.5), closed_at: null, close_price: null, pnl_pct: null },
    { id: 'ls-2', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 66800, confidence: 82, signal_time: daysAgo(1.2), closed_at: daysAgo(0.8), close_price: 67400, pnl_pct: 0.9 },
    { id: 'ls-3', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'SHORT', signal_type: 'ENTRY', price: 68100, confidence: 65, signal_time: daysAgo(2.5), closed_at: daysAgo(1.9), close_price: 67500, pnl_pct: 0.88 },
    { id: 'ls-4', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 65900, confidence: 74, signal_time: daysAgo(3.1), closed_at: daysAgo(2.8), close_price: 66200, pnl_pct: 0.46 },
    { id: 'ls-5', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'SHORT', signal_type: 'ENTRY', price: 67800, confidence: 71, signal_time: daysAgo(4.0), closed_at: daysAgo(3.5), close_price: 67200, pnl_pct: 0.88 },
    { id: 'ls-6', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 66500, confidence: 80, signal_time: daysAgo(5.2), closed_at: daysAgo(4.6), close_price: 67100, pnl_pct: 0.9 },
    { id: 'ls-7', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'SHORT', signal_type: 'ENTRY', price: 68500, confidence: 68, signal_time: daysAgo(6.5), closed_at: daysAgo(5.8), close_price: 68100, pnl_pct: 0.58 },
    { id: 'ls-8', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 65200, confidence: 85, signal_time: daysAgo(7.8), closed_at: daysAgo(7.0), close_price: 66300, pnl_pct: 1.69 },
    { id: 'ls-9', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 64800, confidence: 76, signal_time: daysAgo(9.0), closed_at: daysAgo(8.2), close_price: 65400, pnl_pct: 0.93 },
    { id: 'ls-10', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'SHORT', signal_type: 'ENTRY', price: 66900, confidence: 72, signal_time: daysAgo(10.5), closed_at: daysAgo(9.8), close_price: 66400, pnl_pct: 0.75 },
    { id: 'ls-11', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 63500, confidence: 88, signal_time: daysAgo(12.0), closed_at: daysAgo(11.2), close_price: 64800, pnl_pct: 2.05 },
    { id: 'ls-12', strategy_id: 's1', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 64200, confidence: 70, signal_time: daysAgo(14.0), closed_at: daysAgo(13.1), close_price: 64600, pnl_pct: 0.62 },
  ],
  s2: [
    { id: 'ls-201', strategy_id: 's2', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 67100, confidence: 81, signal_time: daysAgo(0.3), closed_at: null, close_price: null, pnl_pct: null },
    { id: 'ls-202', strategy_id: 's2', symbol: 'BTCUSDT', direction: 'SHORT', signal_type: 'ENTRY', price: 67500, confidence: 75, signal_time: daysAgo(1.0), closed_at: daysAgo(0.6), close_price: 67100, pnl_pct: 0.59 },
    { id: 'ls-203', strategy_id: 's2', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 66200, confidence: 79, signal_time: daysAgo(2.0), closed_at: daysAgo(1.5), close_price: 66800, pnl_pct: 0.91 },
    { id: 'ls-204', strategy_id: 's2', symbol: 'BTCUSDT', direction: 'LONG', signal_type: 'ENTRY', price: 65800, confidence: 83, signal_time: daysAgo(3.3), closed_at: daysAgo(2.5), close_price: 66400, pnl_pct: 0.91 },
  ],
}

// ── 2층. 라이브 일별 성과 ──────────────────────────────────
function generateDailyPerf(strategyId, days, opts = {}) {
  const { startRoi = 0, avgDaily = 0.3, volatility = 0.8 } = opts
  const rows = []
  let cum = startRoi
  let peak = cum
  let wins = 0
  let total = 0
  for (let d = days; d >= 0; d--) {
    const daily = avgDaily + (Math.random() - 0.45) * volatility
    cum += daily
    if (cum > peak) peak = cum
    const dd = peak > 0 ? ((peak - cum) / peak) * 100 : 0
    const hasTrade = Math.random() > 0.3
    if (hasTrade) {
      total++
      if (daily > 0) wins++
    }
    rows.push({
      strategy_id: strategyId,
      as_of: dateStr(d),
      cumulative_roi: +cum.toFixed(2),
      daily_roi: +daily.toFixed(2),
      win_rate: total > 0 ? +((wins / total) * 100).toFixed(1) : null,
      trade_count: total,
      mdd: +dd.toFixed(2),
      sharpe: total > 3 ? +(1.2 + Math.random() * 0.8).toFixed(2) : null,
      signal_count: total + Math.floor(Math.random() * 3),
    })
  }
  return rows
}

export const MOCK_LIVE_PERFORMANCE_DAILY = {
  s1: generateDailyPerf('s1', 30, { avgDaily: 0.35, volatility: 0.9 }),
  s2: generateDailyPerf('s2', 14, { avgDaily: 0.25, volatility: 0.5 }),
  s6: generateDailyPerf('s6', 45, { avgDaily: 0.4, volatility: 1.1 }),
}

// ── 3층. 실거래 매칭 결과 ──────────────────────────────────
// 필드: signal_id, trade_log_id, side_matched, time_diff_sec, price_diff_pct
export const MOCK_TRADE_MATCHES = {
  s1: [
    { id: 'tm-1', strategy_id: 's1', signal_id: 'ls-2', trade_log_id: 'st-1', time_diff_sec: 45, price_diff_pct: 0.12, side_matched: true, is_verified_match: true, created_at: daysAgo(1) },
    { id: 'tm-2', strategy_id: 's1', signal_id: 'ls-3', trade_log_id: 'st-2', time_diff_sec: 120, price_diff_pct: 0.08, side_matched: true, is_verified_match: true, created_at: daysAgo(2) },
    { id: 'tm-3', strategy_id: 's1', signal_id: 'ls-4', trade_log_id: 'st-3', time_diff_sec: 30, price_diff_pct: 0.15, side_matched: true, is_verified_match: true, created_at: daysAgo(3) },
    { id: 'tm-4', strategy_id: 's1', signal_id: 'ls-5', trade_log_id: 'st-4', time_diff_sec: 250, price_diff_pct: 0.72, side_matched: true, is_verified_match: false, created_at: daysAgo(4) },
    { id: 'tm-5', strategy_id: 's1', signal_id: 'ls-6', trade_log_id: 'st-5', time_diff_sec: 60, price_diff_pct: 0.05, side_matched: true, is_verified_match: true, created_at: daysAgo(5) },
    { id: 'tm-6', strategy_id: 's1', signal_id: 'ls-7', trade_log_id: 'st-6', time_diff_sec: 90, price_diff_pct: 0.22, side_matched: true, is_verified_match: true, created_at: daysAgo(6) },
    { id: 'tm-7', strategy_id: 's1', signal_id: 'ls-8', trade_log_id: 'st-7', time_diff_sec: 15, price_diff_pct: 0.03, side_matched: true, is_verified_match: true, created_at: daysAgo(7) },
    { id: 'tm-8', strategy_id: 's1', signal_id: 'ls-9', trade_log_id: 'st-8', time_diff_sec: 55, price_diff_pct: 0.18, side_matched: true, is_verified_match: true, created_at: daysAgo(9) },
    { id: 'tm-9', strategy_id: 's1', signal_id: 'ls-10', trade_log_id: 'st-9', time_diff_sec: 300, price_diff_pct: 0.85, side_matched: false, is_verified_match: false, created_at: daysAgo(10) },
    { id: 'tm-10', strategy_id: 's1', signal_id: 'ls-11', trade_log_id: 'st-10', time_diff_sec: 25, price_diff_pct: 0.1, side_matched: true, is_verified_match: true, created_at: daysAgo(12) },
  ],
}

// ── 3층. 판매자 체결 로그 ──────────────────────────────────
// 필드: seller_id, exchange_connection_id, exchange_name, executed_price, qty, order_id, trade_id
export const MOCK_SELLER_TRADES = {
  s1: [
    { id: 'st-1', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'BUY', executed_at: daysAgo(1.19), executed_price: 66830, qty: 0.015, order_id: 'ORD-1001', trade_id: 'T-1001' },
    { id: 'st-2', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'SELL', executed_at: daysAgo(2.48), executed_price: 68090, qty: 0.012, order_id: 'ORD-1002', trade_id: 'T-1002' },
    { id: 'st-3', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'BUY', executed_at: daysAgo(3.09), executed_price: 65920, qty: 0.018, order_id: 'ORD-1003', trade_id: 'T-1003' },
    { id: 'st-4', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'SELL', executed_at: daysAgo(3.95), executed_price: 67320, qty: 0.01, order_id: 'ORD-1004', trade_id: 'T-1004' },
    { id: 'st-5', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'BUY', executed_at: daysAgo(5.19), executed_price: 66510, qty: 0.02, order_id: 'ORD-1005', trade_id: 'T-1005' },
    { id: 'st-6', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'SELL', executed_at: daysAgo(6.49), executed_price: 68480, qty: 0.013, order_id: 'ORD-1006', trade_id: 'T-1006' },
    { id: 'st-7', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'BUY', executed_at: daysAgo(7.79), executed_price: 65210, qty: 0.025, order_id: 'ORD-1007', trade_id: 'T-1007' },
    { id: 'st-8', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'BUY', executed_at: daysAgo(8.99), executed_price: 64780, qty: 0.016, order_id: 'ORD-1008', trade_id: 'T-1008' },
    { id: 'st-9', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'SELL', executed_at: daysAgo(10.45), executed_price: 67200, qty: 0.011, order_id: 'ORD-1009', trade_id: 'T-1009' },
    { id: 'st-10', seller_id: 'mock-seller', exchange_connection_id: 'conn-1', exchange_name: 'binance', symbol: 'BTCUSDT', side: 'BUY', executed_at: daysAgo(11.99), executed_price: 63520, qty: 0.022, order_id: 'ORD-1010', trade_id: 'T-1010' },
  ],
}

// ── 3층. 인증 요약 ─────────────────────────────────────────
// 필드: last_30_signal_count, matched_signal_count, avg_time_diff_sec, verified_return_pct, verified_badge_level
export const MOCK_VERIFICATION_SUMMARY = {
  s1: {
    strategy_id: 's1',
    last_30_signal_count: 30,
    matched_signal_count: 25,
    match_rate: 82,
    avg_price_diff_pct: 0.42,
    avg_time_diff_sec: 12,
    verified_return_pct: 6.4,
    verified_badge_level: 'trade_verified',
    updated_at: daysAgo(0),
  },
  s2: {
    strategy_id: 's2',
    last_30_signal_count: 4,
    matched_signal_count: 0,
    match_rate: 0,
    avg_price_diff_pct: 0,
    avg_time_diff_sec: 0,
    verified_return_pct: 0,
    verified_badge_level: 'live_verified',
    updated_at: daysAgo(0),
  },
  s6: {
    strategy_id: 's6',
    last_30_signal_count: 0,
    matched_signal_count: 0,
    match_rate: 0,
    avg_price_diff_pct: 0,
    avg_time_diff_sec: 0,
    verified_return_pct: 0,
    verified_badge_level: 'backtest_only',
    updated_at: daysAgo(0),
  },
}

// ── 거래소 연결 상태 ───────────────────────────────────────
// 필드: seller_id, exchange_name, encrypted_api_key, encrypted_secret, permission_scope, last_sync_at, last_error
export const MOCK_EXCHANGE_CONNECTIONS = [
  {
    id: 'conn-1',
    seller_id: 'mock-seller',
    exchange_name: 'binance',
    is_active: true,
    permission_scope: 'read_only',
    api_key_masked: 'abcd****wxyz',
    permission_read: true,
    permission_trade: false,
    permission_withdraw: false,
    last_connection_test_at: daysAgo(0.05),
    connection_test_ok: true,
    last_sync_at: daysAgo(0.1),
    last_error: null,
    created_at: daysAgo(30),
    updated_at: daysAgo(0.1),
  },
]

// ── 헬퍼: 전략 ID로 데이터 조회 ───────────────────────────
export function getMockBacktestMetrics(strategyId) {
  return MOCK_BACKTEST_METRICS[strategyId] ?? null
}

export function getMockLiveSignals(strategyId) {
  return MOCK_LIVE_SIGNALS[strategyId] ?? []
}

export function getMockLivePerformanceDaily(strategyId) {
  return MOCK_LIVE_PERFORMANCE_DAILY[strategyId] ?? []
}

export function getMockTradeMatches(strategyId) {
  return MOCK_TRADE_MATCHES[strategyId] ?? []
}

export function getMockSellerTrades(strategyId) {
  return MOCK_SELLER_TRADES[strategyId] ?? []
}

export function getMockVerificationSummary(strategyId) {
  return MOCK_VERIFICATION_SUMMARY[strategyId] ?? {
    strategy_id: strategyId,
    last_30_signal_count: 0,
    matched_signal_count: 0,
    match_rate: 0,
    avg_price_diff_pct: 0,
    avg_time_diff_sec: 0,
    verified_return_pct: 0,
    verified_badge_level: 'backtest_only',
    updated_at: new Date().toISOString(),
  }
}

export function getMockLivePerformanceSummary(strategyId) {
  const daily = getMockLivePerformanceDaily(strategyId)
  if (!daily.length) return { roi7d: null, roi30d: null, roi90d: null, latestMdd: null, totalTrades: 0, winRate: null }
  const last = daily[daily.length - 1]
  const d7 = daily.filter((r) => {
    const diff = (Date.now() - new Date(r.as_of).getTime()) / 86400000
    return diff <= 7
  })
  const d30 = daily.filter((r) => {
    const diff = (Date.now() - new Date(r.as_of).getTime()) / 86400000
    return diff <= 30
  })
  const roi7d = d7.length >= 2 ? +(d7[d7.length - 1].cumulative_roi - d7[0].cumulative_roi).toFixed(2) : null
  const roi30d = d30.length >= 2 ? +(d30[d30.length - 1].cumulative_roi - d30[0].cumulative_roi).toFixed(2) : null
  return {
    roi7d,
    roi30d,
    roi90d: null,
    latestMdd: last.mdd,
    totalTrades: last.trade_count,
    winRate: last.win_rate,
  }
}

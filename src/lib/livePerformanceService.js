/**
 * 라이브 성과 조회 서비스 (2층: 라이브 검증)
 * live_signals / live_performance_daily 중심
 *
 * 쓰기는 서버에서만 수행. 프론트는 읽기 전용.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import {
  getMockLiveSignals,
  getMockLivePerformanceDaily,
  getMockLivePerformanceSummary,
} from '../data/verificationMockData'

export async function fetchLiveSignals(strategyId, { days = 30 } = {}) {
  if (!isSupabaseConfigured() || !supabase) {
    const all = getMockLiveSignals(strategyId)
    const cutoff = Date.now() - days * 86400000
    return all.filter((s) => new Date(s.signal_time).getTime() >= cutoff)
  }
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data, error } = await supabase
      .from('live_signals')
      .select('*')
      .eq('strategy_id', strategyId)
      .gte('signal_time', since)
      .order('signal_time', { ascending: false })
    if (error) throw error
    return data ?? []
  } catch (e) {
    console.warn('fetchLiveSignals 실패:', e)
    return getMockLiveSignals(strategyId)
  }
}

export async function fetchLivePerformanceDaily(strategyId, { days = 30 } = {}) {
  if (!isSupabaseConfigured() || !supabase) {
    const all = getMockLivePerformanceDaily(strategyId)
    const cutoff = Date.now() - days * 86400000
    return all.filter((r) => new Date(r.as_of).getTime() >= cutoff)
  }
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('live_performance_daily')
      .select('*')
      .eq('strategy_id', strategyId)
      .gte('as_of', since)
      .order('as_of', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch (e) {
    console.warn('fetchLivePerformanceDaily 실패:', e)
    return getMockLivePerformanceDaily(strategyId)
  }
}

export async function fetchLivePerformanceSummary(strategyId) {
  if (!isSupabaseConfigured() || !supabase) {
    return getMockLivePerformanceSummary(strategyId)
  }
  try {
    const [d7, d30, d90] = await Promise.all([
      fetchLivePerformanceDaily(strategyId, { days: 7 }),
      fetchLivePerformanceDaily(strategyId, { days: 30 }),
      fetchLivePerformanceDaily(strategyId, { days: 90 }),
    ])
    return {
      roi7d: calcPeriodRoi(d7),
      roi30d: calcPeriodRoi(d30),
      roi90d: calcPeriodRoi(d90),
      latestMdd: d30.length ? d30[d30.length - 1].mdd : null,
      totalTrades: d30.length ? d30[d30.length - 1].trade_count : 0,
      winRate: d30.length ? d30[d30.length - 1].win_rate : null,
    }
  } catch (e) {
    console.warn('fetchLivePerformanceSummary 실패:', e)
    return getMockLivePerformanceSummary(strategyId)
  }
}

function calcPeriodRoi(daily) {
  if (!daily || daily.length < 2) return null
  const first = daily[0].cumulative_roi
  const last = daily[daily.length - 1].cumulative_roi
  return +(last - first).toFixed(2)
}

import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function normalizeErrorMessage(e) {
  const msg = String(e?.message ?? '').trim()
  return msg || '요청을 처리하지 못했습니다.'
}

function toNumberOrNull(v) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizePerformance(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function aggregateStrategyStats(rows) {
  const list = Array.isArray(rows) ? rows : []
  const strategy_count = list.length
  if (strategy_count === 0) return null

  const rois = []
  const wins = []
  const mdds = []

  for (const row of list) {
    const perf = normalizePerformance(row?.performance)
    if (!perf) continue

    const roi = toNumberOrNull(perf.roi ?? perf.totalReturnPct ?? perf.total_return ?? perf.return)
    const win = toNumberOrNull(perf.winRate ?? perf.win_rate)
    const mdd = toNumberOrNull(perf.mdd ?? perf.maxDrawdown ?? perf.max_drawdown)

    if (roi != null) rois.push(roi)
    if (win != null) wins.push(win)
    if (mdd != null) mdds.push(mdd)
  }

  const avg = (arr) => {
    if (!arr.length) return null
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }

  return {
    strategy_count,
    total_return: avg(rois),
    win_rate: avg(wins),
    mdd: avg(mdds),
  }
}

export function useTraderProfile(handle) {
  const safeHandle = useMemo(() => String(handle ?? '').trim(), [handle])
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewerId, setViewerId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!safeHandle) {
        setProfile(null)
        setStats(null)
        setViewerId(null)
        setError('')
        return
      }

      if (!isSupabaseConfigured() || !supabase) {
        setProfile(null)
        setStats(null)
        setViewerId(null)
        setError('Supabase 환경변수가 설정되지 않았습니다.')
        return
      }

      setIsLoading(true)
      setError('')
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData?.session?.user?.id ?? null
        if (!cancelled) setViewerId(uid)

        const { data: row, error: profileError } = await supabase
          .from('profiles')
          .select('id,handle,nickname,avatar_url,banner_url,bio,style_tags,is_trader,trader_verified_at,follower_count,following_count,post_count,total_likes,created_at')
          .ilike('handle', safeHandle)
          .maybeSingle()
        if (profileError) throw profileError

        if (cancelled) return
        setProfile(row ?? null)

        if (!row?.id) {
          setStats(null)
          return
        }

        const { data: strategies, error: strategiesError } = await supabase
          .from('strategies')
          .select('id,performance,status,creator_id')
          .eq('creator_id', row.id)
          .eq('status', 'published')
        if (strategiesError) {
          setStats(null)
          return
        }

        setStats(aggregateStrategyStats(strategies))
      } catch (e) {
        if (cancelled) return
        setProfile(null)
        setStats(null)
        setError(normalizeErrorMessage(e))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [safeHandle])

  const isOwner = Boolean(viewerId && profile?.id && viewerId === profile.id)

  return { profile, stats, isLoading, error, isOwner }
}


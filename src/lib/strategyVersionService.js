import { supabase, isSupabaseConfigured } from './supabase'

function mustSupa() {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
}

export async function insertStrategyVersionSnapshot({
  strategyId,
  versionNo,
  snapshot,
  code = '',
}) {
  mustSupa()
  if (!strategyId) throw new Error('strategyId가 필요합니다.')
  if (!Number.isFinite(Number(versionNo))) throw new Error('versionNo가 필요합니다.')
  const { data, error } = await supabase
    .from('strategy_versions')
    .insert({
      strategy_id: strategyId,
      version_no: Number(versionNo),
      code: code ?? '',
      snapshot: snapshot ?? {},
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function listStrategyVersions(strategyId) {
  if (!isSupabaseConfigured() || !supabase || !strategyId) return []
  const { data, error } = await supabase
    .from('strategy_versions')
    .select('id,strategy_id,version_no,created_at,snapshot')
    .eq('strategy_id', strategyId)
    .order('version_no', { ascending: false })
  if (error) throw error
  return data ?? []
}


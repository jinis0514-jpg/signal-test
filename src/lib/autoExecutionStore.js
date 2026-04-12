/**
 * 전략 자동 실행 설정·상태·기록 (로컬 영속화, 데모/프리플라이트용)
 */

const KEY = 'bb_auto_execution_v1'

export function defaultAutoExecutionState() {
  return {
    status: 'idle',
    strategyId: '',
    strategyName: '',
    investKrw: 500_000,
    riskPct: 2,
    stopLossPct: 1.5,
    history: [],
  }
}

export function loadAutoExecutionState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultAutoExecutionState()
    const p = JSON.parse(raw)
    const base = {
      ...defaultAutoExecutionState(),
      ...p,
      history: Array.isArray(p.history) ? p.history : [],
    }
    if (base.status === 'running') {
      base.status = 'stopped'
    }
    return base
  } catch {
    return defaultAutoExecutionState()
  }
}

export function saveAutoExecutionState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function appendHistoryEntry(state, entry) {
  const row = {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    ...entry,
  }
  return {
    ...state,
    history: [row, ...(state.history ?? [])].slice(0, 200),
  }
}

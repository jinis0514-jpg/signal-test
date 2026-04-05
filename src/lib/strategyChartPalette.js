/**
 * 전략별 고정 색상 — 차트 마커 · 범례 · 리스트에서 동일 키로 사용
 * (예시 키 + 동적 id는 팔레트 순환)
 */
export const STRATEGY_COLORS = {
  strategyA: '#2962ff',
  strategyB: '#ea3943',
  strategyC: '#16c784',
  strategyD: '#f59e0b',
  strategyE: '#8b5cf6',
}

export const DEFAULT_STRATEGY_PALETTE = [
  '#2962ff',
  '#ea3943',
  '#16c784',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b',
]

/**
 * @param {string} strategyKey
 * @param {number} [indexFallback]
 * @returns {string}
 */
export function getStrategyChartColor(strategyKey, indexFallback = 0) {
  if (strategyKey != null && STRATEGY_COLORS[strategyKey] != null) {
    return STRATEGY_COLORS[strategyKey]
  }
  const k = String(strategyKey ?? '')
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return DEFAULT_STRATEGY_PALETTE[h % DEFAULT_STRATEGY_PALETTE.length]
}

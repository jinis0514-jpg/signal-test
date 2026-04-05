/**
 * 검증 지표 기반 개선 제안 (경고는 retentionAlerts.js)
 */

/**
 * @param {{ roi: number, winRate: number, mdd: number, trades: number }} pd
 * @returns {{ suggestions: string[] }}
 */
export function buildValidationImprovementHints(pd) {
  const suggestions = []
  const mdd = Number(pd?.mdd)
  const winRate = Number(pd?.winRate)

  if ((Number.isFinite(mdd) && mdd >= 12) || (Number.isFinite(winRate) && winRate < 48)) {
    suggestions.push('조건을 줄여보세요')
  }
  if (Number.isFinite(mdd) && mdd >= 15) {
    suggestions.push('손절을 낮춰보세요')
  }

  return {
    suggestions: [...new Set(suggestions)],
  }
}

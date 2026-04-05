/**
 * 카드·상세에 쓰는 자연어 요약 (DB description + 적합도 등 결합)
 */
export function buildStrategyNarrative(strategy) {
  if (!strategy || typeof strategy !== 'object') return ''
  const desc = String(strategy.description ?? strategy.desc ?? '').trim()
  const fit = String(strategy.fitSummary ?? '').trim()
  const detail = String(strategy.fitDetail ?? '').trim()

  const parts = []
  if (desc) parts.push(desc)
  if (fit && fit !== desc) parts.push(fit)
  if (detail && detail !== fit) parts.push(detail)

  if (parts.length === 0) {
    return '이 전략은 백테스트·검증 지표를 바탕으로 마켓에 노출됩니다. 아래 수치와 시장 적합도를 참고하세요.'
  }
  return parts.join('\n\n')
}

/** 신뢰 배지 중 사용자에게 강조할 키 */
export const CORE_TRUST_BADGE_KEYS = new Set(['operator', 'test', 'review_ok'])

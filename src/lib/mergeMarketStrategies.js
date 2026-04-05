import { normalizeMarketStrategy } from './marketStrategy'
import { OPERATOR_STRATEGIES_RAW } from '../data/operatorStrategies'

/**
 * DB 승인 전략 + 운영자 전략 병합 (운영자 id 우선 유지, DB와 중복 id 없음)
 * @param {object[]} dbRowsNormalized 이미 normalizeMarketStrategy 등으로 맞춘 행
 */
export function mergeApprovedAndOperator(dbRowsNormalized = []) {
  const opMapped = OPERATOR_STRATEGIES_RAW.map((raw) => normalizeMarketStrategy({
    ...raw,
    isDbStrategy: false,
    isOperator: true,
  }))
  return [...opMapped, ...(dbRowsNormalized ?? [])]
}

/**
 * 전략을 SSOT 문자열 `code`로 직렬화/역직렬화
 * - UI(빌더) 전략: JSON { v, kind: 'builder', conditions, risk_config, ... }
 * - 코드 에디터: DSL 문자열 또는 전략 JSON(비 빌더) 그대로
 */

import { normalizeStrategyPayload } from './strategyPayload'

export const CODE_KIND_BUILDER = 'builder'
export const CODE_KIND_METHOD = 'method'

/**
 * 저장용 canonical `code` 문자열 생성
 * @param {object} raw collectData / upsert 입력
 */
export function buildCanonicalCodeFromPayload(raw) {
  const p = normalizeStrategyPayload(raw ?? {})
  const type = String(raw?.type ?? p.type ?? 'signal')

  if (type === 'method') {
    return JSON.stringify(
      {
        v: 1,
        kind: CODE_KIND_METHOD,
        linked_signal_strategy_id: p.linked_signal_strategy_id ?? null,
      },
      null,
      2,
    )
  }

  const c = String(raw?.code ?? p.code ?? '').trim()
  const mode = String(p.mode ?? 'nocode')

  if (mode === 'code' && c) {
    if (!c.startsWith('{')) return c
    try {
      const j = JSON.parse(c)
      if (j.kind === CODE_KIND_BUILDER) {
        return JSON.stringify(
          {
            v: 1,
            kind: CODE_KIND_BUILDER,
            asset: p.asset,
            timeframe: p.timeframe,
            riskLevel: p.riskLevel,
            tags: p.tags ?? [],
            conditions: p.conditions ?? [],
            conditionLogic: p.conditionLogic ?? null,
            risk_config: p.risk_config,
            entryExitSplit: !!p.entryExitSplit,
            entryConditions: p.entryConditions ?? [],
            exitConditions: p.exitConditions ?? [],
          },
          null,
          2,
        )
      }
      return c
    } catch {
      return c
    }
  }

  return JSON.stringify(
    {
      v: 1,
      kind: CODE_KIND_BUILDER,
      asset: p.asset,
      timeframe: p.timeframe,
      riskLevel: p.riskLevel,
      tags: p.tags ?? [],
      conditions: p.conditions ?? [],
      conditionLogic: p.conditionLogic ?? null,
      risk_config: p.risk_config,
      entryExitSplit: !!p.entryExitSplit,
      entryConditions: p.entryConditions ?? [],
      exitConditions: p.exitConditions ?? [],
    },
    null,
    2,
  )
}

/**
 * code 문자열이 빌더 JSON이면 파싱 결과 반환, 아니면 null
 * @param {string} code
 */
export function tryParseBuilderCode(code) {
  const s = String(code ?? '').trim()
  if (!s.startsWith('{')) return null
  try {
    const j = JSON.parse(s)
    if (j.kind !== CODE_KIND_BUILDER || j.v !== 1) return null
    return j
  } catch {
    return null
  }
}

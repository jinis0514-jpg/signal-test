/**
 * 마켓 제출 자동 검증 — 전략 메타 + 백테스트 결과
 * @see runMarketSubmissionCheck (비동기 캔들·엔진)
 */

import { normalizeStrategyPayload, normalizeConditions } from './strategyPayload'

export const MIN_MARKET_TRADES = 30
/** 백테스트 구간 최소 일수 (약 3개월) */
export const MIN_MARKET_PERIOD_DAYS = 90
/** MDD(%) 상한 — 초과 시 제출 불가 */
export const MAX_MARKET_MDD_BLOCK = 85
/** MDD(%) — 초과 시 경고만 */
export const WARN_MARKET_MDD_PCT = 65
/** 수익률(%) — 비정상 의심 시 경고 */
export const WARN_ABS_ROI_PCT = 400
export const LIVE_TRADE_DISCLAIMER = '참고용 데이터이며, 검증 기준이 아닙니다'

function looksMeaninglessText(text) {
  const s = String(text ?? '').trim()
  if (!s) return true
  // 너무 짧으면 의미 없는 제출로 간주
  if (s.length < 40) return true
  // 반복 문자/키보드 난수류
  const lowered = s.toLowerCase()
  const junk = ['asdf', 'qwer', 'test', '테스트', '1234', 'aaaa', 'bbbb']
  if (junk.some((j) => lowered.includes(j))) return true
  // 글자(한글/영문) 비율이 너무 낮으면 차단 (링크/이모지/기호만)
  const letters = s.match(/[A-Za-z가-힣]/g)?.length ?? 0
  if (letters < 12) return true
  return false
}

function validateMethodForSubmission(s) {
  const errors = []
  const warnings = []

  const name = String(s.name ?? '').trim()
  if (!name) errors.push('매매법 이름을 입력해 주세요.')

  const desc = String(s.description ?? s.desc ?? '').trim()
  if (!desc) {
    errors.push('매매법 설명을 입력해 주세요.')
  } else {
    if (looksMeaninglessText(desc)) errors.push('설명이 너무 짧거나 의미 없는 내용으로 보입니다. 구체적인 매매 규칙·예외·리스크를 포함해 주세요.')
  }

  const pdfPath = String(s.method_pdf_path ?? '').trim()
  if (!pdfPath) errors.push('PDF 파일을 업로드해 주세요.')

  const linked = String(s.linked_signal_strategy_id ?? '').trim()
  if (!linked) errors.push('연결된 실행 전략(signal)을 선택해 주세요.')

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * @param {object|null|undefined} backtestResult
 * @param {number} [backtestResult.totalTrades]
 * @param {number} [backtestResult.mdd]
 * @param {number} [backtestResult.winRate]
 * @param {number} [backtestResult.roi]
 * @param {number} [backtestResult.periodDays] 캔들 첫·끝 시각 기준 일수
 * @param {boolean} [backtestResult.hasBacktest] 파이프라인 성공 여부
 */
export function validateStrategyForSubmission(strategy, backtestResult) {
  const errors = []
  const warnings = []
  const s = normalizeStrategyPayload(strategy ?? {})

  // method(PDF 매매법) 제출은 백테스트 대신 연결/콘텐츠 기준으로 판단
  if (String(s.type ?? 'signal') === 'method') {
    return validateMethodForSubmission(s)
  }

  // signal(실행 전략): "PDF 또는 설명" 중 하나는 반드시 제공되어야 함.
  // - PDF가 없으면 구조화 설명 5종을 필수로 강제
  // - PDF가 있으면 최소한 전략 요약/리스크는 텍스트로도 남겨 검색/검수/가이드에 쓰도록 유지
  const hasPdf = !!String(s.strategy_pdf_path ?? '').trim() || !!String(s.strategy_pdf_preview_path ?? '').trim()

  const strategySummary = String(s.strategy_summary ?? '').trim()
  const entryLogic = String(s.entry_logic ?? '').trim()
  const exitLogic = String(s.exit_logic ?? '').trim()
  const marketCondition = String(s.market_condition ?? '').trim()
  const riskDescription = String(s.risk_description ?? '').trim()

  if (!hasPdf) {
    if (looksMeaninglessText(strategySummary)) errors.push('전략 요약(strategy_summary)을 충분히 작성해 주세요. (또는 PDF를 업로드해 주세요.)')
    if (looksMeaninglessText(entryLogic)) errors.push('진입 로직(entry_logic)을 충분히 작성해 주세요. (또는 PDF를 업로드해 주세요.)')
    if (looksMeaninglessText(exitLogic)) errors.push('청산 로직(exit_logic)을 충분히 작성해 주세요. (또는 PDF를 업로드해 주세요.)')
    if (!marketCondition || marketCondition.length < 30) errors.push('시장 설명(market_condition)을 충분히 작성해 주세요. (또는 PDF를 업로드해 주세요.)')
    if (!riskDescription || riskDescription.length < 30) errors.push('리스크 설명(risk_description)을 충분히 작성해 주세요. (또는 PDF를 업로드해 주세요.)')
  } else {
    if (looksMeaninglessText(strategySummary)) errors.push('PDF가 있더라도 전략 요약(strategy_summary)은 간단히라도 작성해 주세요.')
    if (!riskDescription || riskDescription.length < 30) errors.push('PDF가 있더라도 리스크 설명(risk_description)은 간단히라도 작성해 주세요.')
  }

  // 실매매(참고) 데이터: optional. 포함 시 고정 문구를 반드시 함께 제공.
  const liveText = String(s.live_trading_text ?? '').trim()
  if (liveText) {
    if (!liveText.includes(LIVE_TRADE_DISCLAIMER)) {
      errors.push(`실매매(참고) 데이터를 입력할 경우 반드시 다음 문구를 포함해야 합니다: "${LIVE_TRADE_DISCLAIMER}"`)
    }
  }

  const name = String(s.name ?? '').trim()
  if (!name) errors.push('전략명을 입력해 주세요.')

  // description은 레거시 필드(선택). 검수는 구조화 설명 중심으로 진행.

  const conds = normalizeConditions(s.conditions ?? [])
  if (!Array.isArray(conds) || conds.length === 0) {
    errors.push('진입 조건을 1개 이상 설정해 주세요.')
  }

  const br = backtestResult && typeof backtestResult === 'object' ? backtestResult : null
  if (!br || !br.hasBacktest) {
    errors.push('백테스트 결과를 산출할 수 없습니다. 자산·봉 간격·조건을 확인해 주세요.')
  } else {
    const trades = Number(br.totalTrades)
    if (!Number.isFinite(trades) || trades < MIN_MARKET_TRADES) {
      errors.push(
        `최소 거래 수 ${MIN_MARKET_TRADES}회 이상이어야 합니다. (현재 ${Number.isFinite(trades) ? trades : 0}회)`,
      )
    }

    const pd = Number(br.periodDays)
    if (!Number.isFinite(pd) || pd < MIN_MARKET_PERIOD_DAYS) {
      errors.push(
        `백테스트 데이터 구간이 최소 ${MIN_MARKET_PERIOD_DAYS}일(약 3개월) 이상이어야 합니다. (현재 약 ${Number.isFinite(pd) ? Math.round(pd) : 0}일) 짧은 봉은 조회 한도로 구간이 부족할 수 있어 봉 간격을 키우는 것을 권장합니다.`,
      )
    }

    const mdd = Number(br.mdd)
    if (Number.isFinite(mdd) && mdd > MAX_MARKET_MDD_BLOCK) {
      errors.push(`MDD가 ${MAX_MARKET_MDD_BLOCK}%를 초과하여 제출할 수 없습니다. (현재 ${mdd}%)`)
    } else if (Number.isFinite(mdd) && mdd > WARN_MARKET_MDD_PCT) {
      warnings.push(`MDD가 ${mdd}%로 높습니다. 검수 시 유의될 수 있습니다.`)
    }

    const roi = Number(br.roi)
    if (Number.isFinite(roi) && Math.abs(roi) > WARN_ABS_ROI_PCT) {
      warnings.push('누적 수익률이 매우 큽니다. 데이터·과최적화 여부를 점검해 주세요.')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

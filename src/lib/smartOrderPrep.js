/**
 * SMART MODE — 진입가·방향·추천 금액 (자동 주문 아님, 사용자 실행 전 준비용)
 */

import { loadAutoExecutionState } from './autoExecutionStore'

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/**
 * @param {object} opts
 * @param {{ type?: string, entryPrice?: number, entryTime?: number } | null} opts.openPos
 * @param {number} opts.markPriceUsd — 현재가(포지션 없을 때 진입 참고)
 * @param {{ type?: string, direction?: string, price?: number } | null} opts.hintSignal — 최근 ENTRY 등
 * @param {number} [opts.investKrwOverride]
 * @param {number} [opts.riskPctOverride]
 */
export function buildSmartOrderPrep({
  openPos = null,
  markPriceUsd = 0,
  hintSignal = null,
  investKrwOverride,
  riskPctOverride,
} = {}) {
  const ae = loadAutoExecutionState()
  const investKrw = investKrwOverride != null ? safeNum(investKrwOverride, 500_000) : safeNum(ae.investKrw, 500_000)
  const riskPct = riskPctOverride != null ? safeNum(riskPctOverride, 2) : safeNum(ae.riskPct, 2)

  let entryPrice = safeNum(markPriceUsd, 0)
  let direction = 'LONG'

  if (openPos && String(openPos.type).toUpperCase() === 'SHORT') {
    direction = 'SHORT'
    entryPrice = safeNum(openPos.entryPrice, entryPrice)
  } else if (openPos && String(openPos.type).toUpperCase() === 'LONG') {
    direction = 'LONG'
    entryPrice = safeNum(openPos.entryPrice, entryPrice)
  } else {
    const d = String(hintSignal?.direction ?? hintSignal?.type ?? 'LONG').toUpperCase()
    direction = d === 'SHORT' ? 'SHORT' : 'LONG'
    const ep = safeNum(hintSignal?.price, 0)
    if (ep > 0) entryPrice = ep
    else if (entryPrice <= 0) entryPrice = safeNum(markPriceUsd, 0)
  }

  if (entryPrice <= 0) entryPrice = safeNum(markPriceUsd, 0)

  const portion = Math.min(0.25, Math.max(0.04, riskPct / 12))
  const recommendedKrw = Math.max(50_000, Math.round(investKrw * portion))

  return {
    entryPrice,
    direction,
    recommendedKrw,
    investKrw,
    riskPct,
  }
}

export function formatSmartOrderPrepClipboard({
  pairLabel = 'BTCUSDT',
  entryPrice,
  direction,
  recommendedKrw,
  /** 사용자가 입력한 수량·메모(있을 때만 클립보드에 포함) */
  quantityNote = '',
}) {
  const ep = safeNum(entryPrice, 0)
  const dir = String(direction).toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG'
  const q = String(quantityNote ?? '').trim()
  const lines = [
    '[BB SMART MODE · 주문 참고]',
    `심볼: ${pairLabel}`,
    `방향: ${dir}`,
    `진입 가격(참고, USDT): ${ep > 0 ? ep.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}`,
    `추천 금액(참고, 원): ${Number(recommendedKrw).toLocaleString()}원`,
  ]
  if (q) {
    lines.push(`수량(직접 입력): ${q}`)
  }
  lines.push('', '※ 자동 주문 아님. 거래소에서 본인이 확인 후 주문하세요.')
  return lines.join('\n')
}

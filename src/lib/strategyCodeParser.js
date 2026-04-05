/**
 * 전략 DSL → normalizeStrategyPayload 호환 payload
 * - 섹션형: entry:/exit:/risk: (GPT 친화)
 * - 레거시: entry = rsi < 30 (키=값 줄)
 */

import { DEFAULT_RISK_CONFIG } from './strategyPayload'

export const DEFAULT_STRATEGY_CODE_TEMPLATE = `entry:
  rsi < 30

exit:
  rsi > 70

risk:
  stop_loss: 2%
  take_profit: 5%
  rsi_period: 14
`

/** 외부 AI 붙여넣기용 샘플 */
export const AI_PASTE_SAMPLE_CODE = `entry:
  rsi < 30

exit:
  rsi > 70

risk:
  stop_loss: 2%
  take_profit: 5%
`

const RSI_RE = /^\s*rsi\s*(<=|>=|<|>)\s*([\d.]+)\s*$/i

function stripLineComment(line) {
  const h = line.indexOf('#')
  if (h < 0) return line
  return line.slice(0, h)
}

function parseRsiExpr(expr, lineNo) {
  const s = String(expr ?? '').trim()
  const m = s.match(RSI_RE)
  if (!m) {
    return {
      ok: false,
      error: { message: `RSI 식을 이해할 수 없습니다: "${s}"`, line: lineNo },
    }
  }
  const op = m[1]
  const val = Number(m[2])
  if (!Number.isFinite(val)) {
    return { ok: false, error: { message: 'RSI 임계값이 숫자가 아닙니다.', line: lineNo } }
  }
  return { ok: true, op, value: val }
}

function numVal(raw, lineNo, label) {
  const n = Number(String(raw ?? '').replace(/%/g, '').trim())
  if (!Number.isFinite(n)) {
    return { ok: false, error: { message: `${label} 값이 올바르지 않습니다.`, line: lineNo } }
  }
  return { ok: true, value: n }
}

/** risk·레거시 겸용 — % 있으면 제거, 없으면 숫자만 */
export function parsePercent(value, lineHint = 1) {
  const s = String(value ?? '').trim()
  if (!s) {
    throw new Error(`Line ${lineHint}: 값이 비어 있습니다`)
  }
  const bare = s.replace(/%/g, '').trim()
  const n = parseFloat(bare)
  if (!Number.isFinite(n)) {
    throw new Error(`Line ${lineHint}: 퍼센트 또는 숫자 형식이 필요합니다 (예: 2%)`)
  }
  return n
}

const OPS = ['<=', '>=', '<', '>']

function splitCompare(line) {
  const s = String(line ?? '').trim()
  for (const op of OPS) {
    const idx = s.indexOf(op)
    if (idx >= 0) {
      const left = s.slice(0, idx).trim()
      const right = s.slice(idx + op.length).trim()
      if (left && right) return { left, op, right }
    }
  }
  return null
}

function parseMaEmaArg(right) {
  const r = String(right ?? '').trim()
  const ma = r.match(/^ma\s*\(\s*(\d+)\s*\)$/i) || r.match(/^sma\s*\(\s*(\d+)\s*\)$/i)
  if (ma) return { kind: 'MA', period: Number(ma[1]) }
  const em = r.match(/^ema\s*\(\s*(\d+)\s*\)$/i)
  if (em) return { kind: 'EMA', period: Number(em[1]) }
  const num = Number(r)
  if (Number.isFinite(num)) return { kind: 'NUMBER', value: num }
  return null
}

function parseRsiSide(leftRaw, op, rightRaw, rsiDefaultPeriod) {
  const l = String(leftRaw ?? '').trim().toLowerCase()
  const mParen = l.match(/^rsi\s*\(\s*(\d+)\s*\)$/)
  const plain = l === 'rsi'
  if (!mParen && !plain) {
    throw new Error('RSI 표현은 rsi 또는 rsi(기간) 형식이어야 합니다.')
  }
  const period = mParen ? Math.max(2, Math.floor(Number(mParen[1]))) : rsiDefaultPeriod
  const rv = Number(String(rightRaw).trim())
  if (!Number.isFinite(rv)) {
    throw new Error('RSI 비교 오른쪽은 숫자여야 합니다.')
  }
  const opStr = op
  let direction = 'LONG'
  if (opStr === '>' || opStr === '>=') direction = 'SHORT'
  if (opStr === '<' || opStr === '<=') direction = 'LONG'
  return {
    indicator: 'RSI',
    period,
    operator: opStr,
    value: rv,
    direction,
    id: `dsl_rsi_${direction}_${period}_${rv}`.replace(/\W/g, '_'),
  }
}

/**
 * 한 줄 → 엔진 조건 (또는 DSL_OR)
 * @param {string} rawLine
 * @param {number} lineNo
 * @param {number} rsiDefaultPeriod
 */
function parseSectionLineToCondition(rawLine, lineNo, rsiDefaultPeriod) {
  let line = String(rawLine ?? '').trim()
  line = line.replace(/^\s*(and|그리고)\s+/i, '')
  const orParts = line.split(/\s+\bor\b\s+/i).map((p) => p.trim()).filter(Boolean)
  if (orParts.length === 0) {
    throw new Error(`Line ${lineNo}: 빈 조건`)
  }
  const parsed = orParts.map((part) => {
    const sc = splitCompare(part)
    if (!sc) {
      throw new Error(`Line ${lineNo}: 비교 연산자( <, >, <=, >= )가 없습니다`)
    }
    const left = sc.left.trim().toLowerCase()
    const rightRaw = sc.right.trim()

    if (left === 'rsi' || /^rsi\s*\(\s*\d+\s*\)$/.test(left)) {
      return parseRsiSide(sc.left.trim(), sc.op, rightRaw, rsiDefaultPeriod)
    }

    if (left === 'close') {
      const ref = parseMaEmaArg(rightRaw)
      if (!ref || ref.kind === 'NUMBER') {
        throw new Error(`Line ${lineNo}: close 비교는 ma(기간) 또는 ema(기간) 형식이어야 합니다`)
      }
      const ind = ref.kind === 'MA' ? 'PRICE_VS_SMA' : 'PRICE_VS_EMA'
      return {
        indicator: ind,
        period: ref.period,
        operator: sc.op,
        id: `dsl_${ind}_${ref.period}_${sc.op}`.replace(/\W/g, '_'),
      }
    }

    if (left === 'volume') {
      const mult = Number(rightRaw)
      if (!Number.isFinite(mult) || mult <= 0) {
        throw new Error(`Line ${lineNo}: volume 오른쪽은 양의 배수 숫자여야 합니다 (예: 2)`)
      }
      return {
        indicator: 'VOLUME_RATIO',
        multiplier: mult,
        volumePeriod: 20,
        operator: sc.op,
        id: `dsl_vol_${mult}`,
      }
    }

    throw new Error(`Line ${lineNo}: 지원하지 않는 좌변입니다 (rsi, close, volume)`)
  })

  if (parsed.length === 1) return parsed[0]
  return { indicator: 'DSL_OR', clauses: parsed, id: 'dsl_or_group' }
}

function looksLikeSectionDsl(code) {
  const lines = code.split(/\r?\n/)
  for (const raw of lines) {
    const line = stripLineComment(raw).trim()
    if (!line) continue
    if (/^entry\s*=/i.test(line)) return false
    if (/^exit\s*=/i.test(line)) return false
    if (/^entry\s*:/i.test(line)) return true
    if (/^exit\s*:/i.test(line)) return true
    if (/^risk\s*:/i.test(line)) return true
  }
  return false
}

function tryParsePercent(val, lineNo, label) {
  try {
    return { ok: true, value: parsePercent(val, lineNo) }
  } catch (e) {
    const msg = e?.message ? String(e.message) : String(e)
    return { ok: false, error: { message: `${label}: ${msg}`, line: lineNo } }
  }
}

/**
 * 섹션 DSL 파싱
 */
function parseSectionStrategyCode(code) {
  const lines = code.split(/\r?\n/)
  let section = null
  const acc = { entry: [], exit: [], risk: [] }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const trimmed = stripLineComment(lines[i]).trim()
    if (!trimmed) continue

    if (/^entry\s*:/i.test(trimmed)) {
      section = 'entry'
      continue
    }
    if (/^exit\s*:/i.test(trimmed)) {
      section = 'exit'
      continue
    }
    if (/^risk\s*:/i.test(trimmed)) {
      section = 'risk'
      continue
    }

    if (!section) {
      return {
        ok: false,
        error: { message: 'entry:, exit:, risk: 섹션으로 시작해야 합니다.', line: lineNum },
      }
    }

    if (section === 'risk') {
      const m = trimmed.match(/^([^:]+):\s*(.+)$/)
      if (!m) {
        return { ok: false, error: { message: 'risk 항목은 key: value 형식이어야 합니다.', line: lineNum } }
      }
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_')
      const value = m[2].trim()
      acc.risk.push({ key, value, line: lineNum })
      continue
    }

    acc[section].push({ text: trimmed, line: lineNum })
  }

  if (acc.entry.length === 0) {
    return { ok: false, error: { message: 'entry 조건이 없습니다.', line: 1 } }
  }
  if (acc.exit.length === 0) {
    return { ok: false, error: { message: 'exit 조건이 없습니다.', line: 1 } }
  }

  let rsiPeriod = 14
  const risk_config = { ...DEFAULT_RISK_CONFIG }

  for (const r of acc.risk) {
    if (r.key === 'rsi_period') {
      const n = numVal(r.value, r.line, 'rsi_period')
      if (!n.ok) return n
      rsiPeriod = Math.max(2, Math.floor(n.value))
      continue
    }
    if (r.key === 'stop_loss' || r.key === 'stop' || r.key === 'sl') {
      const n = tryParsePercent(r.value, r.line, 'stop_loss')
      if (!n.ok) return n
      risk_config.stopType = 'fixed_pct'
      risk_config.stopValue = String(Math.max(0.01, n.value))
      continue
    }
    if (r.key === 'take_profit' || r.key === 'tp' || r.key === 'profit') {
      const n = tryParsePercent(r.value, r.line, 'take_profit')
      if (!n.ok) return n
      risk_config.takeProfitPct = String(Math.max(0, n.value))
      continue
    }
    if (r.key === 'trailing_stop' || r.key === 'trailing') {
      const n = tryParsePercent(r.value, r.line, 'trailing_stop')
      if (!n.ok) return n
      risk_config.stopType = 'trailing'
      risk_config.trailingStopPct = String(Math.max(0.01, n.value))
      risk_config.stopValue = risk_config.trailingStopPct
      continue
    }
  }

  /** @type {object[]} */
  const entryConditions = []
  for (const row of acc.entry) {
    try {
      entryConditions.push(parseSectionLineToCondition(row.text, row.line, rsiPeriod))
    } catch (e) {
      return { ok: false, error: { message: e.message, line: row.line } }
    }
  }

  /** @type {object[]} */
  const exitConditions = []
  for (const row of acc.exit) {
    try {
      exitConditions.push(parseSectionLineToCondition(row.text, row.line, rsiPeriod))
    } catch (e) {
      return { ok: false, error: { message: e.message, line: row.line } }
    }
  }

  return {
    ok: true,
    payload: {
      mode: 'code',
      entryExitSplit: true,
      entryConditions,
      exitConditions,
      conditions: entryConditions,
      risk_config,
    },
  }
}

/**
 * 레거시 key=value DSL
 */
function parseLegacyKvDsl(code) {
  const lines = code.split(/\r?\n/)
  /** @type {Record<string, { value: string, line: number }>} */
  const kv = {}

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    let line = lines[i]
    const hash = line.indexOf('#')
    if (hash >= 0) line = line.slice(0, hash)
    line = line.trim()
    if (!line) continue

    const eq = line.indexOf('=')
    if (eq < 0) {
      return {
        ok: false,
        error: { message: `'=' 가 필요합니다: ${line.slice(0, 40)}`, line: lineNum },
      }
    }
    const key = line.slice(0, eq).trim().toLowerCase()
    const value = line.slice(eq + 1).trim()
    if (!key) {
      return { ok: false, error: { message: '키 이름이 비어 있습니다.', line: lineNum } }
    }
    kv[key] = { value, line: lineNum }
  }

  const warnings = []
  let rsiPeriod = 14
  if (kv.rsi_period) {
    const n = numVal(kv.rsi_period.value, kv.rsi_period.line, 'rsi_period')
    if (!n.ok) return n
    rsiPeriod = Math.max(2, Math.floor(n.value))
  }

  const entryRaw = kv.entry?.value
  const exitRaw = kv.exit?.value
  const hasEntry = entryRaw != null && String(entryRaw).trim() !== ''
  const hasExit = exitRaw != null && String(exitRaw).trim() !== ''

  /** @type {object[]} */
  const conditions = []

  if (hasEntry && hasExit) {
    const pe = parseRsiExpr(entryRaw, kv.entry.line)
    const px = parseRsiExpr(exitRaw, kv.exit.line)
    if (!pe.ok) return pe
    if (!px.ok) return px
    const entryIsRsi = RSI_RE.test(String(entryRaw).trim())
    const exitIsRsi = RSI_RE.test(String(exitRaw).trim())
    if (entryIsRsi && exitIsRsi) {
      const oversold = pe.value
      const overbought = px.value
      conditions.push({
        indicator: 'RSI',
        period: rsiPeriod,
        crossoverZones: true,
        oversold,
        overbought,
        id: 'dsl_rsi_zones',
      })
    } else {
      return {
        ok: false,
        error: {
          message: 'entry와 exit를 함께 쓸 때는 RSI 비교식이어야 합니다. (예: rsi < 30 / rsi > 70)',
          line: kv.entry.line,
        },
      }
    }
  } else if (hasEntry) {
    const pe = parseRsiExpr(entryRaw, kv.entry.line)
    if (!pe.ok) return pe
    conditions.push({
      indicator: 'RSI',
      period: rsiPeriod,
      operator: pe.op,
      value: pe.value,
      direction: 'LONG',
      id: 'dsl_entry_rsi',
    })
  } else if (hasExit) {
    const px = parseRsiExpr(exitRaw, kv.exit.line)
    if (!px.ok) return px
    conditions.push({
      indicator: 'RSI',
      period: rsiPeriod,
      operator: px.op,
      value: px.value,
      direction: 'SHORT',
      id: 'dsl_exit_rsi',
    })
  } else {
    return {
      ok: false,
      error: { message: 'entry 또는 exit 중 하나 이상을 입력해 주세요.', line: 1 },
    }
  }

  const risk_config = { ...DEFAULT_RISK_CONFIG }

  if (kv.stop_loss || kv.stop || kv.sl) {
    const src = kv.stop_loss ?? kv.stop ?? kv.sl
    const n = numVal(src.value, src.line, 'stop_loss')
    if (!n.ok) return n
    risk_config.stopType = 'fixed_pct'
    risk_config.stopValue = String(Math.max(0.01, n.value))
  }

  if (kv.take_profit || kv.tp || kv.profit) {
    const src = kv.take_profit ?? kv.tp ?? kv.profit
    const n = numVal(src.value, src.line, 'take_profit')
    if (!n.ok) return n
    risk_config.takeProfitPct = String(Math.max(0, n.value))
  }

  if (kv.trailing_stop || kv.trailing) {
    const src = kv.trailing_stop ?? kv.trailing
    const n = numVal(src.value, src.line, 'trailing_stop')
    if (!n.ok) return n
    risk_config.stopType = 'trailing'
    risk_config.trailingStopPct = String(Math.max(0.01, n.value))
    risk_config.stopValue = risk_config.trailingStopPct
  }

  if (kv.position_size || kv.pos) {
    const src = kv.position_size ?? kv.pos
    const n = numVal(src.value, src.line, 'position_size')
    if (!n.ok) return n
    risk_config.posSize = String(Math.min(100, Math.max(1, n.value)))
  }

  if (conditions.length === 0) {
    return { ok: false, error: { message: '진입 조건을 만들 수 없습니다.', line: 1 } }
  }

  return {
    ok: true,
    payload: {
      mode: 'code',
      conditions,
      risk_config,
    },
    warnings: warnings.length ? warnings : undefined,
  }
}

/**
 * @param {string} code
 * @returns {{
 *   ok: true,
 *   payload: object,
 *   warnings?: string[],
 * } | { ok: false, error: { message: string, line: number } }}
 */
export function parseStrategyCode(code) {
  if (!code || typeof code !== 'string') {
    return { ok: false, error: { message: '코드가 비어 있습니다.', line: 1 } }
  }
  const trimmed = code.trim()
  if (trimmed.startsWith('{')) {
    return { ok: false, error: { message: 'JSON 블록은 별도로 처리됩니다.', line: 1 } }
  }
  if (looksLikeSectionDsl(code)) {
    return parseSectionStrategyCode(code)
  }
  return parseLegacyKvDsl(code)
}

export function formatParseError(result) {
  if (result.ok) return ''
  const { message, line } = result.error
  return line ? `Line ${line}: ${message}` : message
}

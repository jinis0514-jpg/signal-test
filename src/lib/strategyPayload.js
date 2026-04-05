/**
 * 공통 전략 payload 정규화 · 표시 · 엔진 임시 매핑
 */

export const DEFAULT_RISK_CONFIG = {
  stopType: 'fixed_pct',
  stopValue: '',
  takeProfitPct: '',
  /** 트레일링 스탑 (%) — 최고/최저가 대비 이격 시 청산 (엔진) */
  trailingStopPct: '',
  posSize: '',
  maxOpenPos: '1',
  minSignalGap: '',
  allowReentry: false,
  /** 누적 자산 곡선 기준 피크 대비 최대 낙폭(%) — 초과 시 신규 진입 중단 (빈 값 = 미사용) */
  maxLossPct: '',
  /** 진입 후 N봉 경과 시 청산 (빈 값 = 미사용) */
  timeExitBars: '',
  /** ATR 기반 손절: 기간 / 배수 (stopType이 atr_stop 일 때) */
  atrPeriod: '14',
  atrMult: '2',
}

/**
 * 조건 1건을 엔진/추론용 preset ID로 (가능할 때만)
 * @param {unknown} cond
 * @returns {string | null}
 */
export function conditionToPresetId(cond) {
  if (cond == null) return null
  if (typeof cond === 'string') return cond
  if (typeof cond !== 'object') return null
  if (cond.kind === 'preset' && typeof cond.presetId === 'string') return cond.presetId
  if (typeof cond.presetId === 'string') return cond.presetId
  if (cond.indicator === 'EMA_CROSS' || cond.indicator === 'ema_cross') return 'ema_cross'
  if (cond.indicator === 'RSI' || cond.indicator === 'rsi') {
    const v = Number(cond.value)
    if (cond.operator === '<' && v <= 35) return 'rsi_ob_os'
    return 'rsi_mid'
  }
  if (cond.indicator === 'MACD' || cond.indicator === 'macd') return 'macd_cross'
  return null
}

/** strategyEngine.evaluateCondition 이 네이티브로 해석하는 리치 조건 (preset으로 뭉개지 않음) */
const NATIVE_ENGINE_INDICATORS = new Set([
  'RSI',
  'EMA_CROSS',
  'SMA_CROSS',
  'MACD_CROSS',
  'BB_TOUCH',
  'BB_SQUEEZE',
  'VOLUME_SURGE',
  'PRICE_VS_SMA',
  'PRICE_VS_EMA',
  'VOLUME_RATIO',
  'DSL_OR',
])

function isNativeRichCondition(c) {
  if (!c || typeof c !== 'object') return false
  const ind = String(c.indicator || '').toUpperCase()
  return NATIVE_ENGINE_INDICATORS.has(ind)
}

/**
 * string[] · 객체 배열 → 정규화된 조건 객체 배열
 * @param {unknown} raw
 * @returns {object[]}
 */
export function normalizeConditions(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c) => {
      if (typeof c === 'string') {
        return { kind: 'preset', presetId: c, id: c }
      }
      if (c && typeof c === 'object') {
        if (isNativeRichCondition(c)) {
          return { ...c }
        }
        const pid = conditionToPresetId(c)
        if (pid && !c.kind) {
          return { ...c, kind: c.kind ?? 'preset', presetId: c.presetId ?? pid, id: c.id ?? pid }
        }
        return { ...c }
      }
      return null
    })
    .filter(Boolean)
}

/**
 * 엔진(strategyConditions)이 이해하는 문자열 ID 목록
 * @param {unknown[]} conditions
 * @returns {string[]}
 */
export function extractConditionIds(conditions) {
  const n = normalizeConditions(conditions)
  const ids = []
  for (const c of n) {
    const id = conditionToPresetId(c)
    if (id) ids.push(id)
  }
  return ids
}

function mergeRiskConfig(...parts) {
  const out = { ...DEFAULT_RISK_CONFIG }
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue
    for (const k of Object.keys(DEFAULT_RISK_CONFIG)) {
      if (p[k] === undefined) continue
      if (k === 'allowReentry') {
        out[k] = !!p[k]
        continue
      }
      if (p[k] !== '') out[k] = p[k]
    }
  }
  return out
}

/**
 * 저장/표시/엔진 공통 정규 전략 객체
 * @param {object} raw
 */
export function normalizeStrategyPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: undefined,
      name: '',
      description: '',
      tags: [],
      asset: 'BTC',
      timeframe: '1h',
      mode: 'nocode',
      riskLevel: 'mid',
      conditions: [],
      code: '',
      risk_config: { ...DEFAULT_RISK_CONFIG },
      conditionLogic: null,
      desc: '',
    }
  }

  const riskFlat = {
    stopType: raw.stopType,
    stopValue: raw.stopValue,
    takeProfitPct: raw.takeProfitPct,
    trailingStopPct: raw.trailingStopPct,
    posSize: raw.posSize,
    maxOpenPos: raw.maxOpenPos,
    minSignalGap: raw.minSignalGap,
    allowReentry: raw.allowReentry,
    maxLossPct: raw.maxLossPct,
    timeExitBars: raw.timeExitBars,
    atrPeriod: raw.atrPeriod,
    atrMult: raw.atrMult,
  }

  const risk_config = mergeRiskConfig(raw.risk_config, riskFlat)

  const conditionLogic =
    raw.conditionLogic ??
    (raw.risk_config && typeof raw.risk_config === 'object' ? raw.risk_config.conditionLogic : null) ??
    null

  const description =
    (typeof raw.description === 'string' && raw.description.trim())
      ? raw.description.trim()
      : (typeof raw.desc === 'string' && raw.desc.trim())
        ? raw.desc.trim()
        : ''

  const entryConditions = normalizeConditions(raw.entryConditions)
  const exitConditions = normalizeConditions(raw.exitConditions)
  const entryExitSplit =
    !!raw.entryExitSplit && entryConditions.length > 0 && exitConditions.length > 0

  const conditions = entryExitSplit
    ? entryConditions
    : normalizeConditions(raw.conditions)

  return {
    ...raw,
    id: raw.id,
    name: (raw.name || '이름 없는 전략').trim(),
    description,
    desc: description || raw.desc || '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    asset: (raw.asset || 'BTC').toString().toUpperCase(),
    timeframe: raw.timeframe || '1h',
    mode: raw.mode || 'nocode',
    riskLevel: raw.riskLevel || 'mid',
    conditions,
    entryConditions,
    exitConditions,
    entryExitSplit,
    code: raw.code ?? '',
    risk_config: {
      ...risk_config,
      ...(conditionLogic != null ? { conditionLogic } : {}),
    },
    conditionLogic,
    minBarsBetweenEntries: raw.minBarsBetweenEntries,
    minEntryGapMs: raw.minEntryGapMs,
  }
}

const ENTRY_LABELS = {
  ema_cross: 'EMA 크로스 (20/50)',
  ema_cross_fast: 'EMA 크로스 (5/13)',
  macd_cross: 'MACD 시그널 크로스',
  rsi_ob_os: 'RSI 과매수/과매도',
  rsi_mid: 'RSI 중심선(50)',
  bb_squeeze: '볼린저 수축 돌파',
  bb_touch: '볼린저 터치',
  volume_surge: '거래량 급증',
  obv_div: 'OBV 다이버전스',
}

/**
 * 사람이 읽기 쉬운 한 줄
 * @param {unknown} cond
 */
export function formatCondition(cond) {
  if (typeof cond === 'string') {
    return ENTRY_LABELS[cond] ?? cond
  }
  if (!cond || typeof cond !== 'object') return '조건 없음'

  if (cond.kind === 'preset' && cond.presetId) {
    return ENTRY_LABELS[cond.presetId] ?? cond.presetId
  }

  if (cond.indicator === 'RSI') {
    const p = cond.period ?? 14
    const op = cond.operator ?? '<'
    const v = cond.value ?? '—'
    const dir = cond.direction ?? 'both'
    return `RSI(${p}) ${op} ${v} [${dir}]`
  }

  if (cond.indicator === 'EMA_CROSS' || cond.indicator === 'ema_cross') {
    const f = cond.fastPeriod ?? 20
    const s = cond.slowPeriod ?? 50
    const dir = cond.direction ?? 'long'
    return `EMA(${f}) / EMA(${s}) 골든·데드 크로스 [${dir}]`
  }

  if (cond.indicator === 'MACD') {
    return `MACD [${cond.direction ?? 'both'}]`
  }

  if (cond.indicator === 'PRICE_VS_SMA' || cond.indicator === 'PRICE_VS_EMA') {
    const kind = cond.indicator === 'PRICE_VS_EMA' ? 'EMA' : 'SMA'
    return `종가 ${cond.operator ?? '>'} ${kind}(${cond.period ?? 20})`
  }

  if (cond.indicator === 'VOLUME_RATIO') {
    return `거래량 ${cond.operator ?? '>'} ${cond.multiplier ?? 2}×평균`
  }

  if (cond.indicator === 'DSL_OR' && Array.isArray(cond.clauses)) {
    return `(${cond.clauses.map(formatCondition).join(' 또는 ')})`
  }

  return String(cond.indicator || cond.presetId || '사용자 조건')
}

/**
 * @param {unknown[]} conditions
 */
export function formatConditionsSummary(conditions) {
  const n = normalizeConditions(conditions)
  if (n.length === 0) return '—'
  return n.map(formatCondition).join(' · ')
}

/** 진입/청산 분리 DSL 요약 */
export function formatStrategyConditionsSummary(payload) {
  if (!payload || typeof payload !== 'object') return '—'
  if (
    payload.entryExitSplit
    && Array.isArray(payload.entryConditions)
    && payload.entryConditions.length > 0
    && Array.isArray(payload.exitConditions)
    && payload.exitConditions.length > 0
  ) {
    return `진입 ${formatConditionsSummary(payload.entryConditions)} → 청산 ${formatConditionsSummary(payload.exitConditions)}`
  }
  return formatConditionsSummary(payload.conditions)
}

/**
 * 에디터 다중 선택용: 조건 배열 → preset ID 배열
 * @param {unknown[]} conditions
 */
export function conditionsToEditorSelectedIds(conditions) {
  return extractConditionIds(conditions)
}

/**
 * 시뮬/검증 엔진용 설정 (legacy conditions ID + risk + 휴리스틱)
 *
 * @deprecated `buildEngineConfigFromUserStrategy` / `buildCatalogStrategyEngineConfig`
 *   (`strategyEngine.js`)를 사용하세요. 리치 조건·리스크 반영이 이 경로와 어긋날 수 있습니다.
 * @param {object|null} userStrat
 * @param {{ candles?: object[] }} options
 */
export function payloadToEngineStrategyConfig(userStrat, options = {}) {
  const n = normalizeStrategyPayload(userStrat || {})
  const ids = extractConditionIds(n.conditions)
  const risk = n.risk_config || { ...DEFAULT_RISK_CONFIG }

  let lookback = 5
  let modeHint = 'trend'
  if (ids.some((id) => /rsi/i.test(id))) modeHint = 'momentum'
  if (ids.some((id) => /ema|macd/.test(id))) lookback = 20
  if (ids.some((id) => /bb|squeeze|touch/.test(id))) modeHint = 'volatility'

  const minBars = risk.minSignalGap !== '' && risk.minSignalGap != null
    ? Math.max(0, Math.floor(Number(risk.minSignalGap)) || 1)
    : (n.minBarsBetweenEntries ?? 1)

  const allowReentry = risk.allowReentry === true || risk.allowReentry === 'true'

  return {
    lookback,
    mode: modeHint,
    conditions: ids.length ? ids : [],
    conditionLogic: n.conditionLogic ?? null,
    risk_config: {
      stopType: risk.stopType,
      stopValue: risk.stopValue,
      takeProfitPct: risk.takeProfitPct,
      posSize: risk.posSize,
      maxOpenPos: risk.maxOpenPos,
      minSignalGap: risk.minSignalGap,
      allowReentry: risk.allowReentry,
    },
    minBarsBetweenEntries: allowReentry ? 0 : minBars,
    minEntryGapMs: n.minEntryGapMs ?? 0,
    candles: options.candles,
  }
}

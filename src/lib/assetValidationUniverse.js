/**
 * 검증·마켓 신뢰도용 자산군 규칙 (시그널 차트 심볼과 분리)
 */
import { normalizeBinanceSymbol } from './marketCandles'

/** `userStrategies.isUserStrategyId`와 동일 — userStrategies를 import하면 순환 참조 위험 */
function looksLikeUserStrategyId(id) {
  return typeof id === 'string' && id.startsWith('user-')
}

/** 전략 자산 클래스별 Binance USDT 검증 심볼 1종 */
export const VALIDATION_USDT_PAIR = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
}

/** ALT 검증 코인 수 — 사용자(제작자) 선택 */
export const ALT_VALIDATION_MIN = 5
export const ALT_VALIDATION_MAX = 10

/**
 * 카탈로그·이전 데이터 호환용 기본 5종 (제작자 미지정 시)
 */
export const ALT_BASKET_USDT_PAIRS = [
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'DOTUSDT',
]

/** 에디터 빠른 추가용 (Binance USDT) */
export const SUGGESTED_ALT_USDT_PAIRS = [
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'MATICUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'SUIUSDT', 'INJUSDT', 'FILUSDT', 'LTCUSDT',
  'ETCUSDT', 'XLMUSDT', 'VETUSDT', 'ICPUSDT', 'ALGOUSDT',
]

export const SIGNAL_CHART_HINT =
  '차트 심볼은 직접 선택한 값입니다. 검증 성과는 아래 검증 코인 기준이며, 차트와 다를 수 있습니다.'

/** UI 보조 문구 (검증 카드 등) */
export const ALT_BASKET_LABEL_DETAIL = `Binance USDT · 제작자 선택 ${ALT_VALIDATION_MIN}~${ALT_VALIDATION_MAX}종`

export const copy = {
  altBasketValidation:
    'ALT 전략은 등록 시 선택한 여러 코인(최소 5·최대 10개)에 각각 백테스트한 뒤, 평균·분포·개별 성과를 함께 공개합니다.',
  signalChartVersusValidation:
    '검증·성과 지표는 선택한 검증 코인 묶음 기준이고, 아래 차트는 별도 심볼입니다.',
}

/** @param {string} raw */
export function normalizeAssetClassKey(raw) {
  const a = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/USDT$/i, '')
  if (a === 'BITCOIN' || a === 'BTC') return 'BTC'
  if (a === 'ETHEREUM' || a === 'ETH') return 'ETH'
  if (a === 'SOLANA' || a === 'SOL') return 'SOL'
  if (a === 'ALT' || a === 'ALTS' || a === '알트') return 'ALT'
  return ['BTC', 'ETH', 'SOL', 'ALT'].includes(a) ? a : 'BTC'
}

/**
 * @param {unknown} raw string[] 등
 * @returns {string[]} 정규화·중복 제거·순서 유지, ALT_VALIDATION_MAX까지
 */
export function normalizeAltValidationSymbols(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const item of raw) {
    const sym = normalizeBinanceSymbol(
      typeof item === 'string' ? item : String(item?.symbol ?? item?.pair ?? ''),
    )
    if (!sym || seen.has(sym)) continue
    seen.add(sym)
    out.push(sym)
    if (out.length >= ALT_VALIDATION_MAX) break
  }
  return out
}

/**
 * @param {{ asset?: string, assetType?: string } | null} strategy
 * @returns {'BTC'|'ETH'|'SOL'|'ALT'}
 */
export function getAssetClassFromStrategy(strategy) {
  if (!strategy || typeof strategy !== 'object') return 'BTC'
  const fromAsset = strategy.asset ?? strategy.assetType
  return normalizeAssetClassKey(fromAsset)
}

/**
 * 비-ALT 또는 catalog 기본 ALT용 단일/고정 목록
 */
export function getValidationPairsForAssetClass(assetClass) {
  const ac = normalizeAssetClassKey(assetClass)
  if (ac === 'ALT') return [...ALT_BASKET_USDT_PAIRS]
  const p = VALIDATION_USDT_PAIR[ac]
  return p ? [p] : ['BTCUSDT']
}

/**
 * ALT: 사용자 전략이면 5~10 필수, 카탈로그/기본은 default 바스켓
 * @param {object} strategyLike — userStrat, normalizeStrategyPayload 결과, { id, asset, altValidationSymbols, isUserStrategy }
 * @returns {{ pairs: string[], error: string|null, isCustomAlt: boolean }}
 */
export function resolveAltValidationPairs(strategyLike) {
  const ac = getAssetClassFromStrategy(strategyLike ?? {})
  if (ac !== 'ALT') {
    return { pairs: getValidationPairsForAssetClass(ac), error: null, isCustomAlt: false }
  }

  const id = String(strategyLike?.id ?? '')
  const isUser =
    !!strategyLike?.isUserStrategy
    || looksLikeUserStrategyId(id)

  const normalized = normalizeAltValidationSymbols(
    strategyLike?.altValidationSymbols ?? strategyLike?.alt_validation_symbols,
  )

  if (isUser) {
    if (normalized.length < ALT_VALIDATION_MIN || normalized.length > ALT_VALIDATION_MAX) {
      return {
        pairs: [],
        error: `ALT 전략은 검증용 코인을 ${ALT_VALIDATION_MIN}~${ALT_VALIDATION_MAX}개(Binance USDT) 선택해야 합니다. (현재 ${normalized.length}개)`,
        isCustomAlt: true,
      }
    }
    return { pairs: normalized, error: null, isCustomAlt: true }
  }

  if (normalized.length >= ALT_VALIDATION_MIN && normalized.length <= ALT_VALIDATION_MAX) {
    return { pairs: normalized, error: null, isCustomAlt: true }
  }

  return {
    pairs: [...ALT_BASKET_USDT_PAIRS],
    error: null,
    isCustomAlt: false,
  }
}

/**
 * @param {string} assetClass
 * @param {object} [strategyLike] — ALT 사용자 목록 반영 시 전달
 */
export function getDefaultChartSymbolForAssetClass(assetClass, strategyLike = null) {
  if (strategyLike && typeof strategyLike === 'object') {
    const ac = getAssetClassFromStrategy(strategyLike)
    if (ac === 'ALT') {
      const { pairs } = resolveAltValidationPairs(strategyLike)
      if (pairs[0]) return pairs[0]
    }
  }
  const { pairs } = resolveAltValidationPairs({ asset: assetClass })
  return pairs[0] ?? 'BTCUSDT'
}

export function getValidationBaselineLabel(strategyLike) {
  const ac = getAssetClassFromStrategy(strategyLike ?? {})
  if (ac !== 'ALT') return VALIDATION_USDT_PAIR[ac] ?? 'BTCUSDT'
  const { pairs, error } = resolveAltValidationPairs(strategyLike ?? {})
  if (error || !pairs.length) return `ALT 검증 (${ALT_VALIDATION_MIN}~${ALT_VALIDATION_MAX}종 필요)`
  return `${pairs.length}종 바스켓 (${pairs.join(', ')})`
}

export function isAltBasketAssetClass(assetClass) {
  return normalizeAssetClassKey(assetClass) === 'ALT'
}

export function formatDispersionLabel(level) {
  if (level === 'low') return '낮음'
  if (level === 'high') return '높음'
  return '보통'
}

/**
 * 전략 "지금" 행동 상태 — 시그널·포지션·검증 메타 기반 (성과와 독립)
 */

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/** @returns {'LONG'|'SHORT'|'EXIT'|null} */
export function normalizeSignalDir(d) {
  const s = String(d ?? '').toUpperCase().trim()
  if (s === 'BUY' || s === 'LONG') return 'LONG'
  if (s === 'SELL' || s === 'SHORT') return 'SHORT'
  if (s === 'EXIT' || s === 'FLAT' || s === 'CLOSE') return 'EXIT'
  return null
}

function parseSignalTimeMs(timeStr, ts) {
  if (Number.isFinite(Number(ts)) && Number(ts) > 0) return Number(ts)
  const s = String(timeStr ?? '').trim()
  if (!s || s === '—') return NaN
  const m = s.match(/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (m) {
    const y = new Date().getFullYear()
    const mo = Number(m[1]) - 1
    const day = Number(m[2])
    const hh = m[3] != null ? Number(m[3]) : 12
    const mm = m[4] != null ? Number(m[4]) : 0
    const ms = new Date(y, mo, day, hh, mm, 0, 0).getTime()
    return Number.isFinite(ms) ? ms : NaN
  }
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : NaN
}

function isLikelyOpen(sig) {
  if (sig?.closed === false) return true
  const r = String(sig?.result ?? '')
  if (/진행|대기|진행중|보유|미청산|open/i.test(r)) return true
  if (/완료|청산|종료|closed/i.test(r) && !/진행|대기/.test(r)) return false
  return sig?.closed !== true
}

function fmtLine(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  try {
    const d = new Date(ms)
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${mo}/${day} ${hh}:${mm}`
  } catch {
    return '—'
  }
}

/**
 * @param {object} strategy
 * @param {object} [opts]
 * @param {{ side?: 'LONG'|'SHORT' }} [opts.openPosition]
 */
export function getStrategyLiveState(strategy = {}, opts = {}) {
  const openPosition = opts.openPosition ?? strategy.openPosition ?? strategy.open_position
  const recentSignals = Array.isArray(strategy.recentSignals) ? strategy.recentSignals : []
  const ver = String(strategy.verified_badge_level ?? strategy.verLevel ?? 'backtest_only')
  const fit = String(strategy.fitSummary ?? strategy.market_condition ?? '').trim()
  const recBadge = String(strategy.recommendBadge ?? '').toUpperCase()
  const recent7d = safeNum(strategy.recentRoi7d ?? strategy.roi7d, NaN)
  const trades = safeNum(strategy.tradeCount ?? strategy.trades, 0)

  const parsed = recentSignals.map((raw, i) => {
    const dir = normalizeSignalDir(raw?.dir ?? raw?.type)
    const ms = parseSignalTimeMs(raw?.time, raw?.ts ?? raw?.timeMs)
    return {
      raw,
      dir,
      ms: Number.isFinite(ms) ? ms : i,
      idx: i,
    }
  })

  parsed.sort((a, b) => {
    const t = b.ms - a.ms
    if (t !== 0) return t
    return b.idx - a.idx
  })

  const asc = [...parsed].sort((a, b) => a.ms - b.ms)
  let lastEntryMs = null
  let lastExitMs = null
  for (const p of asc) {
    if (p.dir === 'LONG' || p.dir === 'SHORT') lastEntryMs = Number.isFinite(p.ms) ? p.ms : lastEntryMs
    if (p.dir === 'EXIT') lastExitMs = Number.isFinite(p.ms) ? p.ms : lastExitMs
  }

  const openSide = (() => {
    const s = String(openPosition?.side ?? '').toUpperCase()
    if (s === 'LONG' || s === 'SHORT') return s
    return null
  })()

  let kind = 'no_signal'
  let label = '신호 없음'
  let shortLabel = '신호 없음'
  let detail = '최근 시그널 기록이 없거나 아직 집계되지 않았습니다.'
  let tone = 'muted'
  let pill = 'WAIT'
  let isActive = false

  if (openSide) {
    kind = openSide === 'LONG' ? 'long_open' : 'short_open'
    label = `${openSide} 진입 중`
    shortLabel = label
    detail = openSide === 'LONG'
      ? '현재 롱 포지션 유지 중으로 표시됩니다.'
      : '현재 숏 포지션 유지 중으로 표시됩니다.'
    tone = openSide === 'LONG' ? 'long' : 'short'
    pill = 'LIVE'
    isActive = true
  } else if (parsed.length > 0) {
    const latest = parsed[0]
    const ld = latest.dir
    const raw = latest.raw ?? {}

    if (ld === 'EXIT') {
      kind = 'recent_exit'
      label = '최근 종료'
      shortLabel = '최근 종료'
      detail = '최근 포지션이 종료된 상태입니다.'
      tone = 'neutral'
      pill = 'EXIT'
    } else if (ld === 'LONG' || ld === 'SHORT') {
      if (isLikelyOpen(raw)) {
        kind = ld === 'LONG' ? 'long_open' : 'short_open'
        label = `${ld} 진입 중`
        shortLabel = label
        detail = ld === 'LONG'
          ? '현재 롱 포지션 유지 중으로 보입니다.'
          : '현재 숏 포지션 유지 중으로 보입니다.'
        tone = ld === 'LONG' ? 'long' : 'short'
        pill = 'LIVE'
        isActive = true
      } else {
        kind = 'wait'
        label = '진입 대기'
        shortLabel = '진입 대기'
        detail = '최근 청산 이후 새로운 진입을 기다리는 상태입니다.'
        tone = 'wait'
        pill = 'WAIT'
      }
    } else {
      kind = 'no_signal'
      label = '신호 없음'
      shortLabel = '신호 없음'
      detail = '방향성 시그널이 명확하지 않습니다.'
      tone = 'muted'
      pill = 'SIG'
    }
  } else {
    const cd = normalizeSignalDir(strategy.currentDir)
    if (cd === 'LONG' || cd === 'SHORT') {
      kind = cd === 'LONG' ? 'long_open' : 'short_open'
      label = `${cd} 진입 중`
      shortLabel = label
      detail = '시그널 목록 없이 방향만 표시된 경우입니다. 시그널 탭에서 확인하세요.'
      tone = cd === 'LONG' ? 'long' : 'short'
      pill = 'LIVE'
      isActive = true
    }
  }

  const flags = []
  if (ver === 'live_verified') flags.push('검증 중')
  if (recBadge === 'RISKY' && /비적합|보류|주의|미충족/i.test(fit)) {
    flags.push('일시 비추천')
  }
  if (/관망|보류|대기 권장/i.test(fit) && kind === 'wait') {
    flags.push('관망 구간')
  }

  let suitabilityLabel = '참고 필요'
  let suitabilityDetail = '시그널·적합도 문구를 함께 확인하세요.'
  let suitabilityTone = 'slate'

  if (ver === 'backtest_only' && trades > 0 && trades < 18) {
    suitabilityLabel = '검증 더 필요'
    suitabilityDetail = '백테스트 표본이 더 쌓이면 신뢰도 판단이 쉬워집니다.'
    suitabilityTone = 'amber'
  } else if (ver === 'trade_verified' && isActive && !/비적합|보류|횡보/i.test(fit)) {
    suitabilityLabel = '사용 가능'
    suitabilityDetail = '현재 시장 적합도와 시그널을 함께 보고 판단하세요.'
    suitabilityTone = 'emerald'
  } else if (/횡보/i.test(fit) && /비적합|보류|비추천/i.test(fit)) {
    suitabilityLabel = '관망 권장'
    suitabilityDetail = '횡보·비적합 구간으로 관망이 더 적합할 수 있습니다.'
    suitabilityTone = 'amber'
  } else if (Number.isFinite(recent7d) && Math.abs(recent7d) >= 10) {
    suitabilityLabel = '변동성 주의'
    suitabilityDetail = '최근 구간 변동이 커 짧은 손절·포지션 크기 점검이 필요할 수 있습니다.'
    suitabilityTone = 'amber'
  } else if (Number.isFinite(recent7d) && recent7d < -6) {
    suitabilityLabel = '약화 주의'
    suitabilityDetail = '최근 성과 흐름이 약해질 수 있어 보수적으로 보는 편이 낫습니다.'
    suitabilityTone = 'amber'
  }

  let historyHint = null
  if (parsed.length >= 2) {
    const tail = parsed.slice(0, 3).reverse()
    const parts = tail.map((p) => {
      if (p.dir === 'EXIT') return 'EXIT'
      if (p.dir === 'LONG' || p.dir === 'SHORT') {
        return isLikelyOpen(p.raw ?? {}) ? p.dir : '청산'
      }
      return '—'
    })
    historyHint = parts.join(' → ')
  }

  return {
    kind,
    label,
    shortLabel,
    detail,
    tone,
    pill,
    isActive,
    lastEntryText: fmtLine(lastEntryMs),
    lastExitText: fmtLine(lastExitMs),
    flags,
    suitabilityLabel,
    suitabilityDetail,
    suitabilityTone,
    historyHint,
  }
}

/** 카드 한 줄용 — 홈·마켓 */
export function getStrategyLiveStateLine(strategy, opts) {
  const s = getStrategyLiveState(strategy, opts)
  return s.shortLabel ?? s.label
}

export function strategyLiveToneClasses(tone) {
  switch (tone) {
    case 'long':
      return {
        border: 'border-emerald-200 dark:border-emerald-900/40',
        pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300',
        title: 'text-emerald-700 dark:text-emerald-300',
      }
    case 'short':
      return {
        border: 'border-red-200 dark:border-red-900/40',
        pill: 'bg-red-50 text-red-700 dark:bg-red-950/35 dark:text-red-300',
        title: 'text-red-700 dark:text-red-300',
      }
    case 'wait':
    case 'neutral':
      return {
        border: 'border-slate-200 dark:border-gray-700',
        pill: 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-slate-300',
        title: 'text-slate-800 dark:text-slate-100',
      }
    case 'warning':
    case 'amber':
      return {
        border: 'border-amber-200 dark:border-amber-900/40',
        pill: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
        title: 'text-amber-900 dark:text-amber-200',
      }
    case 'muted':
      return {
        border: 'border-slate-200 dark:border-gray-700',
        pill: 'bg-slate-50 text-slate-500 dark:bg-gray-800 dark:text-slate-400',
        title: 'text-slate-600 dark:text-slate-300',
      }
    default:
      return {
        border: 'border-slate-200 dark:border-gray-700',
        pill: 'bg-slate-50 text-slate-500 dark:bg-gray-800 dark:text-slate-400',
        title: 'text-slate-700 dark:text-slate-200',
      }
  }
}

export function suitabilityToneClasses(tone) {
  if (tone === 'emerald') {
    return 'text-emerald-700 dark:text-emerald-400'
  }
  if (tone === 'amber') {
    return 'text-amber-800 dark:text-amber-300'
  }
  return 'text-slate-600 dark:text-slate-400'
}

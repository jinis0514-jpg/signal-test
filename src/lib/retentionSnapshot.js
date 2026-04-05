/**
 * 재방문·일일 스냅샷 (시드 기반, 같은 날·같은 키면 동일 값)
 */
import { strToSeed, seededRng, seededRandBetween } from './seedRandom'

function isoDay(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

/** 오늘 기준 일일 수익률 % (UI용) */
export function dailyPnlPct(strategyKey, userKey = 'anon') {
  const seed = strToSeed(`${isoDay()}|${userKey}|${strategyKey}|pnl`)
  return +seededRandBetween(seed, -2.2, 3.1).toFixed(2)
}

/** 오늘 포지션 방향 */
export function dailyPositionSide(strategyKey, userKey = 'anon') {
  const seed = strToSeed(`${isoDay()}|${userKey}|${strategyKey}|pos`)
  const r = seededRng(seed)()
  if (r < 0.38) return 'LONG'
  if (r < 0.76) return 'SHORT'
  return null
}

/** 홈용 최근 시그널 3줄 */
export function recentSignalLines(strategyKey, userKey = 'anon', n = 3) {
  const lines = []
  for (let i = 0; i < n; i++) {
    const seed = strToSeed(`${isoDay()}|${userKey}|${strategyKey}|sig|${i}`)
    const rng = seededRng(seed)
    const dir = rng() < 0.5 ? 'LONG' : 'SHORT'
    const sym = ['BTC', 'ETH', 'SOL'][Math.floor(rng() * 3)]
    const typ = rng() < 0.45 ? '진입' : '청산'
    lines.push(`${dir} · ${sym} · ${typ}`)
  }
  return lines
}

/** 마이페이지: 최근 7일 합산 % (일별 시드 합) */
export function rolling7dPnlPct(strategyKey, userKey = 'anon') {
  let sum = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const day = d.toISOString().slice(0, 10)
    const seed = strToSeed(`${day}|${userKey}|${strategyKey}|pnl`)
    sum += seededRandBetween(seed, -1.4, 2.4)
  }
  return +sum.toFixed(2)
}

/** 마이페이지: 현재 드로다운 % (양수) */
export function currentDrawdownPct(strategyKey, userKey = 'anon') {
  const seed = strToSeed(`${isoDay()}|${userKey}|${strategyKey}|dd`)
  return +seededRandBetween(seed, 2.5, 14).toFixed(1)
}

/** 마이페이지: 최근 거래 목록 (목업) */
export function recentTradesPreview(strategyKey, userKey = 'anon', count = 5) {
  const rows = []
  for (let i = 0; i < count; i++) {
    const seed = strToSeed(`${isoDay()}|${userKey}|${strategyKey}|tr|${i}`)
    const rng = seededRng(seed)
    const dir = rng() < 0.52 ? 'LONG' : 'SHORT'
    const pnl = +seededRandBetween(strToSeed(`${seed}p`), -1.8, 2.2).toFixed(2)
    const sym = ['BTC', 'ETH', 'SOL', 'XRP'][Math.floor(rng() * 4)]
    rows.push({ id: i, dir, sym, pnl, label: `${sym} ${dir}` })
  }
  return rows
}

export function buildHomeRetentionStrip({ strategyKey, userKey }) {
  const key = strategyKey || 'default'
  const uk = userKey || 'anon'
  return {
    todayPnl: dailyPnlPct(key, uk),
    position: dailyPositionSide(key, uk),
    signals: recentSignalLines(key, uk, 3),
  }
}

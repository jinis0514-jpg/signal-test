/** 방어적 접근 값 — 검증·시그널 등 외부/스토리지 데이터 경계용 */

export function safeArray(value) {
  return Array.isArray(value) ? value : []
}

export function safeObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

export function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

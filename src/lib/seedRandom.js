/**
 * 시드 기반 랜덤 유틸리티
 *
 * 목적:
 * - Math.random() 대신 결정론적 PRNG 사용
 * - strategyId를 시드로 삼아 새로고침해도 동일한 초기값 생성
 */

/** 문자열 → 32비트 시드 정수 */
export function strToSeed(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
}

/**
 * LCG(선형 합동 생성기) 기반 시드 랜덤 제너레이터
 * @param {number} seed - 양의 정수
 * @returns {() => number} 0 이상 1 미만 값을 반환하는 함수
 */
export function seededRng(seed) {
  let s = seed >>> 0
  return function next() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * 편의 함수: min~max 사이의 시드 기반 랜덤 값
 */
export function seededRandBetween(seed, min, max) {
  const rng = seededRng(seed)
  return min + rng() * (max - min)
}

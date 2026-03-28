/**
 * className 병합 유틸
 * 문자열 / 배열 / 조건 객체 { 'class': bool } 모두 처리
 */
export function cn(...args) {
  return args
    .flatMap((arg) => {
      if (!arg) return []
      if (typeof arg === 'string') return [arg]
      if (Array.isArray(arg)) return arg.filter(Boolean)
      if (typeof arg === 'object') {
        return Object.entries(arg)
          .filter(([, v]) => Boolean(v))
          .map(([k]) => k)
      }
      return []
    })
    .join(' ')
}

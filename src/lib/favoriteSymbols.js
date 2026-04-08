/** 즐겨찾기 코인 (베이스 심볼: BTC, ETH …) — 추후 프로필 DB 연동 시 이 모듈만 갈아끼우면 됨 */

export const FAVORITE_SYMBOLS_LS_KEY = 'bb_favorite_symbols_v1'
const LEGACY_HOME_FAV = 'bb_home_fav'

export function readFavoriteBaseAssets() {
  try {
    let raw = localStorage.getItem(FAVORITE_SYMBOLS_LS_KEY)
    if (raw == null) {
      const leg = localStorage.getItem(LEGACY_HOME_FAV)
      if (leg != null) {
        try {
          const parsed = JSON.parse(leg)
          if (Array.isArray(parsed)) {
            localStorage.setItem(FAVORITE_SYMBOLS_LS_KEY, JSON.stringify(parsed))
          }
        } catch { /* ignore */ }
        raw = localStorage.getItem(FAVORITE_SYMBOLS_LS_KEY)
      }
    }
    const arr = JSON.parse(raw ?? '[]')
    if (!Array.isArray(arr)) return []
    return [...new Set(arr.map((s) => String(s || '').toUpperCase().trim()).filter(Boolean))]
  } catch {
    return []
  }
}

/**
 * @param {string[]} arr 베이스 심볼
 */
export function writeFavoriteBaseAssets(arr) {
  const u = [...new Set((Array.isArray(arr) ? arr : []).map((s) => String(s || '').toUpperCase().trim()).filter(Boolean))]
  localStorage.setItem(FAVORITE_SYMBOLS_LS_KEY, JSON.stringify(u))
}

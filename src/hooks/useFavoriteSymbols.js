import { useState, useEffect, useCallback, useMemo } from 'react'
import { readFavoriteBaseAssets, writeFavoriteBaseAssets } from '../lib/favoriteSymbols'

export function useFavoriteSymbols() {
  const [favorites, setFavorites] = useState(() => readFavoriteBaseAssets())

  useEffect(() => {
    writeFavoriteBaseAssets(favorites)
  }, [favorites])

  const toggleFavorite = useCallback((baseSymbol) => {
    const b = String(baseSymbol ?? '').toUpperCase().trim()
    if (!b) return
    setFavorites((prev) => {
      const p = Array.isArray(prev) ? prev : []
      return p.includes(b) ? p.filter((x) => x !== b) : [...p, b]
    })
  }, [])

  const isFavorite = useCallback(
    (baseSymbol) => {
      const b = String(baseSymbol ?? '').toUpperCase()
      return favorites.includes(b)
    },
    [favorites],
  )

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  return { favorites, favoriteSet, toggleFavorite, isFavorite, setFavorites }
}

import { useMemo, useState, useEffect, useCallback } from 'react'
import { readFavoriteStrategies, writeFavoriteStrategies } from '../lib/favoriteStrategies'

export function useFavoriteStrategies() {
  const [favorites, setFavorites] = useState(() => readFavoriteStrategies())

  useEffect(() => {
    writeFavoriteStrategies(favorites)
  }, [favorites])

  const favoriteSet = useMemo(
    () => new Set((favorites ?? []).map((x) => x.id)),
    [favorites],
  )

  const toggleFavoriteStrategy = useCallback((strategy) => {
    const id = String(strategy?.id ?? '').trim()
    if (!id) return
    const name = String(strategy?.name ?? '').trim() || id
    setFavorites((prev) => {
      const list = Array.isArray(prev) ? prev : []
      if (list.some((x) => x.id === id)) {
        return list.filter((x) => x.id !== id)
      }
      return [{ id, name, updatedAt: Date.now() }, ...list].slice(0, 30)
    })
  }, [])

  return { favorites, favoriteSet, toggleFavoriteStrategy }
}


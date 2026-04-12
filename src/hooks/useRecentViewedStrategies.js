import { useState, useEffect } from 'react'
import { readRecentViewedStrategies, writeRecentViewedStrategies } from '../lib/recentViewedStrategies'

export function useRecentViewedStrategies() {
  const [recentViewed, setRecentViewed] = useState(() => readRecentViewedStrategies())

  useEffect(() => {
    writeRecentViewedStrategies(recentViewed)
  }, [recentViewed])

  return { recentViewed, setRecentViewed }
}


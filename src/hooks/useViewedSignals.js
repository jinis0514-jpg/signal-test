import { useState, useEffect, useCallback } from 'react'
import { readViewedSignals, appendViewedSignal } from '../lib/viewedSignals'

export function useViewedSignals() {
  const [viewedSignals, setViewedSignals] = useState(() => readViewedSignals())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const sync = () => setViewedSignals(readViewedSignals())
    window.addEventListener('bb-viewed-signals-changed', sync)
    return () => window.removeEventListener('bb-viewed-signals-changed', sync)
  }, [])

  const recordViewedSignal = useCallback((payload) => {
    appendViewedSignal(payload)
    setViewedSignals(readViewedSignals())
  }, [])

  return { viewedSignals, recordViewedSignal }
}

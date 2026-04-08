import { useEffect, useState, useCallback, useRef } from 'react'
import {
  fetchBinanceCandles,
  normalizeBinanceSymbol,
} from '../lib/marketCandles'
import { getFallbackCandles } from '../lib/marketFallbackCandles'

/**
 * Binance klines — 폴링 + 실패 시 합성 캔들
 * @param {string} symbol BTCUSDT 또는 BTC
 * @param {string} interval 1m, 5m, 15m, 1h …
 * @param {{ limit?: number, pollMs?: number }} [options]
 */
export function useMarketData(symbol = 'BTCUSDT', interval = '5m', options = {}) {
  const { limit = 500, pollMs = 1500 } = options
  const sym = normalizeBinanceSymbol(symbol)

  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('live')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(0)
  const firstCompleteRef = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchBinanceCandles(sym, interval, limit)
      setCandles((prev) => {
        const next = Array.isArray(data) ? data : []
        if (next.length === 0) return prev
        return next
      })
      setSource('live')
      setLastUpdatedAt(Date.now())
    } catch (e) {
      setCandles((prev) => {
        const fb = getFallbackCandles(sym, interval, limit)
        return fb.length ? fb : prev
      })
      setSource('fallback')
      setError(e?.message ?? '가격 데이터를 불러오지 못했습니다.')
      setLastUpdatedAt(Date.now())
    } finally {
      if (!firstCompleteRef.current) {
        setLoading(false)
        firstCompleteRef.current = true
      }
    }
  }, [sym, interval, limit])

  useEffect(() => {
    firstCompleteRef.current = false
    setLoading(true)
    setError(null)
    fetchData()
    if (pollMs <= 0) return undefined
    const id = setInterval(fetchData, pollMs)
    return () => clearInterval(id)
  }, [fetchData, pollMs])

  return { candles, loading, error, source, lastUpdatedAt, refetch: fetchData }
}

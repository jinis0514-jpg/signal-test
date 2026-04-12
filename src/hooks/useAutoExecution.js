import { useState, useEffect, useCallback } from 'react'
import {
  loadAutoExecutionState,
  saveAutoExecutionState,
  appendHistoryEntry,
} from '../lib/autoExecutionStore'

export function useAutoExecution() {
  const [state, setState] = useState(() => loadAutoExecutionState())

  useEffect(() => {
    saveAutoExecutionState(state)
  }, [state])

  const patch = useCallback((partial) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const startSession = useCallback(({ strategyId, strategyName, investKrw, riskPct, stopLossPct }) => {
    setState((prev) => {
      let next = {
        ...prev,
        status: 'running',
        strategyId: String(strategyId ?? ''),
        strategyName: String(strategyName ?? ''),
        investKrw: Number(investKrw) || prev.investKrw,
        riskPct: Number(riskPct) || prev.riskPct,
        stopLossPct: Number(stopLossPct) || prev.stopLossPct,
      }
      next = appendHistoryEntry(next, {
        kind: 'system',
        title: '자동 실행 세션 시작',
        detail: `${next.strategyName || next.strategyId} · 투자 ${Number(next.investKrw).toLocaleString()}원 · 리스크 ${next.riskPct}% · 손절 ${next.stopLossPct}%`,
      })
      next = appendHistoryEntry(next, {
        kind: 'system',
        title: '주문 라우팅',
        detail: '시그널 발생 시 거래소 API로 자동 주문(시뮬/연동 파이프라인)',
      })
      return next
    })
  }, [])

  const stopSession = useCallback(() => {
    setState((prev) => {
      const mockSessionPnl = +(Math.random() * 1.4 - 0.35).toFixed(2)
      let next = { ...prev, status: 'stopped' }
      next = appendHistoryEntry(next, {
        kind: 'result',
        title: '자동 실행 중지',
        detail: '세션 종료 · 다음 시작 전까지 대기',
        pnlPct: mockSessionPnl,
      })
      return next
    })
  }, [])

  const resetToIdle = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'idle' }))
  }, [])

  return {
    state,
    setState,
    patch,
    startSession,
    stopSession,
    resetToIdle,
  }
}

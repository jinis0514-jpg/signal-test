import { useEffect, useRef } from 'react'
import {
  requestSignalNotificationPermissionOnce,
  notifySignalBrowser,
  isBrowserNotificationSupported,
} from '../lib/browserSignalNotify'
import { shouldNotifySignal } from '../lib/signalNotifyEligibility'
import {
  makeSignalNotifyKey,
  tryConsumeSignalNotifyOnce,
} from '../lib/signalNotificationDedupe'

/** 시그널 페이지 진입 시 브라우저 알림 권한 — default일 때 최초 1회만 요청 */
export function useBrowserSignalNotificationPermission() {
  useEffect(() => {
    if (!isBrowserNotificationSupported()) return
    requestSignalNotificationPermissionOnce()
  }, [])
}

function signalDedupeKey(s) {
  return `${s.type}|${s.time}|${s.direction ?? ''}|${s.price ?? ''}`
}

function signalTimeToIso(s) {
  const t = Number(s?.time)
  if (!Number.isFinite(t)) return new Date().toISOString()
  const ms = t > 1e12 ? t : t * 1000
  return new Date(ms).toISOString()
}

/**
 * 관찰 중인 전략별 엔진 시그널이 새로 생길 때만 처리 (초기 스냅샷은 제외)
 * - OS 알림: 권한 granted 일 때만
 * - 인앱: onNewSignals 로 배치 전달 (로그인·구독·설정은 shouldNotifySignal 로 필터)
 *
 * @param {{
 *   groups: Array<{ id: string, name: string, signals: object[] }>,
 *   enabled?: boolean,
 *   currentUser?: { id?: string } | null,
 *   user?: object,
 *   userStrategyIds?: Set<string>|string[],
 *   strategyNotifySettings?: Record<string, { all?: boolean, long?: boolean, short?: boolean, exit?: boolean }>,
 *   onNewSignals?: (events: Array<{ strategyName: string, strategyId: string, kind: 'long'|'short'|'exit', createdAt: string }>) => void
 * }} opts
 */
export function useBrowserSignalNotifications({
  groups = [],
  enabled = true,
  currentUser = null,
  user = null,
  userStrategyIds,
  strategyNotifySettings = {},
  onNewSignals,
}) {
  const prevKeysRef = useRef(new Map())
  const onNewSignalsRef = useRef(onNewSignals)
  const settingsRef = useRef(strategyNotifySettings)
  const gateRef = useRef({ currentUser, user, userStrategyIds })
  onNewSignalsRef.current = onNewSignals
  settingsRef.current = strategyNotifySettings
  gateRef.current = { currentUser, user, userStrategyIds }

  useEffect(() => {
    if (!Array.isArray(groups)) return
    const keep = new Set(groups.map((g) => String(g.id ?? '')))
    for (const id of prevKeysRef.current.keys()) {
      if (!keep.has(id)) prevKeysRef.current.delete(id)
    }
  }, [groups])

  useEffect(() => {
    if (!enabled || !Array.isArray(groups) || groups.length === 0) return

    const batch = []

    for (const g of groups) {
      const sid = String(g.id ?? '')
      const name = String(g.name ?? '전략')
      const signals = Array.isArray(g.signals) ? g.signals : []
      const next = new Set(signals.map(signalDedupeKey))

      let prev = prevKeysRef.current.get(sid)
      if (!prev) {
        prevKeysRef.current.set(sid, next)
        continue
      }

      for (const s of signals) {
        const k = signalDedupeKey(s)
        if (prev.has(k)) continue

        const t = String(s.type ?? '')
        let kind = 'long'
        if (t === 'EXIT') kind = 'exit'
        else if (String(s.direction ?? '').toUpperCase() === 'SHORT') kind = 'short'
        else kind = 'long'

        const createdAt = signalTimeToIso(s)
        const { currentUser: cu, user: uu, userStrategyIds: usIds } = gateRef.current
        if (
          !shouldNotifySignal({
            currentUser: cu,
            user: uu,
            strategyId: sid,
            kind,
            userStrategyIds: usIds,
          })
        ) {
          continue
        }
        if (!tryConsumeSignalNotifyOnce(sid, s)) {
          continue
        }

        batch.push({
          strategyName: name,
          strategyId: sid,
          kind,
          createdAt,
        })

        if (isBrowserNotificationSupported() && Notification.permission === 'granted') {
          notifySignalBrowser({
            strategyName: name,
            strategyId: sid,
            kind,
            price: s.price,
            dedupeKey: makeSignalNotifyKey(sid, s),
          })
        }
      }

      prevKeysRef.current.set(sid, next)
    }

    if (batch.length > 0 && typeof onNewSignalsRef.current === 'function') {
      onNewSignalsRef.current(batch)
    }
  }, [groups, enabled, strategyNotifySettings, currentUser?.id, user, userStrategyIds])
}

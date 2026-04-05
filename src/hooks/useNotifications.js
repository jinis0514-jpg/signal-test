import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  fetchNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  countUnreadNotifications,
} from '../lib/notificationService'
import { canUseInAppNotifications } from '../lib/userPlan'
import { MOCK_NOTIFICATIONS } from '../data/notificationMock'
import { isMockNotificationId } from '../lib/notificationModel'

function shouldMergeMockFeed(serverRows, allowInApp) {
  if (!allowInApp) return false
  const force = import.meta.env.VITE_NOTIFICATION_MOCK === '1'
  const hide = import.meta.env.VITE_NOTIFICATION_MOCK === '0'
  if (hide) return false
  if (force) return true
  return import.meta.env.DEV && serverRows.length === 0
}

/**
 * Supabase notifications 단일 소스 — 인앱 목록/읽음/실시간
 * 무료 플랜은 조회·구독 생략(목록 비움) — 권한은 userPlan
 * DEV·빈 목록 시 mock 피드 병합 (UI·시그널 연동 전)
 *
 * @param {{ supaReady: boolean, currentUserId: string | undefined, user: object }} opts
 */
export function useNotifications({ supaReady, currentUserId, user }) {
  const [serverNotifications, setServerNotifications] = useState([])
  /** mock id 읽음 — 정적 MOCK 배열과 병합 시 반영 */
  const [mockReadIds, setMockReadIds] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allowInApp = useMemo(() => canUseInAppNotifications(user), [user])

  const notifications = useMemo(() => {
    if (!allowInApp) return []
    if (shouldMergeMockFeed(serverNotifications, allowInApp)) {
      const mockRows = MOCK_NOTIFICATIONS.map((m) => ({
        ...m,
        is_read: Boolean(m.is_read || mockReadIds.has(m.id)),
      }))
      const merged = [...mockRows, ...serverNotifications]
      merged.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      return merged.slice(0, 50)
    }
    return serverNotifications
  }, [serverNotifications, allowInApp, mockReadIds])

  const refreshNotifications = useCallback(async () => {
    if (!supaReady || !currentUserId || !allowInApp) {
      setServerNotifications([])
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const list = await fetchNotifications(currentUserId, 50)
      setServerNotifications(list)
    } catch (e) {
      setError(e?.message ?? '알림을 불러오지 못했습니다.')
      setServerNotifications([])
    } finally {
      setLoading(false)
    }
  }, [supaReady, currentUserId, allowInApp])

  useEffect(() => {
    refreshNotifications()
  }, [refreshNotifications])

  useEffect(() => {
    if (!supaReady || !currentUserId || !allowInApp) {
      return undefined
    }
    const unsub = subscribeToNotifications(currentUserId, (payload) => {
      const ev = payload?.eventType ?? payload?.event
      if (ev === 'INSERT' && payload.new) {
        const row = payload.new
        setServerNotifications((prev) => {
          if (prev.some((n) => n.id === row.id)) return prev
          return [row, ...prev].slice(0, 50)
        })
      } else if (ev === 'UPDATE' && payload.new) {
        const row = payload.new
        setServerNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)))
      }
    })
    return unsub
  }, [supaReady, currentUserId, allowInApp])

  const unreadCount = useMemo(
    () => (allowInApp ? countUnreadNotifications(notifications) : 0),
    [notifications, allowInApp],
  )

  const handleReadNotification = useCallback(
    async (notificationId) => {
      if (!allowInApp) return
      if (isMockNotificationId(notificationId)) {
        setMockReadIds((prev) => new Set(prev).add(notificationId))
        return
      }
      if (!supaReady || !currentUserId) return
      try {
        await markNotificationRead(notificationId, currentUserId)
        setServerNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
        )
      } catch (e) {
        setError(e?.message ?? '읽음 처리에 실패했습니다.')
      }
    },
    [supaReady, currentUserId, allowInApp],
  )

  const handleReadAllNotifications = useCallback(async () => {
    if (!allowInApp) return
    try {
      setMockReadIds(new Set(MOCK_NOTIFICATIONS.map((m) => m.id)))
      if (supaReady && currentUserId) {
        await markAllNotificationsRead(currentUserId)
      }
      setServerNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (e) {
      setError(e?.message ?? '모두 읽음 처리에 실패했습니다.')
    }
  }, [supaReady, currentUserId, allowInApp])

  return {
    notifications,
    notificationsLoading: loading,
    notificationsError: error,
    unreadNotificationCount: unreadCount,
    refreshNotifications,
    handleReadNotification,
    handleReadAllNotifications,
  }
}

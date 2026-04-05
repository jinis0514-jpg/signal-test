import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { NOTIFICATION_TYPES } from '../lib/notificationService'
import { uuidv4 } from '../lib/uuid'

const InAppNotificationContext = createContext(null)

const MAX_ITEMS = 100

/**
 * @param {{ strategyName: string, strategyId: string, kind: 'long'|'short'|'exit', createdAt?: string }} p
 */
function buildRow(p) {
  const uiKind =
    p.kind === 'long' ? 'long_entry' : p.kind === 'short' ? 'short_entry' : 'exit'
  return {
    id: `bb-app-${uuidv4()}`,
    type: p.kind === 'exit' ? NOTIFICATION_TYPES.EXIT : NOTIFICATION_TYPES.ENTRY,
    title: String(p.strategyName ?? '전략').trim() || '전략',
    message: '',
    created_at: p.createdAt || new Date().toISOString(),
    is_read: false,
    meta: {
      uiKind,
      nav: { page: 'signal', strategyId: String(p.strategyId ?? '') },
    },
  }
}

export function InAppNotificationProvider({ children }) {
  const [items, setItems] = useState([])

  const addNotification = useCallback((n) => {
    setItems((prev) => {
      const row = buildRow(n)
      return [row, ...prev].slice(0, MAX_ITEMS)
    })
  }, [])

  const markRead = useCallback((id) => {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, is_read: true } : x)),
    )
  }, [])

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
  }, [])

  const unreadCount = useMemo(
    () => items.filter((x) => !x.is_read).length,
    [items],
  )

  const value = useMemo(
    () => ({
      items,
      addNotification,
      markRead,
      markAllRead,
      unreadCount,
    }),
    [items, addNotification, markRead, markAllRead, unreadCount],
  )

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
    </InAppNotificationContext.Provider>
  )
}

export function useInAppNotifications() {
  const ctx = useContext(InAppNotificationContext)
  if (!ctx) {
    throw new Error('useInAppNotifications must be used within InAppNotificationProvider')
  }
  return ctx
}

/** Provider 밖(테스트 등)에서 안전하게 쓰기 위한 옵셔널 훅 */
export function useInAppNotificationsOptional() {
  return useContext(InAppNotificationContext)
}

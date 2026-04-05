import { useState, useRef, useEffect, useMemo } from 'react'
import { Bell, CheckCheck, Lock } from 'lucide-react'
import { cn } from '../../lib/cn'
import { canUseInAppNotifications, PLAN_MESSAGES } from '../../lib/userPlan'
import { formatNotificationTime } from '../../lib/notificationService'
import {
  inferNotificationUiKind,
  getUiKindLabel,
  getUiKindBadgeClass,
  getNotificationNavTarget,
} from '../../lib/notificationModel'

export default function NotificationDropdown({
  notifications = [],
  unreadCount = 0,
  loading = false,
  fetchError = '',
  supaReady,
  currentUser,
  user,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  onNotificationNavigate,
}) {
  const [open, setOpen] = useState(false)
  const [optimisticRead, setOptimisticRead] = useState(() => new Set())
  const [flashId, setFlashId] = useState(null)
  const rootRef = useRef(null)

  const rows = useMemo(
    () => notifications.map((n) => ({
      ...n,
      is_read: Boolean(n.is_read || optimisticRead.has(n.id)),
    })),
    [notifications, optimisticRead],
  )

  useEffect(() => {
    setOptimisticRead((prev) => {
      const next = new Set()
      for (const id of prev) {
        const row = notifications.find((x) => x.id === id)
        if (row && !row.is_read) next.add(id)
      }
      return next
    })
  }, [notifications])

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (flashId == null) return undefined
    const t = window.setTimeout(() => setFlashId(null), 120)
    return () => clearTimeout(t)
  }, [flashId])

  const disabled = !currentUser
  const planBlocked = !!(currentUser && user && !canUseInAppNotifications(user))
  /** 서버 동기화 알림만 잠금 — 앱 내부 시그널 알림이 있으면 목록 표시 */
  const showLockPanel = planBlocked && rows.length === 0
  const showUnreadBadge = unreadCount > 0 && currentUser

  function handleRowClick(n) {
    if (showLockPanel) return
    const raw = notifications.find((x) => x.id === n.id)
    if (raw && !raw.is_read) {
      setOptimisticRead((prev) => new Set(prev).add(n.id))
      setFlashId(n.id)
      onMarkRead?.(n.id)
    }
  }

  function handleRowActivate(n) {
    if (showLockPanel) return
    const raw = notifications.find((x) => x.id === n.id)
    if (!raw) return
    handleRowClick(n)
    const target = getNotificationNavTarget(raw)
    if (target?.page) {
      onNotificationNavigate?.(target)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'relative w-8 h-8 flex items-center justify-center rounded-lg',
          'transition-[color,background-color,opacity] duration-[120ms]',
          disabled
            ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
            : showLockPanel
              ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800',
        )}
        aria-label="알림"
        aria-expanded={open}
      >
        <Bell size={14} strokeWidth={1.8} />
        {showLockPanel && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500/90">
            <Lock size={7} className="text-white" strokeWidth={2.5} />
          </span>
        )}
        {showUnreadBadge && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && !disabled && (
        <div
          className="
            absolute right-0 top-full mt-1 w-[min(100vw-2rem,380px)]
            max-h-[min(70vh,440px)] overflow-hidden flex flex-col
            rounded-lg border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-900 shadow-lg z-[100]
          "
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">알림</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={showLockPanel || loading || notifications.length === 0}
                onClick={() => onMarkAllRead?.()}
                className={cn(
                  'p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800',
                  'transition-[color,background-color,opacity] duration-[120ms]',
                  (showLockPanel || loading || notifications.length === 0) && 'opacity-40 cursor-not-allowed',
                )}
                title="모두 읽음"
              >
                <CheckCheck size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
            {showLockPanel ? (
              <div className="px-4 py-6 text-center">
                <div className="flex justify-center mb-2 text-amber-500">
                  <Lock size={22} strokeWidth={1.6} />
                </div>
                <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 leading-snug mb-1">
                  {PLAN_MESSAGES.notifications}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                  {PLAN_MESSAGES.notificationsProDetail}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.('mypage')
                    try {
                      sessionStorage.setItem('bb_mypage_section', 'subscription')
                    } catch { /* ignore */ }
                    setOpen(false)
                  }}
                  className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  마이페이지 · 구독 관리 →
                </button>
              </div>
            ) : fetchError ? (
              <div className="px-4 py-6 text-center">
                <p className="text-[11px] text-red-600 dark:text-red-400 leading-relaxed">{fetchError}</p>
                <p className="text-[10px] text-gray-500 mt-2">잠시 후 다시 열어 주세요.</p>
              </div>
            ) : loading ? (
              <p className="px-3 py-8 text-center text-[11px] text-gray-400">불러오는 중…</p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300 mb-1">알림이 없습니다</p>
                <p className="text-[11px] text-gray-400 leading-relaxed max-w-[280px] mx-auto">
                  체험·유료 플랜에서 시그널·전략·구독 알림을 받을 수 있습니다.
                </p>
              </div>
            ) : (
              rows.map((n) => {
                const unread = !n.is_read
                const raw = notifications.find((x) => x.id === n.id)
                const uiKind = raw ? inferNotificationUiKind(raw) : 'other'
                return (
                  <div key={n.id} className="relative flex border-b border-gray-50 dark:border-gray-800/80 last:border-b-0">
                    {unread && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-600 z-[1]"
                        aria-hidden
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRowActivate(n)}
                      className={cn(
                        'w-full text-left pl-3 pr-3 py-2 transition-[background-color,opacity] duration-[100ms]',
                        'border-l-2 border-transparent',
                        unread
                          ? 'bg-blue-50/50 dark:bg-blue-950/20'
                          : 'bg-transparent',
                        'hover:bg-gray-100/80 dark:hover:bg-gray-800/70',
                        flashId === n.id && 'bg-slate-100 dark:bg-gray-800',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 pl-0.5">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span
                              className={cn(
                                'text-[8px] font-bold uppercase tracking-wide px-1 py-0 rounded',
                                getUiKindBadgeClass(uiKind),
                              )}
                            >
                              {getUiKindLabel(uiKind)}
                            </span>
                            {unread && (
                              <span className="text-[8px] font-semibold text-blue-500">NEW</span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 leading-snug truncate">
                            {n.title}
                          </p>
                          {n.message ? (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                          ) : null}
                          <p className="text-[9px] text-gray-400 mt-0.5 tabular-nums">
                            {formatNotificationTime(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

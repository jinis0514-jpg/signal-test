import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'
import { getPlanLabel } from '../../lib/userPlan'
import ThemeToggle from '../ui/ThemeToggle'
import Input from '../ui/Input'

const PLAN_STYLE = {
  free:       'text-slate-500 dark:text-slate-400 font-semibold',
  standard:   'text-blue-600 dark:text-blue-300 font-semibold',
  pro:        'text-blue-700 dark:text-blue-300 font-bold',
  premium:    'text-violet-700 dark:text-violet-300 font-bold',
  subscribed: 'text-blue-700 dark:text-blue-300 font-bold',
}

export default function Topbar({
  currentPage,
  onNavigate,
  onLandingNavigate,
  isDark,
  onToggleDark,
  user,
  isAdmin,
  onToggleAdmin,
  currentUser,
  profile,
  authLoading,
  authError,
  onLogout,
  supaReady,
  notifications = [],
  unreadNotificationCount = 0,
  notificationsLoading = false,
  notificationsError = '',
  onNotificationMarkRead,
  onNotificationMarkAllRead,
  onNotificationNavigate,
}) {
  const navigate = useNavigate()
  const planLabel = user ? getPlanLabel(user) : 'Guest'
  const planCls = PLAN_STYLE[user?.plan ?? 'free'] ?? PLAN_STYLE.free

  return (
    <header className="
      h-12 flex-shrink-0
      flex items-center min-w-0
      px-3 sm:px-5 gap-3
      bg-white dark:bg-gray-900
      border-b border-slate-200/70 dark:border-gray-800
      z-50
    ">
      <div className="flex-1 min-w-0">
        <div className="max-w-[420px] w-full">
          <Input
            icon={<Search size={12} strokeWidth={1.9} />}
            placeholder="검색"
            aria-label="검색"
          />
        </div>
      </div>

      {/* 우측 유틸리티 */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 min-w-0">
        <div className="flex items-center gap-0.5 flex-shrink-0 rounded-lg border border-transparent">
          <NotificationDropdown
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            loading={notificationsLoading}
            fetchError={notificationsError}
            supaReady={supaReady}
            currentUser={currentUser}
            user={user}
            onMarkRead={onNotificationMarkRead}
            onMarkAllRead={onNotificationMarkAllRead}
            onNavigate={onNavigate}
            onNotificationNavigate={onNotificationNavigate}
          />
          <ThemeToggle onToggleDark={onToggleDark} />
        </div>

        {/* 로그인 / 회원가입 UI */}
        {onLogout && (
          <div className="flex items-center gap-1 sm:gap-1.5 mr-1 sm:mr-2">
            {currentUser ? (
              <>
                <span className="hidden sm:inline text-[12px] text-slate-500 dark:text-slate-400 max-w-[140px] md:max-w-[180px] truncate">
                  {profile?.nickname ? profile.nickname : (currentUser.email ?? '로그인됨')}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={!!authLoading}
                  className="
                    h-8 px-2.5 text-[11px] font-semibold rounded-lg
                    border border-slate-200 dark:border-gray-700
                    text-slate-600 hover:text-slate-900 hover:bg-slate-50
                    dark:text-slate-300 dark:hover:text-white dark:hover:bg-gray-800
                    transition-colors
                  "
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/auth?mode=login')}
                  className="
                    h-8 px-2.5 sm:px-3 text-[11px] font-semibold rounded-lg
                    border border-slate-200 dark:border-gray-700 text-slate-600
                    hover:bg-slate-50 dark:hover:bg-gray-800 dark:text-slate-200
                  "
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/auth?mode=signup')}
                  className="
                    h-8 px-2.5 sm:px-3 text-[11px] font-semibold rounded-lg
                    bg-slate-900 text-white hover:bg-slate-800
                    dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white
                  "
                >
                  회원가입
                </button>
              </>
            )}
          </div>
        )}

        {authError && (
          <span className="text-[10px] text-red-500 mr-2 max-w-[240px] truncate" title={authError}>
            {authError}
          </span>
        )}

        {/* 프로필 + 플랜 상태 → 마이페이지 */}
        <button
          type="button"
          onClick={() => onNavigate?.('mypage')}
          className="flex items-center gap-2 px-2 sm:px-2.5 h-8 rounded-lg flex-shrink-0 min-w-0
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-[background-color] duration-[120ms]"
          aria-label="마이페이지로 이동"
          title="마이페이지"
        >
          <div className="
            w-6 h-6 rounded-full
            bg-gray-200 dark:bg-gray-700
            flex items-center justify-center flex-shrink-0
          ">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">G</span>
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className={`text-[12px] whitespace-nowrap leading-none truncate max-w-[120px] sm:max-w-[180px] ${planCls}`}>
              {planLabel}
            </span>
          </div>
        </button>
      </div>
    </header>
  )
}

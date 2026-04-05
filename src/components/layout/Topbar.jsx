import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Home, BarChart3, LineChart, FlaskConical, Code2, UserCircle2, ShieldCheck } from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'
import { cn } from '../../lib/cn'
import { getPlanLabel, getTrialUrgencyClass } from '../../lib/userPlan'

const NAV_ITEMS = [
  { id: 'home',       label: '홈',        icon: Home         },
  { id: 'market',     label: '전략마켓',   icon: BarChart3    },
  { id: 'signal',     label: '시그널',     icon: LineChart    },
  { id: 'validation', label: '검증',      icon: FlaskConical },
  { id: 'editor',     label: '에디터',    icon: Code2        },
  { id: 'mypage',     label: '마이페이지', icon: UserCircle2  },
]

const PLAN_STYLE = {
  free:       'text-slate-500 dark:text-slate-400 font-semibold',
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
  const planCls = user?.plan === 'trial'
    ? `${getTrialUrgencyClass(user.trialDaysLeft)} font-bold`
    : (PLAN_STYLE[user?.plan ?? 'free'] ?? PLAN_STYLE.free)

  return (
    <header className="
      h-12 flex-shrink-0
      flex items-center min-w-0
      px-3 sm:px-5 gap-2 sm:gap-4
      bg-white dark:bg-gray-900
      border-b border-slate-200/70 dark:border-gray-800
      z-50 overflow-x-auto overflow-y-hidden
    ">
      {/* 로고 → 랜딩 */}
      <button
        type="button"
        onClick={() => onLandingNavigate?.()}
        className="flex items-center gap-2.5 flex-shrink-0 rounded-lg hover:opacity-90 transition-opacity text-left"
        title="랜딩 페이지"
      >
        <div className="
          w-7 h-7 rounded-lg
          bg-slate-900 dark:bg-white
          flex items-center justify-center flex-shrink-0
        ">
          <span className="text-white dark:text-slate-900 font-bold text-[12px] font-mono leading-none">Q</span>
        </div>
        <span className="text-[14px] font-bold text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">
          Quant Terminal
        </span>
      </button>

      {/* 구분선 */}
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 flex-shrink-0" />

      {/* 전역 네비게이션 */}
      <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={[
                'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap border',
                isActive
                  ? 'bg-slate-100 text-slate-900 border-slate-200/80 dark:bg-gray-800 dark:text-slate-100 dark:border-gray-700'
                  : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-gray-800/60 dark:hover:text-slate-200',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={13} strokeWidth={isActive ? 2.2 : 1.8} className="flex-shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}

        {/* 관리자 전용 메뉴 */}
        {isAdmin && (
          <>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1" />
            <button
              onClick={() => onNavigate('admin')}
              className={[
                'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap',
                currentPage === 'admin'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-amber-600 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950/30',
              ].join(' ')}
            >
              <ShieldCheck size={13} strokeWidth={currentPage === 'admin' ? 2.2 : 1.8} className="flex-shrink-0" />
              <span>검수 관리</span>
            </button>
          </>
        )}
      </nav>

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

          <button
            type="button"
            onClick={onToggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-lg
              text-gray-400 hover:text-gray-700 hover:bg-gray-100
              dark:text-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800
              transition-[color,background-color] duration-[120ms]"
            aria-label={isDark ? '라이트 모드' : '다크 모드'}
          >
            {isDark
              ? <Sun size={14} strokeWidth={1.8} />
              : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleAdmin}
          className={[
            'h-6 px-2 text-[10px] font-mono rounded-md border transition-[color,background-color,border-color] duration-[120ms] flex-shrink-0',
            isAdmin
              ? 'border-amber-400 text-amber-600 bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-950/30'
              : 'border-slate-200 dark:border-gray-700 text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:hover:border-gray-500',
          ].join(' ')}
          title={isAdmin ? '일반 유저로 전환' : '어드민 모드로 전환'}
        >
          {isAdmin ? 'Admin' : 'User'}
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1 sm:mx-2 flex-shrink-0" />

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

        {currentUser && user?.plan === 'free' && (
          <button
            type="button"
            onClick={() => onNavigate?.('plans')}
            className="
              hidden sm:inline-flex items-center h-7 px-2.5 text-[11px] font-semibold rounded-lg flex-shrink-0
              bg-slate-900 text-white hover:bg-slate-800
              dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white
              transition-colors
            "
          >
            구독·체험
          </button>
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
            {user?.plan === 'trial' && (
              <span className={cn(
                'text-[10px] whitespace-nowrap leading-none mt-[2px] font-semibold tabular-nums',
                user.trialDaysLeft <= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400',
              )}>
                체험 {user.trialDaysLeft}일 남음
                {user.trialDaysLeft <= 3 && ' · 종료 후 잠금'}
              </span>
            )}
          </div>
        </button>
      </div>
    </header>
  )
}

import { useState } from 'react'
import { Search, Bell, Sun, Moon, Home, BarChart3, LineChart, FlaskConical, Code2, UserCircle2, ShieldCheck } from 'lucide-react'
import { getPlanLabel, getTrialUrgencyClass } from '../../lib/userPlan'

const NAV_ITEMS = [
  { id: 'home',       label: '홈',        icon: Home         },
  { id: 'market',     label: '전략마켓',   icon: BarChart3    },
  { id: 'simulation', label: '모의투자',   icon: LineChart    },
  { id: 'validation', label: '검증',      icon: FlaskConical },
  { id: 'editor',     label: '에디터',    icon: Code2        },
  { id: 'mypage',     label: '마이페이지', icon: UserCircle2  },
]

const PLAN_STYLE = {
  free:       'text-gray-400 dark:text-gray-500',
  subscribed: 'text-blue-600 dark:text-blue-400',
}

export default function Topbar({
  currentPage,
  onNavigate,
  isDark,
  onToggleDark,
  user,
  isAdmin,
  onToggleAdmin,
  currentUser,
  profile,
  authLoading,
  authError,
  onLogin,
  onLogout,
  supaReady,
  profileLoading,
}) {
  const planLabel = user ? getPlanLabel(user) : 'Guest'
  const planCls = user?.plan === 'trial'
    ? getTrialUrgencyClass(user.trialDaysLeft)
    : (PLAN_STYLE[user?.plan ?? 'free'] ?? PLAN_STYLE.free)

  const [email, setEmail] = useState('')

  return (
    <header className="
      h-11 flex-shrink-0
      flex items-center
      px-5 gap-4
      bg-white dark:bg-gray-900
      border-b border-gray-200 dark:border-gray-800
      z-50
    ">
      {/* 로고 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="
          w-6 h-6 rounded-[2px]
          bg-gray-900 dark:bg-white
          flex items-center justify-center flex-shrink-0
        ">
          <span className="text-white dark:text-gray-900 font-bold text-[11px] font-mono leading-none">Q</span>
        </div>
        <span className="text-[14px] font-bold text-gray-900 dark:text-gray-100 tracking-tight whitespace-nowrap">
          Quant Terminal
        </span>
      </div>

      {/* 구분선 */}
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 flex-shrink-0" />

      {/* 전역 네비게이션 */}
      <nav className="flex items-center gap-0.5 flex-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={[
                'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-[2px] transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800/60 dark:hover:text-gray-300',
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
                'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-[2px] transition-colors whitespace-nowrap',
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
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-[2px]
            text-gray-400 hover:text-gray-700 hover:bg-gray-100
            dark:text-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800
            transition-colors"
          aria-label="검색"
        >
          <Search size={14} strokeWidth={1.8} />
        </button>

        <button
          className="relative w-8 h-8 flex items-center justify-center rounded-[2px]
            text-gray-400 hover:text-gray-700 hover:bg-gray-100
            dark:text-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800
            transition-colors"
          aria-label="알림"
        >
          <Bell size={14} strokeWidth={1.8} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
        </button>

        <button
          onClick={onToggleDark}
          className="w-8 h-8 flex items-center justify-center rounded-[2px]
            text-gray-400 hover:text-gray-700 hover:bg-gray-100
            dark:text-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800
            transition-colors"
          aria-label={isDark ? '라이트 모드' : '다크 모드'}
        >
          {isDark
            ? <Sun size={14} strokeWidth={1.8} />
            : <Moon size={14} strokeWidth={1.8} />}
        </button>

        {/* Admin 모드 토글 (테스트용) */}
        <button
          onClick={onToggleAdmin}
          className={[
            'h-6 px-2 text-[10px] font-mono rounded-[1px] border transition-colors',
            isAdmin
              ? 'border-amber-400 text-amber-600 bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-950/30'
              : 'border-slate-200 dark:border-gray-700 text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:hover:border-gray-500',
          ].join(' ')}
          title={isAdmin ? '일반 유저로 전환' : '어드민 모드로 전환'}
        >
          {isAdmin ? 'Admin' : 'User'}
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-2" />

        {/* 로그인 UI (조용하게) */}
        {onLogin && onLogout && (
          <div className="flex items-center gap-1.5 mr-2">
            {currentUser ? (
              <>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                  {profile?.nickname ? profile.nickname : (currentUser.email ?? '로그인됨')}
                </span>
                <button
                  onClick={onLogout}
                  disabled={!!authLoading}
                  className="
                    h-6 px-2 text-[10px] font-medium rounded-[1px]
                    border border-slate-200 dark:border-gray-700
                    text-slate-500 hover:text-slate-700 hover:bg-slate-50
                    dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-gray-800
                    transition-colors
                  "
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email"
                  className="
                    h-6 w-[140px] px-2 text-[10px]
                    border border-slate-200 dark:border-gray-700 rounded-[1px]
                    bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-300
                    focus:outline-none
                  "
                />
                <button
                  onClick={() => onLogin(email)}
                  disabled={!email.includes('@') || !!authLoading}
                  className="
                    h-6 px-2 text-[10px] font-semibold rounded-[1px]
                    bg-slate-900 text-white hover:bg-slate-700
                    dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300
                    transition-colors
                  "
                  title="매직 링크 로그인"
                >
                  로그인
                </button>
              </>
            )}
          </div>
        )}

        {/* Supabase 상태 미니 배지 */}
        <div className="flex items-center gap-1 mr-2">
          <span className={`h-5 px-1.5 inline-flex items-center text-[9px] rounded-[1px] border ${
            supaReady
              ? 'border-emerald-200 text-emerald-600 bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:bg-emerald-950/20'
              : 'border-slate-200 text-slate-400 bg-slate-50 dark:border-slate-700 dark:text-slate-500 dark:bg-slate-900'
          }`}>
            DB {supaReady ? 'ON' : 'OFF'}
          </span>
          <span className={`h-5 px-1.5 inline-flex items-center text-[9px] rounded-[1px] border ${
            currentUser
              ? 'border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 dark:bg-blue-950/20'
              : 'border-slate-200 text-slate-400 bg-slate-50 dark:border-slate-700 dark:text-slate-500 dark:bg-slate-900'
          }`}>
            {currentUser ? 'AUTH OK' : 'AUTH OFF'}
          </span>
          <span className={`h-5 px-1.5 inline-flex items-center text-[9px] rounded-[1px] border ${
            profile
              ? 'border-emerald-200 text-emerald-600 bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:bg-emerald-950/20'
              : profileLoading
                ? 'border-amber-200 text-amber-600 bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 dark:bg-amber-950/20'
                : 'border-slate-200 text-slate-400 bg-slate-50 dark:border-slate-700 dark:text-slate-500 dark:bg-slate-900'
          }`}>
            {profile ? 'PROFILE OK' : (profileLoading ? 'PROFILE ...' : 'PROFILE OFF')}
          </span>
        </div>

        {authError && (
          <span className="text-[10px] text-red-500 mr-2 max-w-[240px] truncate" title={authError}>
            {authError}
          </span>
        )}

        {/* 프로필 + 플랜 상태 */}
        <button
          className="flex items-center gap-2 px-2.5 h-8 rounded-[2px]
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="프로필"
        >
          <div className="
            w-6 h-6 rounded-full
            bg-gray-200 dark:bg-gray-700
            flex items-center justify-center flex-shrink-0
          ">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">G</span>
          </div>
          <div className="flex flex-col items-start">
            <span className={`text-[12px] font-semibold whitespace-nowrap leading-none ${planCls}`}>
              {planLabel}
            </span>
            {user?.plan === 'trial' && user.trialDaysLeft <= 3 && (
              <span className="text-[10px] text-slate-400 whitespace-nowrap leading-none mt-[2px]">
                종료 후 잠금
              </span>
            )}
          </div>
        </button>
      </div>
    </header>
  )
}

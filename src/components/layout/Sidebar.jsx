import { useMemo } from 'react'
import {
  Activity,
  Bell,
  Code,
  LayoutGrid,
  Settings,
  Store,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import Logo from '../Logo'
import { Avatar, AvatarFallback } from '../ui/shadcn/avatar'

function clampBadgeCount(value) {
  const n = Number(value) || 0
  if (n <= 0) return '0'
  return n > 99 ? '99+' : String(n)
}

function getProfileLabel({ profile, currentUser }) {
  const nickname = String(profile?.nickname ?? '').trim()
  if (nickname) return nickname
  const email = String(currentUser?.email ?? '').trim()
  if (!email) return 'Guest'
  const local = email.split('@')[0] || email
  return local.slice(0, 20)
}

function getInitials(label) {
  const s = String(label ?? '').trim()
  if (!s) return 'G'
  const parts = s.split(/[\s._-]+/).filter(Boolean)
  const first = parts[0]?.[0]
  const second = parts[1]?.[0]
  const raw = (first ? first : '') + (second ? second : '')
  return raw ? raw.toUpperCase().slice(0, 2) : s[0].toUpperCase()
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}) {
  const content = (
    <div
      role={disabled ? 'button' : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'relative h-10 w-full px-3 rounded-lg flex items-center gap-3 select-none',
        'transition-[background-color,color] duration-150',
        disabled
          ? 'text-text-tertiary opacity-50 cursor-not-allowed'
          : active
            ? 'bg-brand-soft/15 text-brand'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 cursor-pointer',
      )}
      title={disabled ? '곧 출시' : undefined}
    >
      {active ? (
        <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r bg-brand" aria-hidden />
      ) : null}
      <Icon size={18} strokeWidth={active ? 2.2 : 1.9} className="shrink-0" aria-hidden />
      <span className="text-[13px] font-medium leading-none">{label}</span>
    </div>
  )

  if (!disabled) return content

  return (
    <div className="relative group">
      {content}
      <div
        className={cn(
          'pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2',
          'px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap',
          'bg-bg-surface-3 text-text-primary border border-border-default',
          'opacity-0 group-hover:opacity-100 transition-opacity',
        )}
        aria-hidden
      >
        곧 출시
      </div>
    </div>
  )
}

export default function Sidebar({
  currentPage,
  onNavigate,
  unreadNotificationCount = 0,
  profile,
  currentUser,
}) {
  const mainItems = useMemo(
    () => [
      { id: 'home', label: '피드', icon: LayoutGrid, disabled: false },
      { id: 'trader', label: '트레이더', icon: Users, disabled: true },
      { id: 'market', label: '전략 마켓', icon: Store, disabled: false },
      { id: 'signal', label: '라이브 시그널', icon: Activity, disabled: false },
      { id: 'portfolio', label: '포트폴리오', icon: Wallet, disabled: true },
      { id: 'editor', label: '스튜디오', icon: Code, disabled: false },
      { id: 'mypage', label: '내 공간', icon: User, disabled: false },
    ],
    [],
  )

  const handleNavigate = (id) => {
    if (!id) return
    if (id === 'trader' || id === 'portfolio') return
    onNavigate?.(id)
  }

  const profileLabel = getProfileLabel({ profile, currentUser })
  const initials = getInitials(profileLabel)
  const badgeText = clampBadgeCount(unreadNotificationCount)

  const handleNotifications = () => {
    try {
      sessionStorage.setItem('bb_mypage_section', 'notifications')
    } catch {}
    onNavigate?.('mypage')
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen w-[240px] z-40',
        'bg-bg-surface-1 border-r border-border-default',
        'flex flex-col',
      )}
    >
      <div className="h-12 px-3 flex items-center">
        <button
          type="button"
          onClick={() => onNavigate?.('home')}
          className="w-full rounded-lg hover:opacity-90 transition-opacity text-left"
          aria-label="SignalLab 홈"
        >
          <Logo
            size={26}
            className="gap-2.5"
            textClassName="text-[14px] font-semibold tracking-wide text-text-primary"
            brand="lab"
          />
        </button>
      </div>

      <div className="px-2.5 pt-2 flex-1 flex flex-col min-h-0">
        <nav className="flex flex-col gap-1">
          {mainItems.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              disabled={item.disabled}
              active={!item.disabled && currentPage === item.id}
              onClick={() => handleNavigate(item.id)}
            />
          ))}
        </nav>

        <div className="mt-auto pt-3">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleNotifications}
              className={cn(
                'h-10 w-full px-3 rounded-lg flex items-center gap-3',
                'text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-[background-color,color] duration-150',
              )}
            >
              <div className="relative shrink-0">
                <Bell size={18} strokeWidth={1.9} aria-hidden />
                <span
                  className={cn(
                    'absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1',
                    'rounded-full bg-brand text-white text-[10px] font-bold',
                    'flex items-center justify-center tabular-nums',
                  )}
                  aria-label={`미읽음 알림 ${badgeText}개`}
                >
                  {badgeText}
                </span>
              </div>
              <span className="text-[13px] font-medium leading-none">알림</span>
            </button>

            <NavItem
              icon={Settings}
              label="설정"
              disabled
              active={false}
              onClick={undefined}
            />
          </div>

          <div className="my-3 border-t border-border-default" />

          <button
            type="button"
            onClick={() => onNavigate?.('mypage')}
            className={cn(
              'w-full px-3 h-11 rounded-lg flex items-center gap-3 text-left',
              'hover:bg-bg-surface-2 transition-[background-color] duration-150',
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-bg-surface-2 text-text-primary text-[11px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-text-primary truncate">
                {profileLabel}
              </p>
              <p className="text-[11px] text-text-tertiary truncate">내 공간</p>
            </div>
          </button>
        </div>
      </div>
    </aside>
  )
}


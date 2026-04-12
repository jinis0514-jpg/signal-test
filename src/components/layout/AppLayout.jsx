import Topbar from './Topbar'

export default function AppLayout({
  currentPage,
  onNavigate,
  onLandingNavigate,
  isDark,
  onToggleDark,
  user,
  children,
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
  const serviceLinks = [
    { label: '전략 마켓', href: '/app/market' },
    { label: '시그널', href: '/app/signal' },
    { label: '검증', href: '/app/validation' },
  ]
  const supportLinks = [
    { label: '이용가이드', href: '/guide' },
    { label: '문의하기', href: '/support' },
    { label: '공지사항', href: '/notice' },
  ]
  const policyLinks = [
    { label: '이용약관', href: '/terms' },
    { label: '개인정보처리방침', href: '/privacy' },
    { label: '투자 유의사항', href: '/disclaimer' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-gray-900">
      <Topbar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onLandingNavigate={onLandingNavigate}
        isDark={isDark}
        onToggleDark={onToggleDark}
        user={user}
        isAdmin={isAdmin}
        onToggleAdmin={onToggleAdmin}
        currentUser={currentUser}
        profile={profile}
        authLoading={authLoading}
        authError={authError}
        onLogout={onLogout}
        supaReady={supaReady}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        notificationsLoading={notificationsLoading}
        notificationsError={notificationsError}
        onNotificationMarkRead={onNotificationMarkRead}
        onNotificationMarkAllRead={onNotificationMarkAllRead}
        onNotificationNavigate={onNotificationNavigate}
      />
      <main className="flex-1 bg-slate-50 dark:bg-[#0b0f1a]">
        {children}
      </main>
      <footer className="mt-16 border-t border-slate-200 dark:border-gray-800 bg-[#f8fafc] dark:bg-gray-900 px-4 pt-8 pb-8 text-xs text-slate-600 dark:text-slate-400">
        <div className="mx-auto max-w-5xl grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">서비스</p>
            <ul className="space-y-1.5">
              {serviceLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">지원</p>
            <ul className="space-y-1.5">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">정책</p>
            <ul className="space-y-1.5">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">연락</p>
            <a
              href="mailto:support@bb-platform.com"
              className="text-slate-700 dark:text-slate-300 hover:underline"
            >
              support@bb-platform.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

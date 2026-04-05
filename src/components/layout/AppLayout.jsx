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
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
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
      <main className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-[#0b0f1a]">
        {children}
      </main>
    </div>
  )
}

import Topbar from './Topbar'

export default function AppLayout({
  currentPage,
  onNavigate,
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
  onLogin,
  onLogout,
  supaReady,
  profileLoading,
}) {
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      <Topbar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isDark={isDark}
        onToggleDark={onToggleDark}
        user={user}
        isAdmin={isAdmin}
        onToggleAdmin={onToggleAdmin}
        currentUser={currentUser}
        profile={profile}
        authLoading={authLoading}
        authError={authError}
        onLogin={onLogin}
        onLogout={onLogout}
        supaReady={supaReady}
        profileLoading={profileLoading}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50/80 dark:bg-gray-950">
        {children}
      </main>
    </div>
  )
}

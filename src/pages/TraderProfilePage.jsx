import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import { useTraderProfile } from '../hooks/useTraderProfile'
import { useTheme } from '../hooks/useTheme'

export default function TraderProfilePage() {
  const navigate = useNavigate()
  const { handle } = useParams()
  const { isDark, toggleTheme } = useTheme()
  const { profile, stats, isLoading, error, isOwner } = useTraderProfile(handle)

  const onNavigate = (page) => {
    const p = String(page ?? '').trim()
    if (!p) return
    navigate(`/app/${p}`)
  }

  const content = (() => {
    if (isLoading) return <div className="p-4">Loading...</div>
    if (error) return <div className="p-4">{error}</div>
    if (profile === null) {
      return <div className="p-4">{`사용자를 찾을 수 없습니다 (handle: ${String(handle ?? '')})`}</div>
    }
    if (!profile?.is_trader) {
      return (
        <div className="p-4 space-y-2">
          <div>이 사용자는 아직 트레이더 모드를 활성화하지 않았어요</div>
          {isOwner ? <div>내 공간에서 트레이더 모드 활성화 가능</div> : null}
        </div>
      )
    }
    return (
      <div className="p-4">
        <pre className="text-xs whitespace-pre-wrap break-words">
          {JSON.stringify({ profile, stats, isOwner }, null, 2)}
        </pre>
      </div>
    )
  })()

  return (
    <AppLayout
      currentPage=""
      onNavigate={onNavigate}
      onLandingNavigate={() => navigate('/')}
      isDark={isDark}
      onToggleDark={toggleTheme}
      user={null}
      isAdmin={false}
      onToggleAdmin={undefined}
      currentUser={null}
      profile={null}
      authLoading={false}
      authError=""
      onLogout={undefined}
      supaReady={false}
      notifications={[]}
      unreadNotificationCount={0}
      notificationsLoading={false}
      notificationsError=""
      onNotificationMarkRead={undefined}
      onNotificationMarkAllRead={undefined}
      onNotificationNavigate={undefined}
    >
      {content}
    </AppLayout>
  )
}


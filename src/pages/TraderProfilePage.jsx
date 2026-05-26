import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useTraderProfile } from '../hooks/useTraderProfile'
import { useTheme } from '../hooks/useTheme'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/shadcn/avatar'
import { Badge } from '../components/ui/shadcn/badge'
import { Button } from '../components/ui/shadcn/button'

export default function TraderProfilePage() {
  const navigate = useNavigate()
  const { handle } = useParams()
  const { isDark, toggleTheme } = useTheme()
  const { profile, stats, isLoading, error, isOwner } = useTraderProfile(handle)
  const [isFollowing, setIsFollowing] = useState(null)
  const [followLoading, setFollowLoading] = useState(false)

  const onNavigate = (page) => {
    const p = String(page ?? '').trim()
    if (!p) return
    navigate(`/app/${p}`)
  }

  const safeHandle = useMemo(() => String(handle ?? '').trim(), [handle])

  const tags = useMemo(() => {
    const raw = profile?.style_tags
    const arr = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(',').map((t) => t.trim()).filter(Boolean)
        : []
    return arr.slice(0, 3)
  }, [profile?.style_tags])

  const nickname = useMemo(() => {
    const n = String(profile?.nickname ?? '').trim()
    if (n) return n
    const h = String(profile?.handle ?? '').trim()
    if (h) return h
    return '사용자'
  }, [profile?.nickname, profile?.handle])

  const avatarFallback = useMemo(() => {
    const s = String(nickname ?? '').trim()
    if (!s) return 'U'
    return s[0]
  }, [nickname])

  useEffect(() => {
    let cancelled = false

    async function loadFollowing() {
      if (!isSupabaseConfigured() || !supabase) {
        setIsFollowing(null)
        return
      }
      if (!profile?.id || isOwner) {
        setIsFollowing(null)
        return
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const viewerId = sessionData?.session?.user?.id ?? null
        if (!viewerId) {
          if (!cancelled) setIsFollowing(false)
          return
        }
        const { data, error: qErr } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', viewerId)
          .eq('following_id', profile.id)
          .maybeSingle()
        if (qErr) {
          if (!cancelled) setIsFollowing(null)
          return
        }
        if (!cancelled) setIsFollowing(Boolean(data?.id))
      } catch {
        if (!cancelled) setIsFollowing(null)
      }
    }

    loadFollowing()
    return () => {
      cancelled = true
    }
  }, [profile?.id, isOwner])

  const handleToggleFollow = async () => {
    if (!isSupabaseConfigured() || !supabase) return
    if (!profile?.id) return
    setFollowLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('toggle_follow', { p_following_id: profile.id })
      if (rpcError) throw rpcError
      if (typeof data === 'boolean') {
        setIsFollowing(data)
      } else {
        setIsFollowing((prev) => (typeof prev === 'boolean' ? !prev : true))
      }
    } catch {
      setIsFollowing((prev) => (typeof prev === 'boolean' ? prev : null))
    } finally {
      setFollowLoading(false)
    }
  }

  const content = (() => {
    if (isLoading) {
      return (
        <div className="min-h-[240px] flex items-center justify-center">
          <div className="text-text-secondary">Loading...</div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="min-h-[240px] flex items-center justify-center px-6">
          <div className="text-text-secondary">{error}</div>
        </div>
      )
    }

    if (profile === null) {
      return (
        <div className="min-h-[240px] flex items-center justify-center px-6">
          <div className="text-text-secondary">{`사용자를 찾을 수 없습니다 (handle: ${safeHandle})`}</div>
        </div>
      )
    }

    if (!profile?.is_trader) {
      return (
        <div className="min-h-[240px] flex items-center justify-center px-6">
          <div className="text-center space-y-2">
            <div className="text-text-primary">이 사용자는 아직 트레이더 모드를 활성화하지 않았어요</div>
            {isOwner ? (
              <div className="text-text-secondary text-[13px]">프로필 편집에서 활성화 가능</div>
            ) : null}
          </div>
        </div>
      )
    }

    return (
      <div className="border-b border-border-default bg-bg-surface-1">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-8">
            <div className="flex items-start gap-6 min-w-0">
              <Avatar className="h-24 w-24">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={`${nickname} avatar`} />
                ) : null}
                <AvatarFallback className="bg-bg-surface-2 text-text-primary text-3xl font-bold">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-2xl font-semibold text-text-primary truncate">{nickname}</h1>
                  {profile?.trader_verified_at ? (
                    <Badge variant="secondary" className="gap-1 bg-brand-soft/15 text-brand border border-border-default">
                      <BadgeCheck size={14} className="text-brand" />
                      검증됨
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1 text-[13px] text-text-secondary">
                  @{String(profile?.handle ?? safeHandle)}
                </div>

                {tags.length > 0 ? (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {tags.map((t) => (
                      <Badge key={t} variant="outline" className="border-border-default text-text-secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {profile?.bio ? (
                  <div className="mt-4 text-[13px] text-text-primary whitespace-pre-wrap">
                    {profile.bio}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 pt-1">
              {isOwner ? (
                <Button variant="outline" type="button" onClick={() => {}}>
                  프로필 편집
                </Button>
              ) : (
                <Button
                  variant={isFollowing ? 'outline' : 'default'}
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={followLoading || !profile?.id}
                >
                  {isFollowing ? '팔로잉' : '팔로우'}
                </Button>
              )}
            </div>
          </div>
        </div>
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

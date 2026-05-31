import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { 
  BadgeCheck, 
  User, 
  FileText, 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  BarChart3, 
  Zap,
  Loader2
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useTraderProfile } from '../hooks/useTraderProfile'
import { useTheme } from '../hooks/useTheme'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/shadcn/avatar'
import { Badge } from '../components/ui/shadcn/badge'
import { Button } from '../components/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/shadcn/card'

function formatNumber(num) {
  const n = Number(num ?? 0)
  if (Number.isNaN(n)) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function TabItem({ label, key, isActive, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative px-4 py-4 text-sm font-medium transition-colors duration-200',
        'flex items-center gap-2 whitespace-nowrap',
        isActive
          ? 'text-text-primary'
          : 'text-text-secondary hover:text-text-primary'
      ].join(' ')}
    >
      {label}
      {typeof count === 'number' && count > 0 ? (
        <span className="text-xs bg-bg-surface-2 text-text-secondary px-2 py-0.5 rounded-full border border-border-default">
          {formatNumber(count)}
        </span>
      ) : null}
      {isActive ? (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand rounded-t-full" />
      ) : null}
    </button>
  )
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={48} className="text-text-tertiary mb-4" />
      <h3 className="text-lg font-medium text-text-primary mb-1">{title}</h3>
      {subtitle ? (
        <p className="text-sm text-text-secondary max-w-md">{subtitle}</p>
      ) : null}
    </div>
  )
}

export default function TraderProfilePage() {
  const navigate = useNavigate()
  const { handle } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isDark, toggleTheme } = useTheme()
  const { profile, stats, isLoading, error, isOwner } = useTraderProfile(handle)
  const [isFollowing, setIsFollowing] = useState(null)
  const [followLoading, setFollowLoading] = useState(false)

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab')
    const validTabs = ['about', 'posts', 'strategies', 'signals', 'verification', 'performance']
    if (validTabs.includes(tab)) return tab
    return 'about'
  }, [searchParams])

  const setActiveTab = (tabKey) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', tabKey)
    setSearchParams(newParams, { replace: true })
  }

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

  const tabs = useMemo(() => [
    { key: 'about', label: '소개' },
    { key: 'posts', label: '게시물', count: profile?.post_count },
    { key: 'strategies', label: '전략', count: stats?.strategy_count },
    { key: 'signals', label: '라이브 시그널' },
    { key: 'verification', label: '검증' },
    { key: 'performance', label: '성과' },
  ], [profile?.post_count, stats?.strategy_count])

  const content = (() => {
    if (isLoading) {
      return (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="flex items-center gap-3 text-text-secondary">
            <Loader2 size={20} className="animate-spin" />
            <div>Loading...</div>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="min-h-[400px] flex items-center justify-center px-6">
          <div className="text-text-secondary">{error}</div>
        </div>
      )
    }

    if (profile === null) {
      return (
        <div className="min-h-[400px] flex items-center justify-center px-6">
          <div className="text-text-secondary">{`사용자를 찾을 수 없습니다 (handle: ${safeHandle})`}</div>
        </div>
      )
    }

    if (!profile?.is_trader) {
      return (
        <div className="min-h-[400px] flex items-center justify-center px-6">
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
      <>
        <div className="bg-bg-surface-1 border-b border-border-default">
          <div className="max-w-[1100px] mx-auto px-6 py-8">
            <div className="flex items-start justify-between gap-8">
              <div className="flex items-start gap-6 min-w-0">
                <Avatar className="h-24 w-24 rounded-2xl border border-border-default shadow-sm">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={`${nickname} avatar`} className="rounded-2xl" />
                  ) : null}
                  <AvatarFallback className="bg-bg-surface-2 text-text-primary text-3xl font-bold rounded-2xl">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-2xl font-semibold text-text-primary truncate">{nickname}</h1>
                    {profile?.trader_verified_at ? (
                      <BadgeCheck size={18} className="text-verified shrink-0" />
                    ) : null}
                  </div>
                  <div className="mt-1 text-[13px] text-text-secondary">
                    @{String(profile?.handle ?? safeHandle)}
                  </div>

                  {tags.length > 0 ? (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {tags.map((t) => (
                        <Badge key={t} variant="outline" className="border-border-default text-text-secondary bg-bg-base">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 pt-1">
                {isOwner ? (
                  <Button variant="outline" type="button" onClick={() => {}} className="border-border-default">
                    프로필 편집
                  </Button>
                ) : (
                  <Button
                    variant={isFollowing ? 'outline' : 'default'}
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={followLoading || !profile?.id}
                    className={isFollowing ? 'border-border-default' : ''}
                  >
                    {followLoading ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : null}
                    {isFollowing ? '팔로잉' : '팔로우'}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-text-primary tabular-nums">
                  {formatNumber(profile?.follower_count ?? 0)}
                </span>
                <span className="text-xs text-text-secondary">팔로워</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-text-primary tabular-nums">
                  {formatNumber(profile?.following_count ?? 0)}
                </span>
                <span className="text-xs text-text-secondary">팔로잉</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-text-primary tabular-nums">
                  {formatNumber(stats?.strategy_count ?? 0)}
                </span>
                <span className="text-xs text-text-secondary">전략</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-text-primary tabular-nums">
                  {formatNumber(profile?.post_count ?? 0)}
                </span>
                <span className="text-xs text-text-secondary">게시물</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-30 bg-bg-base border-b border-border-default">
          <div className="max-w-[1100px] mx-auto px-6 overflow-x-auto">
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <TabItem
                  key={tab.key}
                  keyProp={tab.key}
                  label={tab.label}
                  isActive={activeTab === tab.key}
                  count={tab.count}
                  onClick={() => setActiveTab(tab.key)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto px-6 py-8">
          {activeTab === 'about' ? (
            <div className="space-y-6">
              <Card className="border-border-default bg-bg-base shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">자기소개</CardTitle>
                </CardHeader>
                <CardContent>
                  {profile?.bio ? (
                    <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="text-text-secondary">
                      {isOwner ? (
                        <>아직 소개가 없습니다. 프로필 편집에서 추가하세요.</>
                      ) : (
                        <>아직 소개가 없습니다.</>
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border-default bg-bg-base shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">누적 성과</CardTitle>
                  {!stats ? (
                    <CardDescription className="text-text-tertiary">
                      아직 검증된 성과 데이터가 없습니다
                    </CardDescription>
                  ) : null}
                </CardHeader>
                {stats ? (
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-bg-surface-1 rounded-xl border border-border-default">
                        <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                          누적 수익률
                        </div>
                        <div className={[
                          'text-xl font-semibold tabular-nums',
                          (stats.total_return ?? 0) >= 0 ? 'text-long' : 'text-short'
                        ].join(' ')}>
                          {typeof stats.total_return === 'number' 
                            ? `${stats.total_return >= 0 ? '+' : ''}${stats.total_return.toFixed(2)}%`
                            : '-'}
                        </div>
                      </div>
                      <div className="p-4 bg-bg-surface-1 rounded-xl border border-border-default">
                        <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                          평균 승률
                        </div>
                        <div className="text-xl font-semibold text-text-primary tabular-nums">
                          {typeof stats.win_rate === 'number' 
                            ? `${stats.win_rate.toFixed(2)}%`
                            : '-'}
                        </div>
                      </div>
                      <div className="p-4 bg-bg-surface-1 rounded-xl border border-border-default">
                        <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                          최대 낙폭 (MDD)
                        </div>
                        <div className="text-xl font-semibold text-short tabular-nums">
                          {typeof stats.mdd === 'number' 
                            ? `${stats.mdd >= 0 ? '-' : ''}${Math.abs(stats.mdd).toFixed(2)}%`
                            : '-'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            </div>
          ) : activeTab === 'posts' ? (
            <EmptyState
              icon={FileText}
              title="아직 게시물이 없습니다"
              subtitle={isOwner ? "첫 번째 게시물을 작성해보세요." : null}
            />
          ) : activeTab === 'strategies' ? (
            <EmptyState
              icon={TrendingUp}
              title="준비 중입니다"
              subtitle="전략 목록이 곧 추가됩니다."
            />
          ) : activeTab === 'signals' ? (
            <EmptyState
              icon={Activity}
              title="준비 중입니다"
              subtitle="라이브 시그널이 곧 추가됩니다."
            />
          ) : activeTab === 'verification' ? (
            <EmptyState
              icon={CheckCircle2}
              title="준비 중입니다"
              subtitle="검증 기록이 곧 추가됩니다."
            />
          ) : activeTab === 'performance' ? (
            <EmptyState
              icon={BarChart3}
              title="준비 중입니다"
              subtitle="성과 분석이 곧 추가됩니다."
            />
          ) : (
            <EmptyState
              icon={Zap}
              title="탭을 찾을 수 없습니다"
            />
          )}
        </div>
      </>
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

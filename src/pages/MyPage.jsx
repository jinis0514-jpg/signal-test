import { useState }  from 'react'
import PageShell      from '../components/ui/PageShell'
import PageHeader     from '../components/ui/PageHeader'
import StatCard       from '../components/ui/StatCard'
import Card           from '../components/ui/Card'
import Button         from '../components/ui/Button'
import Badge          from '../components/ui/Badge'
import EmptyState     from '../components/ui/EmptyState'
import { cn }         from '../lib/cn'
import { getTrialUrgencyClass, getTrialUrgencyBg } from '../lib/userPlan'
import { REVIEW_STATUS } from '../lib/userStrategies'

const MENU = [
  { id: 'overview',        label: '개요'      },
  { id: 'my_strategies',   label: '내 전략'   },
  { id: 'subscription',    label: '구독 관리'  },
  { id: 'api',             label: 'API 설정'  },
  { id: 'notifications',   label: '알림 설정'  },
  { id: 'security',        label: '보안'      },
]

function PlanStatusCard({ user: u }) {
  const configs = {
    free: {
      badge:    'default',
      badgeLabel: 'Free',
      headline: '1개 전략만 사용 가능',
      sub:      '무료 체험을 시작하면 모든 전략을 7일간 이용할 수 있습니다.',
      ctaLabel: '7일 무료 체험 시작',
      ctaCls:   'text-slate-500',
    },
    trial: {
      badge:    'warning',
      badgeLabel: `Trial · ${u.trialDaysLeft}일 남음`,
      headline: `체험 종료까지 ${u.trialDaysLeft}일`,
      sub:      '체험이 종료되면 이 전략은 자동으로 잠깁니다. 지금 구독하면 중단 없이 사용할 수 있습니다.',
      ctaLabel: '이 전략 계속 사용하기',
      ctaCls:   getTrialUrgencyClass(u.trialDaysLeft),
    },
    subscribed: {
      badge:    'info',
      badgeLabel: 'Pro',
      headline: '모든 전략 사용 중',
      sub:      '실시간 시그널과 전체 백테스트 데이터를 제한 없이 이용하고 있습니다.',
      ctaLabel: null,
      ctaCls:   'text-blue-600',
    },
  }

  const cfg = configs[u.plan] ?? configs.free

  return (
    <Card>
      <Card.Header className="flex items-center justify-between">
        <Card.Title>플랜 상태</Card.Title>
        <Badge variant={cfg.badge}>{cfg.badgeLabel}</Badge>
      </Card.Header>
      <Card.Content>
        {/* 체험 긴박감 배지 (trial 한정) */}
        {u.plan === 'trial' && (
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border mb-2',
            getTrialUrgencyBg(u.trialDaysLeft),
          )}>
            <span className={cn('text-[11px] font-bold tabular-nums', cfg.ctaCls)}>
              {cfg.headline}
            </span>
          </div>
        )}

        {u.plan !== 'trial' && (
          <p className={cn('text-[12px] font-semibold mb-1', cfg.ctaCls)}>
            {cfg.headline}
          </p>
        )}

        <p className="text-[10px] text-slate-400 dark:text-slate-600 leading-relaxed mb-2">
          {cfg.sub}
        </p>

        {cfg.ctaLabel && (
          <Button variant="primary" size="sm">
            {cfg.ctaLabel}
          </Button>
        )}
      </Card.Content>
    </Card>
  )
}

function OverviewPanel({ user: u }) {
  return (
    <div className="flex flex-col gap-3">

      {/* 플랜 상태 카드 */}
      <PlanStatusCard user={u} />

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="활성 구독"
          value={u.plan === 'subscribed' ? String(u.unlockedStrategyIds?.length ?? 0) : '0'}
          sub="구독 중인 전략"
        />
        <StatCard
          label="체험 중"
          value={u.plan === 'trial' ? String(u.unlockedStrategyIds?.length ?? 0) : '0'}
          sub="무료 체험"
        />
        <StatCard label="가입일" value="2025.01" sub="계정 생성일" />
      </div>

      {/* 계정 정보 */}
      <Card>
        <Card.Header className="flex items-center justify-between">
          <Card.Title>계정 정보</Card.Title>
          <Button variant="ghost" size="sm">편집</Button>
        </Card.Header>
        <Card.Content className="p-0">
          {[
            ['이메일', 'user@example.com'],
            ['닉네임', 'Guest'],
            ['플랜',   <Badge variant={u.plan === 'subscribed' ? 'info' : u.plan === 'trial' ? 'warning' : 'default'}>
              {u.plan === 'subscribed' ? 'Pro' : u.plan === 'trial' ? 'Trial' : 'Free'}
            </Badge>],
          ].map(([label, value], i) => (
            <div key={String(label)} className={cn(
              'flex items-center px-3.5 py-2.5',
              i < 2 ? 'border-b border-gray-100 dark:border-gray-800' : ''
            )}>
              <span className="w-20 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
              <span className="text-xs text-gray-700 dark:text-gray-300">{value}</span>
            </div>
          ))}
        </Card.Content>
      </Card>
    </div>
  )
}

function SubscriptionPanel({ user: u }) {
  if (u.plan === 'subscribed') {
    return (
      <Card>
        <Card.Header><Card.Title>구독 정보</Card.Title></Card.Header>
        <Card.Content>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            전략 <span className="font-bold">{u.unlockedStrategyIds?.length ?? 0}개</span>를 구독 중입니다.
          </p>
          <p className="text-[10px] text-slate-400 mt-1">모든 전략의 실시간 시그널을 수신 중입니다.</p>
        </Card.Content>
      </Card>
    )
  }
  return (
    <EmptyState
      icon="📦"
      title="활성 구독이 없습니다"
      description="전략 마켓에서 전략을 체험하거나 구독하면 여기에 표시됩니다."
      action={<Button variant="primary" size="sm">전략 마켓으로 →</Button>}
    />
  )
}

function PlaceholderPanel({ title }) {
  return (
    <EmptyState
      icon="🔧"
      title={`${title} — 준비 중`}
      description="이 섹션은 아직 구현 전입니다."
      bordered
    />
  )
}

/* ── 내 전략 패널 ───────────────────────────── */
function MyStrategiesPanel({ strategies = [], onEditStrategy, authLoading, onDeleteStrategy, onSubmitStrategy }) {
  if (strategies.length === 0) {
    return (
      <EmptyState
        icon="📄"
        title="아직 제작한 전략이 없습니다"
        description="에디터에서 첫 전략을 만들어보세요."
        bordered
      />
    )
  }

  function fmtDate(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-2">
      {strategies.map((s) => {
        const statusCfg = REVIEW_STATUS[s.status] ?? REVIEW_STATUS.draft
        return (
          <Card key={s.id}>
            <Card.Content className="py-3 px-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* 이름 + 배지 */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                      {s.name}
                    </span>
                    <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
                    {s.typeLabel && <Badge variant="default">{s.typeLabel}</Badge>}
                  </div>

                  {/* 기본 정보 */}
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 mb-1.5">
                    {s.asset     && <span>{s.asset}</span>}
                    {s.timeframe && <span>{s.timeframe}</span>}
                    {s.riskLevel && <span>리스크 {s.riskLevel}</span>}
                    <span>제출일 {fmtDate(s.createdAt)}</span>
                  </div>

                  {/* 상태별 안내 메시지 */}
                  {s.status === 'under_review' && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      ⏳ 운영자가 검토 중입니다. 승인 후 마켓에 노출됩니다.
                    </p>
                  )}
                  {s.status === 'approved' && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      ✓ 승인됨 — 전략마켓에 게시 중입니다.
                    </p>
                  )}
                  {s.status === 'submitted' && (
                    <p className="text-[10px] text-blue-500 dark:text-blue-400">
                      ⌛ 검토 대기 중입니다.
                    </p>
                  )}
                  {s.status === 'draft' && (
                    <p className="text-[10px] text-slate-400">
                      임시 저장됨 — 에디터에서 수정 후 마켓에 제출하세요.
                    </p>
                  )}
                  {s.status === 'rejected' && (
                    <div className="mt-1.5">
                      <p className="text-[10px] text-red-500 font-semibold mb-0.5">
                        ✕ 반려됨
                      </p>
                      {s.reviewNote && (
                        <p className="text-[10px] text-red-400 bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-[1px] px-2 py-1 leading-snug">
                          반려 사유: {s.reviewNote}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                  <div className="flex items-center gap-1.5">
                    {(s.status === 'draft' || s.status === 'rejected') && (
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => onEditStrategy?.(s.id)}
                        disabled={!!authLoading}
                      >
                        수정
                      </Button>
                    )}
                    {(s.status === 'draft' || s.status === 'rejected') && (
                      <Button
                        variant="primary" size="sm"
                        onClick={() => onSubmitStrategy?.(s.id)}
                        disabled={!!authLoading}
                      >
                        {s.status === 'rejected' ? '다시 제출' : '제출'}
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => onDeleteStrategy?.(s.id)}
                      disabled={!!authLoading}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        )
      })}
    </div>
  )
}

export default function MyPage({
  user,
  userStrategies = [],
  onEditStrategy,
  onNavigate,
  currentUser,
  profile,
  authError,
  onLogin,
  onLogout,
  onRefreshStrategies,
  authLoading,
  onDeleteStrategy,
  onSubmitStrategy,
  onApproveForTest,
  strategiesLoading,
  strategiesError,
  profileLoading,
  supaReady,
}) {
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: [] }
  const [section, setSection] = useState('overview')
  const [email, setEmail] = useState('')

  const PANELS = {
    overview:        <OverviewPanel user={u} />,
    my_strategies:   (
      <MyStrategiesPanel
        strategies={userStrategies}
        onEditStrategy={onEditStrategy}
        authLoading={authLoading}
        onDeleteStrategy={onDeleteStrategy}
        onSubmitStrategy={onSubmitStrategy}
      />
    ),
    subscription:    <SubscriptionPanel user={u} />,
    api:             <PlaceholderPanel title="API 설정" />,
    notifications:   <PlaceholderPanel title="알림 설정" />,
    security:        <PlaceholderPanel title="보안 설정" />,
  }

  return (
    <PageShell>
      <PageHeader title="마이페이지" description="계정 및 구독을 관리합니다." />

      {/* ── 로그인/세션 패널 (Supabase) ───────────── */}
      {(onLogin || onLogout) && (
        <Card className="mb-3">
          <Card.Header className="flex items-center justify-between">
            <Card.Title>로그인</Card.Title>
            {profile?.role && (
              <Badge variant={profile.role === 'admin' ? 'warning' : 'default'}>
                {profile.role}
              </Badge>
            )}
          </Card.Header>
          <Card.Content className="flex items-center gap-2">
            {currentUser ? (
              <>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {currentUser.email ?? '로그인됨'}
                  {profile?.nickname ? ` · ${profile.nickname}` : ''}
                </span>
                <div className="flex-1" />
                <Button variant="secondary" size="sm" onClick={() => onRefreshStrategies?.()}>
                  내 전략 새로고침
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onLogout?.()}>
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 (매직 링크)"
                  className="
                    flex-1 h-8 text-[11px] px-2
                    border border-gray-200 dark:border-gray-700 rounded-[1px]
                    bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300
                    focus:outline-none
                  "
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onLogin?.(email)}
                  disabled={!email.includes('@')}
                >
                  이메일 로그인
                </Button>
              </>
            )}
          </Card.Content>
          {authError && (
            <div className="px-3.5 pb-3">
              <p className="text-[10px] text-red-500">{authError}</p>
            </div>
          )}
          <div className="px-3.5 pb-3 flex items-center gap-1.5">
            <Badge variant={supaReady ? 'success' : 'default'}>DB {supaReady ? 'ON' : 'OFF'}</Badge>
            <Badge variant={currentUser ? 'info' : 'default'}>{currentUser ? '로그인됨' : '로그인 필요'}</Badge>
            <Badge variant={profile ? 'success' : (profileLoading ? 'warning' : 'default')}>
              {profile ? 'profile OK' : (profileLoading ? 'profile 로딩' : 'profile 없음')}
            </Badge>
          </div>
        </Card>
      )}

      {/* 승인 테스트 액션 (임시) */}
      {currentUser && (
        <Card className="mb-3">
          <Card.Header><Card.Title>승인 테스트</Card.Title></Card.Header>
          <Card.Content className="flex items-center gap-2 flex-wrap">
            {(userStrategies.filter((s) => s.status === 'submitted').slice(0, 3)).map((s) => (
              <button
                key={s.id}
                onClick={() => onApproveForTest?.(s.id)}
                className="h-6 px-2 text-[10px] font-semibold rounded-[1px] bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                승인 테스트: {s.name}
              </button>
            ))}
            {userStrategies.filter((s) => s.status === 'submitted').length === 0 && (
              <span className="text-[10px] text-slate-400">submitted 전략 없음</span>
            )}
          </Card.Content>
        </Card>
      )}

      {strategiesLoading && (
        <div className="mb-3 px-3 py-2 border border-slate-200 bg-slate-50/70 dark:bg-slate-900 dark:border-slate-800 rounded-[2px]">
          <p className="text-[11px] text-slate-500">전략 목록 로딩 중...</p>
        </div>
      )}
      {strategiesError && (
        <div className="mb-3 px-3 py-2 border border-red-200 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900/40 rounded-[2px]">
          <p className="text-[11px] text-red-500">{strategiesError}</p>
        </div>
      )}

      <div className="flex gap-4">
        {/* 좌측 내부 메뉴 */}
        <nav className="w-36 flex-shrink-0">
          <ul>
            {MENU.map(({ id, label }) => (
              <li key={id}>
                <button
                  onClick={() => setSection(id)}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 text-[11px] rounded-[2px] transition-colors',
                    section === id
                      ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-400'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300'
                  )}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 min-w-0">
          {PANELS[section]}
        </div>
      </div>
    </PageShell>
  )
}

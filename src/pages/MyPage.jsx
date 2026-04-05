import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell      from '../components/ui/PageShell'
import PageHeader     from '../components/ui/PageHeader'
import StatCard       from '../components/ui/StatCard'
import Card           from '../components/ui/Card'
import Button         from '../components/ui/Button'
import Badge          from '../components/ui/Badge'
import EmptyState     from '../components/ui/EmptyState'
import { cn }         from '../lib/cn'
import {
  getTrialUrgencyClass,
  getTrialUrgencyBg,
  getPlanKindLabel,
  getSubscriptionStatusLabel,
  hasPaidPlanFeatures,
  PLAN_MESSAGES,
  canSubmitStrategyToMarket,
  countMarketPipelineStrategies,
  getMaxSubmittedStrategies,
  getEffectiveProductTier,
  getPlanTierDisplayName,
  PLAN_COMPARISON_FEATURES,
  PLAN_TIER,
  MARKET_LISTING_FEE_KRW,
  MARKET_PIPELINE_MAX_STRATEGIES,
} from '../lib/userPlan'
import { REVIEW_STATUS } from '../lib/userStrategies'
import { rolling7dPnlPct, currentDrawdownPct, recentTradesPreview } from '../lib/retentionSnapshot'

function fmtPlanExpiry(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

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
      badgeLabel: `Starter · ${u.trialDaysLeft}일 남음`,
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
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border mb-2',
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

        {(u.plan === 'trial' || u.plan === 'subscribed') && u.subscriptionExpiresAt && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 tabular-nums">
            만료 예정: {fmtPlanExpiry(u.subscriptionExpiresAt)}
          </p>
        )}

        {cfg.ctaLabel && (
          <p className="mt-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            안내: {cfg.ctaLabel}
          </p>
        )}
      </Card.Content>
    </Card>
  )
}

function ConsumerSellerSummaryCard({ user: u, userStrategies = [] }) {
  const tier = getEffectiveProductTier(u)
  const pipeline = countMarketPipelineStrategies(userStrategies)
  const maxSlots = getMaxSubmittedStrategies(u)
  const canSell = canSubmitStrategyToMarket(u)
  const remaining = canSell ? Math.max(0, maxSlots - pipeline) : 0

  return (
    <Card>
      <Card.Header className="flex items-center justify-between">
        <Card.Title>소비 · 판매 권한</Card.Title>
        <Badge variant={
          tier === PLAN_TIER.PREMIUM ? 'success'
            : tier === PLAN_TIER.PRO ? 'info'
              : tier === PLAN_TIER.STARTER ? 'warning'
                : 'default'
        }
        >
          {getPlanTierDisplayName(tier)}
        </Badge>
      </Card.Header>
      <Card.Content className="space-y-2 text-[11px] text-slate-600 dark:text-slate-400">
        <p>
          <span className="font-semibold text-slate-700 dark:text-slate-300">전략 열람·모의·검증·알림: </span>
          {hasPaidPlanFeatures(u) ? 'Starter 이상 — 확대된 범위' : 'Free — 일부 제한'}
        </p>
        <p>
          <span className="font-semibold text-slate-700 dark:text-slate-300">마켓 제출(판매): </span>
          {canSell
            ? `가능 · 파이프라인 ${pipeline} / ${maxSlots} (남은 슬롯 ${remaining})`
            : '불가 — Pro(구독) 필요'}
        </p>
      </Card.Content>
    </Card>
  )
}

function OverviewPanel({ user: u, userStrategies = [] }) {
  return (
    <div className="flex flex-col gap-3">

      <ConsumerSellerSummaryCard user={u} userStrategies={userStrategies} />

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
          <Button variant="ghost" size="sm" type="button" disabled title="준비 중">
            편집 · 준비 중
          </Button>
        </Card.Header>
        <Card.Content className="p-0">
          {[
            ['이메일', 'user@example.com'],
            ['닉네임', 'Guest'],
            ['플랜',   <span className="flex flex-col gap-0.5 items-start">
              <Badge variant={u.plan === 'subscribed' ? 'info' : u.plan === 'trial' ? 'warning' : 'default'}>
                {getPlanKindLabel(u)}
              </Badge>
              {u.subscriptionExpiresAt && (u.plan === 'trial' || u.plan === 'subscribed') && (
                <span className="text-[9px] text-slate-400 tabular-nums">
                  만료 {fmtPlanExpiry(u.subscriptionExpiresAt)}
                </span>
              )}
            </span>],
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

function PlanComparisonTable({ user: u }) {
  const tier = getEffectiveProductTier(u)
  const highlight = (t) => tier === t

  return (
    <Card>
      <Card.Header>
        <Card.Title>플랜 비교</Card.Title>
      </Card.Header>
      <Card.Content className="p-0 overflow-x-auto">
        <table className="w-full min-w-[480px] text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30">
              <th className="text-left font-semibold text-slate-500 p-2 w-[22%]">기능</th>
              <th className={cn(
                'p-2 font-semibold text-center',
                highlight(PLAN_TIER.FREE) && 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200',
              )}
              >Free
              </th>
              <th className={cn(
                'p-2 font-semibold text-center',
                highlight(PLAN_TIER.STARTER) && 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200',
              )}
              >Starter
              </th>
              <th className={cn(
                'p-2 font-semibold text-center',
                highlight(PLAN_TIER.PRO) && 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200',
              )}
              >Pro
              </th>
              <th className={cn(
                'p-2 font-semibold text-center',
                highlight(PLAN_TIER.PREMIUM) && 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200',
              )}
              >Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {PLAN_COMPARISON_FEATURES.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 dark:border-gray-800/80">
                <td className="p-2 text-slate-600 dark:text-slate-400">{row.label}</td>
                <td className="p-2 text-center text-slate-500">{row.free}</td>
                <td className="p-2 text-center text-slate-500">{row.starter}</td>
                <td className="p-2 text-center text-slate-500">{row.pro}</td>
                <td className="p-2 text-center text-slate-500">{row.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-400 px-3 py-2 border-t border-slate-100 dark:border-gray-800 leading-relaxed">
          가격(월): Starter ₩9,900 · Pro ₩39,000 · Premium ₩99,000. 승인된 전략 마켓 게시 기간 6개월(갱신 시 연장).
          판매 수수료 Pro 30% / Premium 10%. 등록 수수료는 정책에 따라 부과 가능(현재 {MARKET_LISTING_FEE_KRW}원).
        </p>
      </Card.Content>
    </Card>
  )
}

function SubscriptionPanel({
  user: u,
  currentUser,
  supaReady,
  loading,
  feedback,
  onStartTrial,
  onUpgrade,
  onCancel,
  onRefresh,
  onNavigate,
}) {
  const statusTxt = getSubscriptionStatusLabel(u)
  const planTxt = getPlanKindLabel(u)
  const needsRemote = !supaReady || !currentUser?.id

  const isFreeNever = u.plan === 'free' && !u.subscriptionStatus
  const isFreeEnded = u.plan === 'free' && (u.subscriptionStatus === 'canceled' || u.subscriptionStatus === 'expired')

  let primaryCta = null
  if (needsRemote) {
    primaryCta = { label: '로그인 필요', action: null, variant: 'secondary' }
  } else if (u.plan === 'trial') {
    primaryCta = { label: '유료 플랜으로 전환', action: onUpgrade, variant: 'primary' }
  } else if (u.plan === 'subscribed' && u.subscriptionStatus === 'active') {
    primaryCta = { label: '구독 해지', action: onCancel, variant: 'secondary' }
  } else if (isFreeEnded) {
    primaryCta = { label: '다시 구독하기', action: onUpgrade, variant: 'primary' }
  } else if (isFreeNever || u.plan === 'free') {
    primaryCta = { label: '7일 무료 체험 시작', action: onStartTrial, variant: 'primary' }
  }

  return (
    <div className="flex flex-col gap-3">
      {!needsRemote && u.plan === 'free' && (
        <Card className="border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <Card.Content className="py-3.5">
            <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">전체 알림·시뮬·검증을 쓰려면 체험 또는 Pro가 필요합니다</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              아래에서 7일 무료 체험을 시작하거나 유료로 전환하세요. 체험 중에는 알림·시그널·검증 제한이 해제됩니다.
            </p>
          </Card.Content>
        </Card>
      )}

      <Card>
        <Card.Header className="flex items-center justify-between flex-wrap gap-2">
          <Card.Title>구독 상태</Card.Title>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={u.plan === 'subscribed' ? 'info' : u.plan === 'trial' ? 'warning' : 'default'}>
              {u.plan === 'free' ? 'Free' : u.plan === 'trial' ? 'Starter' : 'Pro'}
            </Badge>
            {statusTxt && (
              <Badge variant={u.subscriptionStatus === 'active' ? 'success' : 'default'}>{statusTxt}</Badge>
            )}
          </div>
        </Card.Header>
        <Card.Content className="space-y-2">
          <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">{planTxt}</p>
          {u.plan === 'trial' && u.subscriptionExpiresAt && (
            <p className="text-[10px] text-slate-500 tabular-nums">
              체험 남은 일수: <span className="font-bold text-slate-700 dark:text-slate-200">{u.trialDaysLeft}일</span>
              {' · '}
              만료 예정 {fmtPlanExpiry(u.subscriptionExpiresAt)}
            </p>
          )}
          {u.plan === 'subscribed' && u.subscriptionExpiresAt && (
            <p className="text-[10px] text-slate-500 tabular-nums">
              구독 만료일: {fmtPlanExpiry(u.subscriptionExpiresAt)}
            </p>
          )}
          {needsRemote && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Supabase 로그인 후 구독·체험을 사용할 수 있습니다.
            </p>
          )}
          {feedback?.ok && (
            <p className="text-[10px] text-blue-600 dark:text-blue-400">{feedback.ok}</p>
          )}
          {feedback?.err && (
            <p className="text-[10px] text-red-500">{feedback.err}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {primaryCta?.action && (
              <Button
                variant={primaryCta.variant}
                size="sm"
                disabled={loading || needsRemote}
                onClick={() => primaryCta.action?.()}
              >
                {loading ? '처리 중…' : primaryCta.label}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={loading || needsRemote}
              onClick={() => onRefresh?.()}
            >
              상태 새로고침
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => onNavigate?.('market')}>
              전략 마켓
            </Button>
          </div>
        </Card.Content>
      </Card>

      <PlanComparisonTable user={u} />

      <Card>
        <Card.Header><Card.Title>이용 안내</Card.Title></Card.Header>
        <Card.Content className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
          <p>· Free: 저장 1개, 마켓 일부 열람, 제한된 시뮬·검증·알림</p>
          <p>· Starter(체험): 열람·모의·검증·알림 확대 — 마켓 판매(제출)은 불가</p>
          <p>· Pro(구독): 소비 기능 전체 + 마켓 제출 최대 {MARKET_PIPELINE_MAX_STRATEGIES}개 (검수 후 노출)</p>
        </Card.Content>
      </Card>
    </div>
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

function NotificationsSettingsPanel({ user: u, onNavigate }) {
  const paid = hasPaidPlanFeatures(u)
  if (!paid) {
    return (
      <Card>
        <Card.Header><Card.Title>알림 설정</Card.Title></Card.Header>
        <Card.Content className="space-y-2">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {PLAN_MESSAGES.notificationsProDetail ?? PLAN_MESSAGES.notifications}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('market')}>
              마켓 보기
            </Button>
            <Button variant="primary" size="sm" type="button" onClick={() => onNavigate?.('plans')}>
              플랜 비교
            </Button>
          </div>
        </Card.Content>
      </Card>
    )
  }
  return (
    <PlaceholderPanel title="알림 설정" />
  )
}

/* ── 내 전략 패널 ───────────────────────────── */
function MyStrategiesPanel({
  user: panelUser,
  strategies = [],
  onEditStrategy,
  authLoading,
  onDeleteStrategy,
  onSubmitStrategy,
  canSubmitMarket = false,
  onNavigate,
  onGoSubscription,
}) {
  const u = panelUser ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: [] }
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

  const pipelineN = countMarketPipelineStrategies(strategies)
  const maxSlots = getMaxSubmittedStrategies(u)
  const remaining = canSubmitMarket
    ? Math.max(0, maxSlots - pipelineN)
    : null

  return (
    <div className="flex flex-col gap-2">
      {canSubmitMarket && (
        <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 mb-1">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            마켓 제출 슬롯: {pipelineN} / {maxSlots}
            {remaining != null && (
              <span className="font-normal text-slate-500"> (남음 {remaining})</span>
            )}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">제출·검수중·승인 상태가 파이프라인에 포함됩니다.</p>
        </div>
      )}
      {!canSubmitMarket && (
        <div className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/25 mb-1">
          <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
            {PLAN_MESSAGES.marketSubmitProOnly}
          </p>
          <button
            type="button"
            className="mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            onClick={() => onGoSubscription?.()}
          >
            Pro 업그레이드 →
          </button>
        </div>
      )}
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
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      ✓ 승인됨 — 전략마켓에 게시 중입니다.
                    </p>
                  )}
                  {s.status === 'submitted' && (
                    <p className="text-[10px] text-blue-500 dark:text-blue-400">
                      ⌛ 검수 대기 중입니다. 승인 후 마켓에 노출됩니다.
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
                        <p className="text-[10px] text-red-400 bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-md px-2 py-1 leading-snug">
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
                        disabled={!!authLoading || !canSubmitMarket}
                        title={!canSubmitMarket ? PLAN_MESSAGES.marketSubmitProOnly : undefined}
                      >
                        {!canSubmitMarket ? 'Pro 필요' : (s.status === 'rejected' ? '다시 제출' : '검수 요청')}
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
  onGoPlans,
  currentUser,
  profile,
  authError,
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
  onRefreshSubscription,
  subscriptionActionLoading = false,
  subscriptionFeedback = { ok: '', err: '' },
  onSubscriptionTrial,
  onSubscriptionUpgrade,
  onSubscriptionCancel,
}) {
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: [] }
  const navigate = useNavigate()

  const totalStrategies = userStrategies.length
  const runningStrategies = useEffect(() => {}, []) // placeholder to keep hook order stable (no-op)
  const unlockedN = u?.plan === 'subscribed' || u?.plan === 'trial'
    ? (u.unlockedStrategyIds?.length ?? 0)
    : 0

  const reviewCounts = useState(() => ({}))[0] // keep minimal changes; counts computed inline below

  const retentionKey = userStrategies[0]?.id ?? 'default'
  const retentionUser = currentUser?.id ?? 'local'
  const myRetention = useMemo(() => ({
    p7: rolling7dPnlPct(retentionKey, retentionUser),
    dd: currentDrawdownPct(retentionKey, retentionUser),
    trades: recentTradesPreview(retentionKey, retentionUser, 5),
  }), [retentionKey, retentionUser])

  return (
    <PageShell>
      <PageHeader
        title="마이페이지"
        description="내 전략과 플랜 상태를 한눈에 관리합니다."
      />

      <Card className="mb-6 border border-slate-200/80 dark:border-gray-800">
        <Card.Header className="py-2">
          <Card.Title className="text-[13px]">플랜·구독</Card.Title>
        </Card.Header>
        <Card.Content className="py-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => onGoPlans?.()}>
            현재 플랜 보기
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={() => onGoPlans?.()}>
            플랜 업그레이드
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => {
              try { sessionStorage.setItem('bb_mypage_section', 'subscription') } catch { /* ignore */ }
              document.getElementById('bb-subscription-section')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            구독 관리
          </Button>
        </Card.Content>
      </Card>

      {/* ── 계정 · 사용자 정보 · 연결 상태 (상단바와 분리) ───────────── */}
      {onLogout && (
        <Card className="mb-6">
          <Card.Header className="flex items-center justify-between py-2">
            <Card.Title className="text-[13px]">계정</Card.Title>
            {profile?.role && (
              <Badge variant={profile.role === 'admin' ? 'warning' : 'default'}>
                {profile.role}
              </Badge>
            )}
          </Card.Header>
          <Card.Content className="py-2.5 space-y-3">
            {!currentUser && (
              <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                이메일과 비밀번호로 로그인하면 전략 저장·시그널·알림을 이어갈 수 있어요.
              </p>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {currentUser ? (
                <>
                  <span className="text-[12px] text-slate-600 dark:text-slate-400 flex-1 min-w-0 truncate">
                    {currentUser.email ?? '로그인됨'}
                    {profile?.nickname ? ` · ${profile.nickname}` : ''}
                  </span>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => onRefreshStrategies?.()}>
                      전략 새로고침
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onLogout?.()}>
                      로그아웃
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={() => navigate('/auth?mode=login')}
                  >
                    로그인
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => navigate('/auth?mode=signup')}
                  >
                    회원가입
                  </Button>
                </div>
              )}
            </div>

            {/* 서비스 연결·인증·프로필 (개발 배지 문구 없이 정리) */}
            <div className="border-t border-slate-100 dark:border-gray-800 pt-4 mt-1 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                사용자 · 인증 · 프로필
              </p>
              <dl className="space-y-2.5 text-[12px]">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3">
                  <dt className="text-slate-500 dark:text-slate-500 shrink-0">사용자</dt>
                  <dd className="text-slate-800 dark:text-slate-100 sm:text-right break-all">
                    {currentUser
                      ? (currentUser.email ?? '세션 있음')
                      : '로그인되지 않음'}
                  </dd>
                </div>
                {currentUser?.id && (
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3">
                    <dt className="text-slate-500 dark:text-slate-500 shrink-0">사용자 ID</dt>
                    <dd className="font-mono text-[11px] text-slate-600 dark:text-slate-300 sm:text-right break-all">
                      {currentUser.id}
                    </dd>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3">
                  <dt className="text-slate-500 dark:text-slate-500 shrink-0">인증 상태</dt>
                  <dd className="sm:text-right">
                    <span className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                      currentUser
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-slate-400',
                    )}
                    >
                      {currentUser ? '로그인 세션 활성' : '로그인 필요'}
                    </span>
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3">
                  <dt className="text-slate-500 dark:text-slate-500 shrink-0">클라우드 저장소</dt>
                  <dd className="sm:text-right">
                    <span className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                      supaReady
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/35 dark:text-blue-200'
                        : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
                    )}
                    >
                      {supaReady ? '연결됨 · 전략·알림 동기화 가능' : '연결 불가 · 로컬만 사용'}
                    </span>
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3">
                  <dt className="text-slate-500 dark:text-slate-500 shrink-0">프로필</dt>
                  <dd className="text-slate-800 dark:text-slate-200 sm:text-right">
                    {profileLoading ? (
                      <span className="text-slate-500">불러오는 중…</span>
                    ) : profile ? (
                      <span>
                        {profile.nickname ? (
                          <span className="font-medium">{profile.nickname}</span>
                        ) : (
                          <span className="text-slate-500">닉네임 미설정</span>
                        )}
                        {profile.role && (
                          <span className="text-slate-400 dark:text-slate-500 ml-1">
                            · {profile.role}
                          </span>
                        )}
                      </span>
                    ) : currentUser ? (
                      <span className="text-slate-500">동기화된 프로필 없음</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </Card.Content>
          {authError && (
            <div className="px-3.5 pb-2">
              <p className="text-[10px] text-red-500">{authError}</p>
            </div>
          )}
        </Card>
      )}

      {/* 개발 전용 — 승인 테스트 */}
      {import.meta.env.DEV && currentUser && (
        <Card className="mb-6 border-dashed border-amber-200/80 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10">
          <Card.Header className="py-2.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <Card.Title className="text-[13px]">승인 테스트</Card.Title>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/90 font-medium shrink-0">개발 빌드에서만 표시</span>
          </Card.Header>
          <Card.Content className="flex items-center gap-2 flex-wrap">
            {(userStrategies.filter((s) => s.status === 'submitted').slice(0, 3)).map((s) => (
              <button
                key={s.id}
                onClick={() => onApproveForTest?.(s.id)}
                className="h-6 px-2 text-[10px] font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
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
        <div className="mb-6 px-3 py-2 border border-slate-200 bg-slate-50/70 dark:bg-slate-900 dark:border-slate-800 rounded-lg">
          <p className="text-[11px] text-slate-500">전략 목록 로딩 중...</p>
        </div>
      )}
      {strategiesError && (
        <div className="mb-6 px-3 py-2 border border-red-200 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900/40 rounded-lg">
          <p className="text-[11px] text-red-500">{strategiesError}</p>
        </div>
      )}

      {/* 1) 상단 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="총 전략 수"
          value={String(totalStrategies)}
          sub="내가 만든 전략"
        />
        <StatCard
          label="실행 중 전략"
          value={String(unlockedN)}
          sub="체험/구독으로 사용 가능"
        />
        <StatCard
          label="구독 상태"
          value={u.plan === 'subscribed' ? 'Pro' : u.plan === 'trial' ? 'Starter' : 'Free'}
          sub={u.plan === 'trial' ? `체험 ${u.trialDaysLeft}일 남음` : '플랜'
          }
        />
      </div>

      <Card className="mb-6 border border-slate-200 dark:border-gray-800">
        <Card.Header className="flex flex-wrap items-center justify-between gap-2">
          <Card.Title>실행 성과 스냅샷</Card.Title>
          <span className="text-[10px] text-slate-400">대표 전략 기준 · 참고용</span>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">최근 7일 수익률</p>
              <p className={cn(
                'text-[20px] font-bold font-mono tabular-nums mt-1',
                myRetention.p7 >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}
              >
                {myRetention.p7 >= 0 ? '+' : ''}{myRetention.p7}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">현재 Drawdown</p>
              <p className="text-[20px] font-bold font-mono tabular-nums text-red-600 mt-1">
                −{myRetention.dd}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 dark:border-gray-800 px-3 py-2.5 sm:col-span-1">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">요약</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                전략을 수정·검증해 성과를 개선해 보세요. 시그널에서 실시간 포지션을 확인할 수 있습니다.
              </p>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">최근 거래</p>
            <div className="rounded-lg border border-slate-100 dark:border-gray-800 divide-y divide-slate-100 dark:divide-gray-800">
              {myRetention.trades.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 text-[11px]">
                  <span className="font-mono text-slate-600 dark:text-slate-400">{t.label}</span>
                  <span className={cn('font-mono font-bold tabular-nums', t.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {t.pnl >= 0 ? '+' : ''}{t.pnl}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* 2) 내 전략 목록 */}
      <div className="mb-6">
        <MyStrategiesPanel
          user={u}
          strategies={userStrategies}
          onEditStrategy={onEditStrategy}
          authLoading={authLoading}
          onDeleteStrategy={onDeleteStrategy}
          onSubmitStrategy={onSubmitStrategy}
          canSubmitMarket={canSubmitStrategyToMarket(u)}
          onNavigate={onNavigate}
          onGoSubscription={onGoPlans}
        />
      </div>

      {/* 3) 실행 중 전략 (요약) */}
      <Card className="mb-6">
        <Card.Header className="flex items-center justify-between">
          <Card.Title>실행 중 전략</Card.Title>
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.('signal')}>
            시그널로 이동
          </Button>
        </Card.Header>
        <Card.Content className="space-y-2">
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            현재 실행/상태 확인은 <span className="font-semibold text-slate-700 dark:text-slate-300">시그널</span> 페이지에서 확인합니다.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(u.unlockedStrategyIds ?? []).length === 0 ? (
              <span className="text-[11px] text-slate-400">실행 중인 전략이 없습니다.</span>
            ) : (u.unlockedStrategyIds ?? []).slice(0, 8).map((id) => (
              <Badge key={id} variant="default">{id}</Badge>
            ))}
          </div>
        </Card.Content>
      </Card>

      {/* 4) 구독 / 플랜 상태 */}
      <div id="bb-subscription-section" className="scroll-mt-24">
        <SubscriptionPanel
          user={u}
          currentUser={currentUser}
          supaReady={supaReady}
          loading={subscriptionActionLoading}
          feedback={subscriptionFeedback}
          onStartTrial={onSubscriptionTrial}
          onUpgrade={onSubscriptionUpgrade}
          onCancel={onSubscriptionCancel}
          onRefresh={onRefreshSubscription}
          onNavigate={onNavigate}
        />
      </div>
    </PageShell>
  )
}

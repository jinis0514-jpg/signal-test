import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ExchangeConnectionForm from '../components/verification/ExchangeConnectionForm'
import { cn } from '../lib/cn'
import {
  hasPaidPlanFeatures,
  getPlanKindLabel,
  getSubscriptionStatusLabel,
  canSubmitStrategyToMarket,
  getMaxSubmittedStrategies,
  getEffectiveProductTier,
  getPlanTierDisplayName,
  PLAN_TIER,
  PLAN_COMPARISON_FEATURES,
  PLAN_MESSAGES,
  MARKET_LISTING_FEE_KRW,
  shouldShowAds,
  resolvePlanAndRules,
} from '../lib/userPlan'
import { REVIEW_STATUS } from '../lib/userStrategies'
import { rolling7dPnlPct } from '../lib/retentionSnapshot'
import { createSupportMessage, SupportInboxError } from '../lib/supportInboxService'

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function fmtPct(v, digits = 1) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
}

function fmtDate(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ko-KR')
}

function planUsageLimitByTier(tier) {
  if (tier === PLAN_TIER.PREMIUM) return { sub: null, reg: 10 }
  if (tier === PLAN_TIER.PRO) return { sub: null, reg: 5 }
  if (tier === PLAN_TIER.STARTER || tier === PLAN_TIER.STANDARD) return { sub: 2, reg: 0 }
  return { sub: 0, reg: 0 }
}

function kpiTone(value) {
  if (typeof value !== 'string') return 'text-slate-900 dark:text-slate-100'
  if (value.includes('+') || value.includes('ON') || value.includes('활성')) return 'text-emerald-600 dark:text-emerald-400'
  if (value.includes('-') || value.includes('OFF') || value.includes('주의') || value.includes('제한')) return 'text-red-600 dark:text-red-400'
  return 'text-slate-900 dark:text-slate-100'
}

function ProfileSummaryCard({
  currentUser,
  profile,
  user,
  subscribedCount,
  myStrategiesCount,
  notifySummary,
}) {
  const nickname = profile?.nickname || '사용자'
  const email = currentUser?.email || '이메일 없음'
  const planLabel = getPlanKindLabel(user)
  const joined = fmtDate(profile?.created_at || currentUser?.created_at)
  const accountState = currentUser ? '가입 완료' : '로그인 필요'

  const kpis = [
    { label: '현재 플랜', value: planLabel },
    { label: '구독 전략 수', value: String(subscribedCount) },
    { label: '등록 전략 수', value: String(myStrategiesCount) },
    { label: '알림 상태', value: notifySummary },
  ]

  return (
    <Card>
      <Card.Header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Card.Title className="text-[16px] font-bold">{nickname}</Card.Title>
          <p className="text-[12px] text-slate-500 truncate">{email}</p>
        </div>
        <Badge variant={currentUser ? 'success' : 'default'}>{accountState}</Badge>
      </Card.Header>
      <Card.Content className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">{k.label}</p>
              <p className={cn('mt-1 text-[18px] font-bold tabular-nums', kpiTone(k.value))}>{k.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">가입일: {joined}</p>
      </Card.Content>
    </Card>
  )
}

function PlanStatusCard({ user, subscribedCount, myStrategiesCount, onGoPlans, onNavigate }) {
  const { plan, rules } = resolvePlanAndRules(user)
  const tier = getEffectiveProductTier(user)
  const tierLabel = getPlanTierDisplayName(tier)
  const planStatus = getSubscriptionStatusLabel(user)
  const limits = planUsageLimitByTier(tier)
  const subUnlimited = limits.sub == null
  const subRemain = subUnlimited ? null : Math.max(0, limits.sub - subscribedCount)
  const regRemain = Math.max(0, limits.reg - myStrategiesCount)
  const adsOn = shouldShowAds(user)

  return (
    <Card>
      <Card.Header className="flex items-center justify-between gap-2">
        <Card.Title>현재 플랜 / 업그레이드</Card.Title>
        <Badge variant={tier === PLAN_TIER.FREE ? 'default' : 'info'}>{tierLabel}</Badge>
      </Card.Header>
      <Card.Content className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2.5">
            <p className="text-[10px] text-slate-500">상태</p>
            <p className="text-[15px] font-semibold">{planStatus}</p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2.5">
            <p className="text-[10px] text-slate-500">구독 전략 사용량</p>
            <p className="text-[15px] font-semibold tabular-nums">{subscribedCount} / {subUnlimited ? '무제한' : limits.sub}</p>
            <p className="text-[10px] text-slate-500">{subUnlimited ? '상한 없음' : `남은 ${subRemain}`}</p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2.5">
            <p className="text-[10px] text-slate-500">등록 전략 사용량</p>
            <p className="text-[15px] font-semibold tabular-nums">{myStrategiesCount} / {limits.reg}</p>
            <p className="text-[10px] text-slate-500">남은 {regRemain}</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2.5 text-[11px] text-slate-600 dark:text-slate-400">
          <p>현재 플랜: {plan}</p>
          <p>구독 가능: {rules.maxSubscriptions === Infinity ? '무제한' : rules.maxSubscriptions}</p>
          <p>등록 가능: {rules.maxListings}</p>
          <p className="mt-1">광고 노출: {rules.ads ? '노출 ON (무료 플랜)' : '노출 OFF (스탠다드 이상)'}</p>
          <p className="mt-1">전략 등록 수수료: {MARKET_LISTING_FEE_KRW.toLocaleString()}원</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => onGoPlans?.()}>현재 플랜 보기</Button>
          <Button variant="primary" size="sm" type="button" onClick={() => onGoPlans?.()}>플랜 업그레이드</Button>
          <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('plans')}>구독 관리</Button>
        </div>
      </Card.Content>
    </Card>
  )
}

function SubscribedStrategiesSection({ items = [], notifySettings = {}, onNavigate }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <EmptyState title="구독 중인 전략이 없습니다" description="전략마켓에서 전략을 구독해 보세요." bordered />
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
      {items.map((item) => {
        const n = notifySettings[item.id] ?? {}
        const notifyOn = (n.all ?? true) === true
        return (
          <Card key={item.id}>
            <Card.Content className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold truncate">{item.name}</p>
                <Badge variant={item.position === 'LONG' ? 'long' : item.position === 'SHORT' ? 'short' : 'default'}>{item.position}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-slate-500">최근 성과</p>
                  <p className={cn('font-semibold tabular-nums', safeNum(item.recentPnl, 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {fmtPct(item.recentPnl, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">알림</p>
                  <p className={cn('font-semibold', notifyOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {notifyOn ? 'ON' : 'OFF'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('validation')}>검증 보기</Button>
                <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('market')}>전략 상세</Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => onNavigate?.('plans')}>구독 관리</Button>
              </div>
            </Card.Content>
          </Card>
        )
      })}
    </div>
  )
}

function MyStrategiesSection({ user, items = [], onEditStrategy, onNavigate }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <EmptyState title="등록한 전략이 없습니다" description="에디터에서 전략을 작성하고 등록해 보세요." bordered />
  }

  const canSubmit = canSubmitStrategyToMarket(user)
  const maxSlots = getMaxSubmittedStrategies(user)
  const submittedN = items.filter((s) => ['submitted', 'under_review', 'approved'].includes(s.status)).length
  const remain = Math.max(0, maxSlots - submittedN)
  const tier = getEffectiveProductTier(user)

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2 text-[11px]">
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          등록 가능 {items.length} / {planUsageLimitByTier(tier).reg} · 마켓 파이프라인 {submittedN} / {maxSlots} (남은 {remain})
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {items.map((s) => {
          const st = REVIEW_STATUS[s.status] ?? REVIEW_STATUS.draft
          const recent = rolling7dPnlPct(s.id, 'mypage')
          return (
            <Card key={s.id}>
              <Card.Content className="py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold truncate">{s.name}</p>
                  <Badge variant={st.badge}>{st.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <p className="text-slate-500">현재 가격: <span className="font-semibold text-slate-700 dark:text-slate-200">{s.price ? `${Number(s.price).toLocaleString()}원` : '—'}</span></p>
                  <p className="text-slate-500">최근 성과: <span className={cn('font-semibold tabular-nums', recent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{fmtPct(recent, 1)}</span></p>
                  <p className="text-slate-500">등록일: <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtDate(s.createdAt)}</span></p>
                  <p className="text-slate-500">마켓 노출: <span className="font-semibold text-slate-700 dark:text-slate-200">{s.status === 'approved' ? '노출 중' : '미노출'}</span></p>
                </div>
                {!canSubmit && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">{PLAN_MESSAGES.marketSubmitProOnly}</p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button variant="secondary" size="sm" type="button" onClick={() => onEditStrategy?.(s.id)}>수정하기</Button>
                  <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('validation')}>검증 보기</Button>
                </div>
              </Card.Content>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function NotificationSettingsSection({
  subscribedStrategies = [],
  globalSettings,
  onChangeGlobal,
  settingsByStrategy,
  onToggleStrategy,
  currentUser,
}) {
  const isLoggedIn = !!currentUser?.id
  const list = Array.isArray(subscribedStrategies) ? subscribedStrategies : []

  return (
    <div className="space-y-2">
      {!isLoggedIn && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/25 px-3 py-2 text-[11px] text-red-700 dark:text-red-300">
          로그인하지 않으면 알림을 받을 수 없습니다.
        </div>
      )}
      <Card>
        <Card.Content className="py-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
            {[
              ['전체 알림', 'enabled'],
              ['브라우저 알림', 'browserEnabled'],
              ['앱 내부 알림', 'inAppEnabled'],
            ].map(([label, key]) => (
              <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2">
                <span>{label}</span>
                <input type="checkbox" checked={!!globalSettings[key]} onChange={(e) => onChangeGlobal(key, e.target.checked)} />
              </label>
            ))}
          </div>
        </Card.Content>
      </Card>

      {list.length === 0 ? (
        <EmptyState title="구독 전략이 없어 알림 설정이 비어 있습니다" description="전략을 구독하면 기본값 ON으로 알림이 생성됩니다." bordered />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {list.map((s) => {
            const st = settingsByStrategy[s.id] ?? { all: true, long: true, short: true, exit: true }
            return (
              <Card key={s.id}>
                <Card.Content className="py-3">
                  <p className="text-[12px] font-semibold mb-2">{s.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {[
                      ['전체', 'all'],
                      ['LONG', 'long'],
                      ['SHORT', 'short'],
                      ['청산', 'exit'],
                    ].map(([label, key]) => (
                      <label key={key} className="flex items-center justify-between rounded-md border border-slate-200 dark:border-gray-700 px-2.5 py-1.5">
                        <span>{label}</span>
                        <input type="checkbox" checked={!!st[key]} onChange={(e) => onToggleStrategy(s.id, key, e.target.checked)} />
                      </label>
                    ))}
                  </div>
                </Card.Content>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AccountInfoSection({ currentUser, profile, authError, onLogout, onRefreshStrategies }) {
  return (
    <Card>
      <Card.Content className="py-3 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2">
            <p className="text-[10px] text-slate-500">이메일</p>
            <p className="font-semibold break-all">{currentUser?.email ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2">
            <p className="text-[10px] text-slate-500">인증 상태</p>
            <p className={cn('font-semibold', currentUser ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {currentUser ? '인증됨' : '미인증'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2">
            <p className="text-[10px] text-slate-500">가입일</p>
            <p className="font-semibold">{fmtDate(profile?.created_at || currentUser?.created_at)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-2">
            <p className="text-[10px] text-slate-500">최근 로그인</p>
            <p className="font-semibold">{fmtDate(currentUser?.last_sign_in_at)}</p>
          </div>
        </div>
        {authError && <p className="text-[11px] text-red-600">{authError}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" size="sm" type="button" onClick={() => onRefreshStrategies?.()}>프로필/전략 새로고침</Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => onLogout?.()}>로그아웃</Button>
        </div>
      </Card.Content>
    </Card>
  )
}

function SaveManageActions({ onRefreshStrategies, onNavigate, onGoPlans }) {
  return (
    <Card>
      <Card.Content className="py-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => onRefreshStrategies?.()}>상태 새로고침</Button>
          <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('editor')}>전략 작성하기</Button>
          <Button variant="primary" size="sm" type="button" onClick={() => onGoPlans?.()}>플랜 업그레이드</Button>
        </div>
      </Card.Content>
    </Card>
  )
}

const FEEDBACK_CATEGORIES = ['기능 제안', 'UX', '기타']
const INQUIRY_CATEGORIES = ['결제', '계정', '버그', '전략', '기타']

function SupportFormModal({
  mode,
  open,
  loading,
  message,
  onClose,
  onSubmit,
  onChange,
  form,
}) {
  if (!open) return null
  const isFeedback = mode === 'feedback'
  const title = isFeedback ? '피드백 보내기' : '문의 / 상담하기'
  const cats = isFeedback ? FEEDBACK_CATEGORIES : INQUIRY_CATEGORIES

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-3">
      <div className="w-full max-w-[520px] rounded-[8px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button type="button" className="text-[12px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" onClick={onClose}>닫기</button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <label className="block">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">카테고리</span>
            <select
              className="mt-1 w-full h-9 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 text-[12px]"
              value={form.category}
              onChange={(e) => onChange('category', e.target.value)}
            >
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">제목</span>
            <input
              className="mt-1 w-full h-9 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 text-[12px]"
              value={form.title}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder="제목을 입력해 주세요"
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">내용</span>
            <textarea
              className="mt-1 w-full min-h-[140px] rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-2 text-[12px]"
              value={form.content}
              onChange={(e) => onChange('content', e.target.value)}
              placeholder="상세 내용을 입력해 주세요"
              maxLength={5000}
            />
          </label>
          {message && (
            <p className={cn(
              'text-[11px]',
              message.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}
            >
              {message.text}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>취소</Button>
            <Button variant="primary" size="sm" type="button" disabled={loading} onClick={onSubmit}>
              {loading ? '제출 중...' : '제출하기'}
            </Button>
          </div>
        </div>
      </div>
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
}) {
  const navigate = useNavigate()
  const u = user ?? { plan: 'free', trialDaysLeft: 7, unlockedStrategyIds: [], strategyNotifySettings: {} }
  const myStrategies = Array.isArray(userStrategies) ? userStrategies : []
  const unlocked = Array.isArray(u.unlockedStrategyIds) ? u.unlockedStrategyIds : []

  const subscribedStrategies = useMemo(
    () => unlocked.map((id) => {
      const own = myStrategies.find((s) => s.id === id)
      const recent = rolling7dPnlPct(id, currentUser?.id ?? 'guest')
      const position = recent > 0.35 ? 'LONG' : recent < -0.35 ? 'SHORT' : '대기'
      return {
        id,
        name: own?.name ?? id,
        recentPnl: recent,
        position,
      }
    }),
    [unlocked, myStrategies, currentUser?.id],
  )

  const [globalNotify, setGlobalNotify] = useState({
    enabled: true,
    browserEnabled: true,
    inAppEnabled: true,
  })
  const [strategyNotifySettings, setStrategyNotifySettings] = useState(u?.strategyNotifySettings ?? {})
  const [supportModalMode, setSupportModalMode] = useState('feedback')
  const [supportModalOpen, setSupportModalOpen] = useState(false)
  const [supportSubmitting, setSupportSubmitting] = useState(false)
  const [supportMessage, setSupportMessage] = useState(null)
  const [supportForm, setSupportForm] = useState({
    category: FEEDBACK_CATEGORIES[0],
    title: '',
    content: '',
  })
  useEffect(() => {
    setStrategyNotifySettings(u?.strategyNotifySettings ?? {})
  }, [u?.strategyNotifySettings])

  function openSupportModal(mode) {
    const feedback = mode === 'feedback'
    setSupportModalMode(mode)
    setSupportForm({
      category: feedback ? FEEDBACK_CATEGORIES[0] : INQUIRY_CATEGORIES[0],
      title: '',
      content: '',
    })
    setSupportMessage(null)
    setSupportModalOpen(true)
  }

  const notifySummary = useMemo(() => {
    const rows = Object.values(strategyNotifySettings)
    const onN = rows.filter((r) => (r?.all ?? true) === true).length
    return `${globalNotify.enabled ? 'ON' : 'OFF'} · 전략 ${onN}개`
  }, [globalNotify.enabled, strategyNotifySettings])

  return (
    <PageShell wide>
      <PageHeader
        title="내 계정"
        action={(
          <div className="flex flex-wrap gap-2">
            {!currentUser && (
              <>
                <Button variant="primary" size="sm" type="button" onClick={() => navigate('/auth?mode=login')}>로그인</Button>
                <Button variant="secondary" size="sm" type="button" onClick={() => navigate('/auth?mode=signup')}>회원가입</Button>
              </>
            )}
          </div>
        )}
      />

      <div className="space-y-5">
        <section>
          <h2 className="text-[16px] font-semibold mb-2">프로필 / 계정 요약</h2>
          <ProfileSummaryCard
            currentUser={currentUser}
            profile={profile}
            user={u}
            subscribedCount={subscribedStrategies.length}
            myStrategiesCount={myStrategies.length}
            notifySummary={notifySummary}
          />
        </section>

        <section>
          <h2 className="text-[16px] font-semibold mb-2">현재 플랜 / 업그레이드</h2>
          <PlanStatusCard
            user={u}
            subscribedCount={subscribedStrategies.length}
            myStrategiesCount={myStrategies.length}
            onGoPlans={onGoPlans}
            onNavigate={onNavigate}
          />
          {!hasPaidPlanFeatures(u) && (
            <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{PLAN_MESSAGES.notifications}</p>
          )}
          <div className="mt-2 rounded-lg border border-slate-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[11px]">
              <thead className="bg-slate-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left px-3 py-2">기능</th>
                  <th className="text-center px-3 py-2">무료</th>
                  <th className="text-center px-3 py-2">스탠다드</th>
                  <th className="text-center px-3 py-2">프로</th>
                  <th className="text-center px-3 py-2">프리미엄</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_COMPARISON_FEATURES.slice(0, 6).map((f) => (
                  <tr key={f.key} className="border-t border-slate-100 dark:border-gray-800">
                    <td className="px-3 py-2">{f.label}</td>
                    <td className="px-3 py-2 text-center">{f.free}</td>
                    <td className="px-3 py-2 text-center">{f.starter}</td>
                    <td className="px-3 py-2 text-center">{f.pro}</td>
                    <td className="px-3 py-2 text-center">{f.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold mb-2">내 구독 전략</h2>
          <SubscribedStrategiesSection items={subscribedStrategies} notifySettings={strategyNotifySettings} onNavigate={onNavigate} />
        </section>

        <section>
          <h2 className="text-[16px] font-semibold mb-2">내 등록 전략</h2>
          <MyStrategiesSection user={u} items={myStrategies} onEditStrategy={onEditStrategy} onNavigate={onNavigate} />
        </section>

        <section>
          <h2 className="text-[16px] font-semibold mb-2">알림 설정</h2>
          <NotificationSettingsSection
            subscribedStrategies={subscribedStrategies}
            globalSettings={globalNotify}
            onChangeGlobal={(key, value) => setGlobalNotify((p) => ({ ...p, [key]: value }))}
            settingsByStrategy={strategyNotifySettings}
            onToggleStrategy={(strategyId, key, value) => {
              setStrategyNotifySettings((prev) => ({
                ...prev,
                [strategyId]: {
                  all: true,
                  long: true,
                  short: true,
                  exit: true,
                  ...(prev[strategyId] ?? {}),
                  [key]: value,
                },
              }))
            }}
            currentUser={currentUser}
          />
        </section>

        <section>
          <h2 className="text-[16px] font-semibold mb-2">거래소 API 연결</h2>
          <ExchangeConnectionForm />
        </section>

        <section>
          <h2 className="text-[16px] font-semibold mb-2">계정 / 인증 정보</h2>
          <AccountInfoSection
            currentUser={currentUser}
            profile={profile}
            authError={authError}
            onLogout={onLogout}
            onRefreshStrategies={onRefreshStrategies}
          />
        </section>

        <section>
          <h2 className="text-[16px] font-semibold mb-2">저장 / 관리 액션</h2>
          <SaveManageActions onRefreshStrategies={onRefreshStrategies} onNavigate={onNavigate} onGoPlans={onGoPlans} />
          <div className="mt-2 rounded-[8px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3">
            <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 mb-2">피드백 / 문의</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => openSupportModal('feedback')}>피드백 보내기</Button>
              <Button variant="primary" size="sm" type="button" onClick={() => openSupportModal('inquiry')}>문의 / 상담하기</Button>
            </div>
          </div>
        </section>
      </div>

      <SupportFormModal
        mode={supportModalMode}
        open={supportModalOpen}
        loading={supportSubmitting}
        message={supportMessage}
        onClose={() => setSupportModalOpen(false)}
        onChange={(key, value) => setSupportForm((prev) => ({ ...prev, [key]: value }))}
        form={supportForm}
        onSubmit={async () => {
          const title = String(supportForm.title ?? '').trim()
          const content = String(supportForm.content ?? '').trim()
          if (!title || !content) {
            setSupportMessage({ type: 'err', text: '제목과 내용을 입력해 주세요.' })
            return
          }
          if (!currentUser?.id) {
            setSupportMessage({ type: 'err', text: '로그인 후 제출할 수 있습니다.' })
            return
          }
          try {
            setSupportSubmitting(true)
            setSupportMessage(null)
            await createSupportMessage({
              userId: currentUser.id,
              formType: supportModalMode,
              category: supportForm.category,
              title,
              content,
            })
            setSupportMessage({ type: 'ok', text: '정상 접수되었습니다. 빠르게 확인 후 답변드릴게요.' })
            setSupportForm((prev) => ({ ...prev, title: '', content: '' }))
          } catch (e) {
            if (e instanceof SupportInboxError) {
              setSupportMessage({ type: 'err', text: e.message })
            } else {
              setSupportMessage({ type: 'err', text: '접수 중 오류가 발생했습니다.' })
            }
          } finally {
            setSupportSubmitting(false)
          }
        }}
      />
    </PageShell>
  )
}

import { useMemo } from 'react'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import PlanCard from '../components/plan/PlanCard'
import Button from '../components/ui/Button'
import { getPlanCatalog } from '../lib/planCatalog'
import { createCheckoutIntent } from '../lib/checkoutIntent'

export default function PlansPage({
  user,
  currentUser,
  supaReady,
  onNavigate,
  onStartTrial,
  onSubscribe,
  subscriptionActionLoading = false,
  subscriptionFeedback = { ok: '', err: '' },
  onGoAuth,
}) {
  const plans = useMemo(() => getPlanCatalog(), [])
  const loggedIn = !!currentUser?.id && supaReady

  function isPlanCtaDisabled(p) {
    if (!p.billingTier) return false
    if (subscriptionActionLoading) return true
    if (user?.plan !== 'subscribed') return false
    const bt = user?.billingTier === 'premium' ? 'premium' : 'pro'
    if (p.billingTier === 'premium' && bt === 'pro') return false
    return true
  }

  function logIntentCheckout(billingTier) {
    if (!currentUser?.id) return
    try {
      const intent = createCheckoutIntent({ userId: currentUser.id, billingTier })
      // eslint-disable-next-line no-console
      console.info('[checkout] intent (결제 연동 전)', intent)
    } catch {
      /* ignore */
    }
  }

  return (
    <PageShell wide className="min-w-0 pb-10">
      <PageHeader
        title="요금제 안내"
        description="무료로 판단·탐색은 충분히 하고, 깊게 쓰실 때 구독으로 이어가실 수 있어요. 실제 결제 연동 전에는 아래 선택으로 서비스 내 권한만 활성화됩니다."
      />

      {(subscriptionFeedback?.ok || subscriptionFeedback?.err) && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-[13px] ${
            subscriptionFeedback.err
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100'
          }`}
        >
          {subscriptionFeedback.err || subscriptionFeedback.ok}
        </div>
      )}

      {!supaReady && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Supabase가 설정되지 않았습니다. 로컬에서는 요금제 화면만 확인할 수 있어요.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            title={p.title}
            subtitle={p.subtitle}
            priceLabel={p.priceLabel}
            periodLabel={p.periodLabel}
            features={p.features}
            recommended={p.recommended}
            ctaLabel={p.ctaLabel}
            ctaDisabled={isPlanCtaDisabled(p)}
            ctaLoading={subscriptionActionLoading}
            onCta={() => {
              if (p.isFree) {
                onNavigate?.('home')
                return
              }
              if (!loggedIn) {
                onGoAuth?.()
                return
              }
              logIntentCheckout(p.billingTier)
              onSubscribe?.(p.billingTier)
            }}
          />
        ))}
      </div>

      <div className="mt-8 rounded-[10px] border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">7일 무료 체험</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
          유료 결제 없이 Pro에 가까운 열람·시그널 범위를 먼저 경험해 볼 수 있어요. 이후에도 무료 플랜으로 계속 이용할 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="md"
            type="button"
            disabled={!loggedIn || subscriptionActionLoading || user?.plan === 'trial'}
            loading={subscriptionActionLoading}
            onClick={() => onStartTrial?.()}
          >
            {user?.plan === 'trial' ? '체험 중' : '무료 체험 시작'}
          </Button>
          {!loggedIn && (
            <Button variant="primary" size="md" type="button" onClick={() => onGoAuth?.()}>
              로그인하고 체험하기
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  )
}

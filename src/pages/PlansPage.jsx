import { useMemo } from 'react'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import PlanCard from '../components/plan/PlanCard'
import Button from '../components/ui/Button'
import { getPlanCatalog } from '../lib/planCatalog'
import { createCheckoutIntent } from '../lib/checkoutIntent'
import {
  STRATEGY_MONTHLY_PRICE_KRW,
  FIRST_MONTH_PROMO_PRICE_KRW,
  CHECKOUT_HINT,
} from '../lib/conversionUx'

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
    const currentPlan = String(user?.plan ?? 'free').toLowerCase()
    const bt =
      currentPlan === 'premium'
        ? 'premium'
        : (currentPlan === 'pro' || currentPlan === 'subscribed' ? 'pro' : 'free')
    if (currentPlan === 'free' || currentPlan === 'standard') return false
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
        description={CHECKOUT_HINT}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2.5 dark:border-orange-900/50 dark:from-orange-950/40 dark:to-amber-950/30">
        <span className="text-lg" aria-hidden>🔥</span>
        <p className="text-[13px] font-semibold text-orange-900 dark:text-orange-100">
          첫 구독 할인 적용 중 · 첫 달 ₩{FIRST_MONTH_PROMO_PRICE_KRW.toLocaleString()} (정가 월 ₩{STRATEGY_MONTHLY_PRICE_KRW.toLocaleString()} 참고)
        </p>
      </div>

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
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">결제 반영 상태</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
          결제 완료 후에는 서버 웹훅이 `user_plans.plan`을 갱신합니다. 프론트는 플랜을 직접 변경하지 않고 이 상태를 다시 조회해 반영합니다.
        </p>
        <p className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[12px] leading-relaxed text-slate-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-slate-400">
          본 플랫폼은 투자 자문을 제공하지 않으며,
          <br />
          모든 투자 판단과 책임은 사용자 본인에게 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="md"
            type="button"
            disabled={!loggedIn || subscriptionActionLoading}
            loading={subscriptionActionLoading}
            onClick={() => onStartTrial?.()}
          >
            플랜 상태 새로고침
          </Button>
          {!loggedIn && (
            <Button variant="primary" size="md" type="button" onClick={() => onGoAuth?.()}>
              로그인하고 플랜 확인
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  )
}

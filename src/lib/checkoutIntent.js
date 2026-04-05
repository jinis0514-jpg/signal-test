/**
 * 결제 연동 전 단계 — Stripe Checkout / 국내 PG 세션 생성 시 이 객체를 확장해 사용.
 * (웹훅에서 user_id + billingTier 로 subscriptions / billing 메타 반영)
 *
 * @param {{ userId: string, billingTier: 'pro'|'premium', priceId?: string|null }} p
 */
export function createCheckoutIntent(p) {
  return {
    kind: 'subscription',
    userId: p.userId,
    billingTier: p.billingTier,
    priceId: p.priceId ?? null,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
}

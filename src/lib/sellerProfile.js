/**
 * 판매자(크리에이터) 등급 · 수익화 확장용 스텁
 *
 * 향후 Supabase 예시:
 * - profiles / seller_profiles: seller_status, market_strategy_count, approved_strategy_count
 * - strategies (또는 별도 테이블):
 *   - price_tier: 'free' | 'standard' | 'premium' (향후 유료 구독 분기)
 *   - revenue_share_bps: 플랫폼 수수료 대비 판매자 몫 (basis points)
 *   - subscriber_count: 이 전략을 구독한 수 (캐시)
 *   - payout_status: 'none' | 'pending' | 'paid' (정산 파이프라인)
 *
 * 현재는 전략 단위 검수·Pro 제출 한도만 사용하며, 위 필드 없이 동작합니다.
 */

/** @typedef {'none'|'pending'|'verified'} SellerStatusStub */

export function getSellerTierPlaceholder() {
  return {
    seller_status: /** @type {SellerStatusStub} */ ('none'),
    note: '프로필 기반 판매자 등급·정산은 추후 연동 예정입니다.',
  }
}

/** UI/스키마 설계용 — 아직 DB 컬럼 없음 */
export const STRATEGY_MONETIZATION_FIELDS = [
  'price_tier',
  'revenue_share_bps',
  'subscriber_count',
  'payout_status',
]

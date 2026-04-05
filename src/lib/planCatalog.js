import { PLAN_PRICE_KRW } from './userPlan'

/**
 * 요금제 카드 UI용 카탈로그 (표시 가격·문구 — 실제 결제는 Stripe/PG 연동 시 동기화)
 * billingTier: 구독 활성화 시 user.billingTier 에 반영 (pro | premium)
 */
export function getPlanCatalog() {
  return [
    {
      id: 'free',
      title: '무료',
      subtitle: '시작하기',
      priceLabel: '₩0',
      periodLabel: '· 계속 무료',
      recommended: false,
      features: [
        '기본 전략·마켓 일부 열람',
        '시그널 일부 미리보기',
        '전략 1~2개까지 동시 관찰',
        '전략 저장 1개',
      ],
      ctaLabel: '무료로 둘러보기',
      billingTier: null,
      isFree: true,
    },
    {
      id: 'basic',
      title: '기본 구독',
      subtitle: 'Pro',
      priceLabel: `₩${PLAN_PRICE_KRW.pro.toLocaleString('ko-KR')}`,
      periodLabel: '/월',
      recommended: true,
      features: [
        '멀티 전략 동시 관찰 확대',
        '상세 검증·백테스트 지표',
        'PDF·진입 근거 전체 열람',
        '마켓 전략 넓은 접근',
      ],
      ctaLabel: '이 플랜으로 보기',
      billingTier: 'pro',
      isFree: false,
    },
    {
      id: 'premium',
      title: '상위 구독',
      subtitle: 'Premium',
      priceLabel: `₩${PLAN_PRICE_KRW.premium.toLocaleString('ko-KR')}`,
      periodLabel: '/월',
      recommended: false,
      features: [
        'Pro 혜택 포함',
        '프리미엄 전략·카탈로그 전체',
        '동시 관찰·제출 상한 더 넓게',
        '판매 수수료 우대',
      ],
      ctaLabel: '구독 시작하기',
      billingTier: 'premium',
      isFree: false,
    },
  ]
}

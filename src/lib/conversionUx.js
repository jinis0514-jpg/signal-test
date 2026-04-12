/**
 * 출시 전 전환·결제 UX 공통 카피 (기능 로직과 분리)
 */

/** 전략 1건 월 구독 표시가 (원) — UI 안내용 */
export const STRATEGY_MONTHLY_PRICE_KRW = 29_000

/** 첫 구독 프로모 표시가 (원) */
export const FIRST_MONTH_PROMO_PRICE_KRW = 9_900

/** 첫 체험 일수 (표시용) */
export const FIRST_TRIAL_DAYS_DISPLAY = 3

export const SUBSCRIBE_STICKY = {
  title: '이 전략의 실시간 시그널을 받아보세요',
  priceLabel: (n) => `월 ₩${Number(n).toLocaleString()}`,
  promoBanner: '첫 구독 할인 적용 중',
  promoDetail: `첫 ${FIRST_TRIAL_DAYS_DISPLAY}일 무료 체험 또는 첫 달 ₩${FIRST_MONTH_PROMO_PRICE_KRW.toLocaleString()} · 이후 월 ₩${STRATEGY_MONTHLY_PRICE_KRW.toLocaleString()}`,
  cta: '지금 구독하기',
  cancelHint: '언제든지 취소 가능',
  trust: {
    realTrade: '실거래 인증',
    backtest: '백테스트 장기 표본',
    liveVerify: '실시간 검증·라이브 추적',
  },
  hoverSubscribeHint: '구독하면 실시간 신호 확인 가능',
  realtimeBadge: '실시간 시그널 제공',
}

export const FREE_VS_PAID = {
  freeTitle: '무료로 볼 수 있음',
  freeItems: [
    '일부 요약 지표·과거 시그널 샘플',
    '전략 카드·시장 요약 탐색',
  ],
  paidTitle: '구독 시 전체 이용',
  paidItems: [
    '🔒 실시간 LONG / SHORT / EXIT 시그널',
    '🔒 전체 시그널 기록·타임라인',
    '🔒 검증·상세 분석 탭 전체',
  ],
  lockedBanner: '🔒 실시간 시그널·전체 기록은 구독 후 이용할 수 있습니다',
}

export const CHECKOUT_HINT =
  '한 번의 선택으로 플랜이 열립니다. 별도 복잡한 단계 없이 결제 후 바로 이용할 수 있어요.'

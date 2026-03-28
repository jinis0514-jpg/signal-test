/**
 * 전략마켓 / 홈 전체에서 공통으로 참조하는 상태 매핑
 * 카드·표·모달에서 동일한 문구/배지 변형을 유지하기 위해 여기서 중앙 관리
 */

/** ctaStatus → 버튼 레이블 + 변형 */
export const CTA_CONFIG = {
  not_started: { label: '7일 무료 체험하기',      variant: 'primary'   },
  active:      { label: '이 전략 계속 사용하기',   variant: 'secondary' },
  expired:     { label: '실시간 시그널 받기',      variant: 'primary'   },
  subscribed:  { label: '사용 중',                variant: 'ghost'     },
}

/** recommendBadge → Badge 변형 */
export const RECOMMEND_CONFIG = {
  BEST:  { label: 'BEST',  variant: 'info'    },
  GOOD:  { label: 'GOOD',  variant: 'success' },
  RISKY: { label: 'RISKY', variant: 'warning' },
}

/** strategy.status → Badge 레이블 + 변형 */
export const STRATEGY_STATUS_CONFIG = {
  recommended: { label: '추천', variant: 'info'    },
  popular:     { label: '인기', variant: 'default' },
  new:         { label: '신규', variant: 'success' },
}

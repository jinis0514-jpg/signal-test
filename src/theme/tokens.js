/**
 * Quant Terminal — 제품 디자인 토큰 (JS에서 참조)
 * 색 역할: 파랑=행동·선택, 초록=수익·긍정, 빨강=손실·위험, 그레이=보조
 */
export const theme = {
  colors: {
    bg: '#ffffff',
    bgMuted: '#f8fafc',
    border: '#e5e7eb',
    text: '#111827',
    subText: '#6b7280',

    primary: '#2962ff',
    primaryHover: '#1e56e6',

    positive: '#16c784',
    danger: '#ea3943',
    neutral: '#9ca3af',
  },

  radius: {
    card: '8px',
    button: '8px',
    badge: '999px',
    input: '8px',
  },

  spacing: {
    pageX: '24px',
    pageY: '24px',
    sectionGap: '28px',
    cardGap: '16px',
    cardPadding: '16px',
  },
}

/** Tailwind 클래스 문자열 — 컴포넌트·페이지에서 공통 사용 */
export const ds = {
  /** 수익·상승·양수 PnL */
  pnlUp: 'text-emerald-600 dark:text-emerald-400',
  /** 손실·하락·음수 PnL */
  pnlDown: 'text-red-600 dark:text-red-400',
  /** MDD·위험 수치 강조 */
  risk: 'text-red-600 dark:text-red-400',
  /** 링크·보조 강조 (본문 내 액션) */
  link: 'text-blue-600 dark:text-blue-400',
  /** Primary 버튼용 (배경은 Button 컴포넌트) */
  borderDefault: 'border-slate-200 dark:border-gray-700',
  cardSurface: 'bg-white dark:bg-gray-900',
}

/**
 * 플랫폼 운영자 전략 (DB에 없어도 마켓·홈·시뮬에 노출)
 * — simulationMockData STRATEGIES id와 매핑 가능하도록 simId 연결
 */

export const OPERATOR_STRATEGY_SIM_IDS = {
  'op-btc-trend-core': 'btc-trend',
  'op-eth-range-core': 'eth-range',
  'op-sol-momentum-core': 'sol-momentum',
}

const BASE = {
  /** 마켓 노출은 approved|published 정책과 동일하게 취급 */
  status: 'approved',
  strategy_type: 'trend',
  isOperator: true,
  author: 'BB 운영팀',
  typeLabel: '운영 전략',
  ctaStatus: 'not_started',
  recommendBadge: 'BEST',
  fitSummary: '플랫폼 큐레이션 · 실제 시세·엔진 연동',
  performance: {
    totalReturnPct: 18.4,
    winRate: 56,
    tradeCount: 42,
    maxDrawdown: 11.2,
  },
  /** 랭킹·최근 성과 섹션용 (엔진 거래 없을 때) */
  roi7d: 2.1,
  roi30d: 5.8,
  recentSignals: [{ dir: 'LONG', time: '—' }],
  updated_at: new Date().toISOString(),
}

export const OPERATOR_STRATEGIES_RAW = [
  {
    ...BASE,
    id: 'op-btc-trend-core',
    name: 'BTC Trend Core (운영)',
    description:
      'BTC USDT 기준 EMA 정렬·RSI 필터 추세 추종. 횡보 구간에서는 신호 빈도가 줄 수 있어 리스크 비율을 낮추는 운영 가이드를 따릅니다.',
    asset: 'btc',
    timeframe: '1h',
    type: 'trend',
    performance: {
      totalReturnPct: 21.2,
      winRate: 58,
      tradeCount: 48,
      maxDrawdown: 10.1,
      monthly_price_krw: 14900,
    },
    roi7d: 3.2,
    roi30d: 7.1,
    recentSignals: [{ dir: 'LONG', time: '—' }],
  },
  {
    ...BASE,
    id: 'op-eth-range-core',
    name: 'ETH Range Mean Revert (운영)',
    description:
      'ETH 단기 밴드 터치·평균회귀 성격. 변동성 확대 시 손절 거리를 넓히는 대신 포지션 크기를 줄이는 운영 원칙입니다.',
    asset: 'eth',
    timeframe: '1h',
    strategy_type: 'volatility',
    type: 'volatility',
    performance: {
      totalReturnPct: 14.6,
      winRate: 61,
      tradeCount: 55,
      maxDrawdown: 8.4,
      monthly_price_krw: 9900,
    },
    roi7d: 1.4,
    roi30d: 4.2,
    recentSignals: [{ dir: 'SHORT', time: '—' }],
  },
  {
    ...BASE,
    id: 'op-sol-momentum-core',
    name: 'SOL Momentum Pulse (운영)',
    description:
      'SOL 모멘텀·MACD 시그널 기반. 고베타 자산 특성상 MDD가 클 수 있어 소액·분할 진입을 권장합니다.',
    asset: 'sol',
    timeframe: '4h',
    strategy_type: 'momentum',
    type: 'momentum',
    performance: {
      totalReturnPct: 26.8,
      winRate: 52,
      tradeCount: 31,
      maxDrawdown: 16.3,
      monthly_price_krw: 29900,
    },
    roi7d: -0.8,
    roi30d: 6.5,
    recentSignals: [{ dir: 'LONG', time: '—' }],
  },
]

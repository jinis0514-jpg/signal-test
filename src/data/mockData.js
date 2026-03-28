// ─────────────────────────────────────────
// 시장 상태
// ─────────────────────────────────────────
export const MARKET_STATE = {
  current: 'ranging', // 'bull' | 'bear' | 'ranging'
  btcPrice: 84312.5,
  btcChange24h: -1.42,
  dominance: 58.3,
  fearGreed: 42,
  label: '횡보장',
  desc: 'BTC 변동성 수축, 박스권 형성 중',
}

// ─────────────────────────────────────────
// 전략 목록 (12개)
// ─────────────────────────────────────────
export const STRATEGIES = [
  {
    id: 's1',
    name: 'BTC Trend Rider',
    author: 'AlphaLab',
    type: 'trend',
    typeLabel: '추세 추종',
    desc: '추세장 전용 중기 스윙 전략. EMA 크로스 + 모멘텀 필터로 진입 신호를 생성합니다.',
    roi: 42.3,
    winRate: 63.2,
    mdd: -12.4,
    trades: 148,
    avgHolding: '2.3일',
    signals: 18,
    price: 29000,
    status: 'recommended',
    statusLabel: '추천',
    difficulty: 'intermediate',
    createdAt: '2024-10',
    tags: ['BTC', 'EMA', '스윙'],
  },
  {
    id: 's2',
    name: 'Range Scalper X',
    author: 'QuantBros',
    type: 'range',
    typeLabel: '횡보 스캘핑',
    desc: '횡보장에서 RSI 과매수/과매도 구간을 이용한 단기 진입 전략.',
    roi: 28.7,
    winRate: 68.5,
    mdd: -6.2,
    trades: 312,
    avgHolding: '4.2시간',
    signals: 34,
    price: 19000,
    status: 'popular',
    statusLabel: '인기',
    difficulty: 'beginner',
    createdAt: '2024-08',
    tags: ['RSI', '단기', '횡보'],
  },
  {
    id: 's3',
    name: 'Volatility Breakout Pro',
    author: 'SigmaFund',
    type: 'breakout',
    typeLabel: '변동성 돌파',
    desc: '볼린저 밴드 수축 이후 변동성 확대 구간을 포착하는 돌파 전략.',
    roi: 57.8,
    winRate: 51.3,
    mdd: -19.7,
    trades: 89,
    avgHolding: '1.1일',
    signals: 9,
    price: 49000,
    status: 'new',
    statusLabel: '신규',
    difficulty: 'advanced',
    createdAt: '2025-01',
    tags: ['볼린저', '변동성', '돌파'],
  },
  {
    id: 's4',
    name: 'ETH Mean Reversion',
    author: 'AlphaLab',
    type: 'mean_reversion',
    typeLabel: '평균회귀',
    desc: 'ETH 과도한 편차 발생 시 평균으로의 회귀를 이용하는 전략.',
    roi: 33.1,
    winRate: 71.0,
    mdd: -8.3,
    trades: 204,
    avgHolding: '6.5시간',
    signals: 22,
    price: 24000,
    status: 'recommended',
    statusLabel: '추천',
    difficulty: 'intermediate',
    createdAt: '2024-11',
    tags: ['ETH', '평균회귀', '단기'],
  },
  {
    id: 's5',
    name: 'Multi-TF Momentum',
    author: 'ProfitEdge',
    type: 'trend',
    typeLabel: '추세 추종',
    desc: '다중 타임프레임 모멘텀 일치 시 진입하는 고확률 스윙 전략.',
    roi: 38.9,
    winRate: 60.1,
    mdd: -14.1,
    trades: 76,
    avgHolding: '3.8일',
    signals: 7,
    price: 39000,
    status: 'popular',
    statusLabel: '인기',
    difficulty: 'advanced',
    createdAt: '2024-09',
    tags: ['모멘텀', 'MTF', '스윙'],
  },
  {
    id: 's6',
    name: 'Safe Harbor',
    author: 'RiskFirst',
    type: 'range',
    typeLabel: '저리스크',
    desc: '낮은 변동성, 높은 승률을 우선으로 설계된 보수적 전략.',
    roi: 18.4,
    winRate: 74.2,
    mdd: -4.5,
    trades: 187,
    avgHolding: '5.1시간',
    signals: 19,
    price: 15000,
    status: 'recommended',
    statusLabel: '추천',
    difficulty: 'beginner',
    createdAt: '2024-07',
    tags: ['저리스크', '안정형', '횡보'],
  },
  {
    id: 's7',
    name: 'Grid Arbitrage V2',
    author: 'GridMaster',
    type: 'grid',
    typeLabel: '그리드',
    desc: '가격 레인지 내 그리드 배치를 통해 반복 수익을 추구하는 전략.',
    roi: 24.6,
    winRate: 78.9,
    mdd: -9.8,
    trades: 534,
    avgHolding: '2.1시간',
    signals: 58,
    price: 35000,
    status: 'popular',
    statusLabel: '인기',
    difficulty: 'intermediate',
    createdAt: '2024-12',
    tags: ['그리드', 'BTC', '자동화'],
  },
  {
    id: 's8',
    name: 'Funding Rate Hunter',
    author: 'FundingPro',
    type: 'arbitrage',
    typeLabel: '펀딩 차익',
    desc: '펀딩비 극단 구간에서 반전을 노리는 파생상품 특화 전략.',
    roi: 22.3,
    winRate: 66.7,
    mdd: -7.1,
    trades: 143,
    avgHolding: '8.2시간',
    signals: 14,
    price: 28000,
    status: 'new',
    statusLabel: '신규',
    difficulty: 'advanced',
    createdAt: '2025-02',
    tags: ['펀딩비', '파생', '역추세'],
  },
  {
    id: 's9',
    name: 'AI Signal Beta',
    author: 'NeuralQuant',
    type: 'ai',
    typeLabel: 'AI 기반',
    desc: '머신러닝 패턴 인식 기반의 실험적 신호 생성 전략. 베타 운영 중.',
    roi: 61.2,
    winRate: 55.8,
    mdd: -23.4,
    trades: 62,
    avgHolding: '4.7일',
    signals: 6,
    price: 79000,
    status: 'new',
    statusLabel: '신규',
    difficulty: 'advanced',
    createdAt: '2025-03',
    tags: ['AI', '실험적', 'ML'],
  },
  {
    id: 's10',
    name: 'Weekend Effect',
    author: 'CalendarQuant',
    type: 'seasonal',
    typeLabel: '계절성',
    desc: '주말 유동성 저하 패턴을 이용한 캘린더 효과 전략.',
    roi: 19.8,
    winRate: 69.3,
    mdd: -5.9,
    trades: 108,
    avgHolding: '1.8일',
    signals: 11,
    price: 18000,
    status: 'popular',
    statusLabel: '인기',
    difficulty: 'beginner',
    createdAt: '2024-06',
    tags: ['주말', '계절성', '저빈도'],
  },
  {
    id: 's11',
    name: 'Altcoin Rotation',
    author: 'RotationLab',
    type: 'trend',
    typeLabel: '로테이션',
    desc: '시가총액 상위 알트코인 간 상대 강도를 비교하여 강한 종목에 집중 투자.',
    roi: 48.5,
    winRate: 57.4,
    mdd: -17.2,
    trades: 93,
    avgHolding: '5.6일',
    signals: 8,
    price: 45000,
    status: 'recommended',
    statusLabel: '추천',
    difficulty: 'intermediate',
    createdAt: '2024-10',
    tags: ['알트코인', '로테이션', '중기'],
  },
  {
    id: 's12',
    name: 'OBV Divergence',
    author: 'VolumeEdge',
    type: 'divergence',
    typeLabel: '다이버전스',
    desc: 'OBV 다이버전스를 주요 신호로 사용하는 중기 전략. 추세 전환 포착에 특화.',
    roi: 35.6,
    winRate: 62.0,
    mdd: -11.3,
    trades: 127,
    avgHolding: '3.2일',
    signals: 12,
    price: 32000,
    status: 'popular',
    statusLabel: '인기',
    difficulty: 'intermediate',
    createdAt: '2024-11',
    tags: ['OBV', '다이버전스', '전환'],
  },
]

// ─────────────────────────────────────────
// 백테스트 결과 (검증 페이지용)
// ─────────────────────────────────────────
export const BACKTEST_TRADES = [
  { id: 1, signal: 'LONG',  entryTime: '2025-01-05 09:00', exitTime: '2025-01-07 14:00', pnlPct: 4.21,  fee: 0.08, finalPnl: 4.13  },
  { id: 2, signal: 'SHORT', entryTime: '2025-01-10 15:30', exitTime: '2025-01-11 09:00', pnlPct: -1.34, fee: 0.08, finalPnl: -1.42 },
  { id: 3, signal: 'LONG',  entryTime: '2025-01-15 08:00', exitTime: '2025-01-18 11:00', pnlPct: 7.88,  fee: 0.08, finalPnl: 7.80  },
  { id: 4, signal: 'SHORT', entryTime: '2025-01-22 16:00', exitTime: '2025-01-23 08:30', pnlPct: 2.14,  fee: 0.08, finalPnl: 2.06  },
  { id: 5, signal: 'LONG',  entryTime: '2025-01-28 10:00', exitTime: '2025-02-01 13:00', pnlPct: -2.77, fee: 0.08, finalPnl: -2.85 },
  { id: 6, signal: 'LONG',  entryTime: '2025-02-05 09:30', exitTime: '2025-02-08 14:30', pnlPct: 6.43,  fee: 0.08, finalPnl: 6.35  },
  { id: 7, signal: 'SHORT', entryTime: '2025-02-12 15:00', exitTime: '2025-02-13 09:00', pnlPct: 1.92,  fee: 0.08, finalPnl: 1.84  },
  { id: 8, signal: 'LONG',  entryTime: '2025-02-18 08:30', exitTime: '2025-02-22 10:00', pnlPct: -0.88, fee: 0.08, finalPnl: -0.96 },
]

// ─────────────────────────────────────────
// 최근 신호 (모의투자 페이지용)
// ─────────────────────────────────────────
export const RECENT_SIGNALS = [
  { dir: 'LONG',  price: 83420.0, time: '03/25 14:22', result: '+2.3%' },
  { dir: 'EXIT',  price: 85342.5, time: '03/25 09:14', result: '+2.3%' },
  { dir: 'SHORT', price: 84110.0, time: '03/24 21:08', result: '-1.1%' },
  { dir: 'EXIT',  price: 85042.0, time: '03/24 14:33', result: '-1.1%' },
  { dir: 'LONG',  price: 82880.0, time: '03/23 11:00', result: '+5.2%' },
]

// ─────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────
export function getStrategyById(id) {
  return STRATEGIES.find((s) => s.id === id) || null
}

export function getRecommended(marketState = MARKET_STATE.current) {
  const scoreMap = {
    bull:    { trend: 3, breakout: 2, momentum: 2 },
    bear:    { range: 3, mean_reversion: 2, arbitrage: 2 },
    ranging: { range: 3, grid: 3, mean_reversion: 2, seasonal: 1 },
  }
  const scores = scoreMap[marketState] || {}
  return [...STRATEGIES]
    .map((s) => ({ ...s, score: (scores[s.type] || 0) + s.winRate / 20 + s.roi / 30 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

// ─────────────────────────────────────────
// 홈 대시보드 전용 데이터
// ─────────────────────────────────────────

export const HOME_KPIS = [
  { label: '현재 시장 상태', value: '횡보장', sub: 'BTC 박스권 · 변동성 수축 중',  trend: null },
  { label: '오늘 추천 전략', value: '4',      sub: '전일 대비 +1개',               trend: 'up' },
  { label: '운영 중 전략',   value: '2',      sub: '체험 1건 · 구독 1건',          trend: null },
  { label: '활성 시그널',    value: '7',      sub: '최근 24시간 기준',             trend: 'up' },
]

// ctaStatus: 'not_started' | 'active' | 'expired' | 'subscribed'
// recommendBadge: 'BEST' | 'GOOD' | 'RISKY'
export const HOME_RECOMMENDATIONS = [
  {
    strategyId:      's2',
    recommendBadge:  'BEST',
    recommendReason: '횡보장 대응력이 좋아 현재 구간에 가장 적합',
    ctaStatus:       'active',
    fitSummary:      '현재 시장 적합도 높음',
  },
  {
    strategyId:      's6',
    recommendBadge:  'BEST',
    recommendReason: '낮은 MDD로 박스권 구간 손실 최소화에 유리',
    ctaStatus:       'subscribed',
    fitSummary:      '안정성 우선 포트폴리오에 적합',
  },
  {
    strategyId:      's4',
    recommendBadge:  'GOOD',
    recommendReason: 'ETH 평균 이탈 구간 — 평균회귀 진입 조건 충족',
    ctaStatus:       'not_started',
    fitSummary:      '중간 리스크 · 높은 승률',
  },
  {
    strategyId:      's7',
    recommendBadge:  'GOOD',
    recommendReason: '박스권에서 그리드 전략의 반복 수익 창출 가능',
    ctaStatus:       'expired',
    fitSummary:      '자동화 전략 · 개입 최소',
  },
]

// userStatus: 'none' | 'trial' | 'subscribed'
// fitLevel:   '높음' | '보통' | '낮음'
export const HOME_STRATEGY_LIST = [
  { strategyId: 's1', userStatus: 'none',       fitLevel: '낮음' },
  { strategyId: 's2', userStatus: 'trial',      fitLevel: '높음' },
  { strategyId: 's3', userStatus: 'none',       fitLevel: '보통' },
  { strategyId: 's4', userStatus: 'none',       fitLevel: '높음' },
  { strategyId: 's6', userStatus: 'subscribed', fitLevel: '높음' },
  { strategyId: 's7', userStatus: 'none',       fitLevel: '높음' },
]

/** 이번주 수익률 TOP 전략 */
export const HOME_TOP_STRATEGIES = [
  { strategyId: 's9',  roi7d:  8.1, roi30d: 22.1, rankLabel: '#1' },
  { strategyId: 's11', roi7d:  3.8, roi30d: 14.2, rankLabel: '#2' },
  { strategyId: 's1',  roi7d:  3.2, roi30d: 12.8, rankLabel: '#3' },
  { strategyId: 's4',  roi7d:  2.7, roi30d:  9.1, rankLabel: '#4' },
  { strategyId: 's10', roi7d:  2.1, roi30d:  7.4, rankLabel: '#5' },
]

/** 시장 코멘트 */
export const MARKET_COMMENT = {
  summary: 'BTC $84K 박스권 횡보 지속. 변동성 수축 후 돌파/이탈 대기 중.',
  points: [
    '주요 저항선 $85,000 부근 매도 압력 지속',
    '공포탐욕지수 42 → 중립 구간, 방향성 약화',
    '횡보 스캘핑 · 그리드 전략 현재 환경에서 유리',
  ],
  updatedAt: '2026.03.26 14:00',
}

// badge: Badge variant key
export const HOME_ACTIVITY = [
  { id: 'a1', strategyName: 'BTC Trend Rider',         desc: '진입 신호 발생',       badge: 'info',    time: '14:22'      },
  { id: 'a2', strategyName: 'ETH Mean Reversion',      desc: '대기 상태 전환',       badge: 'default', time: '11:08'      },
  { id: 'a3', strategyName: 'Volatility Breakout Pro', desc: '수익 실현 +3.4%',     badge: 'success', time: '09:35'      },
  { id: 'a4', strategyName: 'Range Scalper X',         desc: '청산 신호 발생',       badge: 'warning', time: '어제 22:14' },
  { id: 'a5', strategyName: 'Safe Harbor',             desc: '신호 없음 상태 유지',  badge: 'default', time: '어제 18:00' },
  { id: 'a6', strategyName: 'Grid Arbitrage V2',       desc: '무료 체험 시작',       badge: 'info',    time: '어제 09:12' },
]

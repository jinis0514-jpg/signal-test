/* ── 전략 목록 ─────────────────────────────── */
export const STRATEGIES = [
  {
    id:             'btc-trend',
    name:           'BTC Trend Rider',
    symbol:         'BTCUSDT',
    timeframe:      '4H',
    type:           '추세 추종',
    description:    'EMA 20/50 크로스와 RSI 필터 조합. 추세 확인 후 진입, 역추세 전환 시 청산.',
    roi:            42.3,
    winRate:        63.2,
    mdd:            12.4,
    totalTrades:    148,
    currentPrice:   84312,
    priceChangePct: 1.24,
    runningStatus:  'running',          // running | waiting | stopped
    status:         'active',           // not_started | active | expired | subscribed
    trialDaysLeft:  12,
    recentTrades: [
      { dir: 'LONG',  entry: 79200, exit: 84590, pnl:  6.8, win: true  },
      { dir: 'LONG',  entry: 81500, exit: 84600, pnl:  3.8, win: true  },
      { dir: 'SHORT', entry: 84110, exit: 82900, pnl: -1.1, win: false },
      { dir: 'LONG',  entry: 80200, exit: 83400, pnl:  4.0, win: true  },
      { dir: 'LONG',  entry: 77800, exit: 80100, pnl:  3.0, win: true  },
    ],
  },
  {
    id:             'eth-range',
    name:           'ETH Range Scalper',
    symbol:         'ETHUSDT',
    timeframe:      '1H',
    type:           '레인지',
    description:    '볼린저 밴드 + 스토캐스틱. 명확한 박스권 구간에서 반복 진출입.',
    roi:            28.7,
    winRate:        71.4,
    mdd:            8.2,
    totalTrades:    312,
    currentPrice:   3241,
    priceChangePct: -0.87,
    runningStatus:  'running',
    status:         'not_started',
    trialDaysLeft:  0,
    recentTrades: [
      { dir: 'LONG',  entry: 3150, exit: 3241, pnl:  2.9, win: true  },
      { dir: 'SHORT', entry: 3310, exit: 3241, pnl:  2.1, win: true  },
      { dir: 'LONG',  entry: 3110, exit: 3175, pnl:  2.1, win: true  },
      { dir: 'SHORT', entry: 3340, exit: 3260, pnl:  2.4, win: true  },
      { dir: 'LONG',  entry: 3090, exit: 3080, pnl: -0.3, win: false },
    ],
  },
  {
    id:             'btc-breakout',
    name:           'BTC Breakout Hunter',
    symbol:         'BTCUSDT',
    timeframe:      '1D',
    type:           '돌파',
    description:    '주요 지지/저항 레벨 돌파 감지. 거래량 확인 후 포지션 진입.',
    roi:            31.5,
    winRate:        58.0,
    mdd:            15.8,
    totalTrades:    67,
    currentPrice:   84312,
    priceChangePct: 1.24,
    runningStatus:  'waiting',
    status:         'subscribed',
    trialDaysLeft:  0,
    recentTrades: [
      { dir: 'LONG',  entry: 82100, exit: 84300, pnl:  2.7, win: true  },
      { dir: 'LONG',  entry: 78500, exit: 82100, pnl:  4.6, win: true  },
      { dir: 'LONG',  entry: 74200, exit: 71000, pnl: -4.3, win: false },
      { dir: 'LONG',  entry: 68000, exit: 72400, pnl:  6.5, win: true  },
      { dir: 'SHORT', entry: 73100, exit: 71200, pnl:  2.6, win: true  },
    ],
  },
  {
    id:             'sol-momentum',
    name:           'SOL Momentum',
    symbol:         'SOLUSDT',
    timeframe:      '2H',
    type:           '모멘텀',
    description:    'ADX + DI 조합으로 강한 모멘텀 구간 포착. 변동성 클 때 성과 높음.',
    roi:            19.8,
    winRate:        54.6,
    mdd:            18.3,
    totalTrades:    94,
    currentPrice:   148,
    priceChangePct: 2.31,
    runningStatus:  'stopped',
    status:         'expired',
    trialDaysLeft:  0,
    recentTrades: [
      { dir: 'SHORT', entry: 152,  exit: 148,  pnl: -2.0, win: false },
      { dir: 'LONG',  entry: 140,  exit: 152,  pnl:  8.6, win: true  },
      { dir: 'LONG',  entry: 132,  exit: 141,  pnl:  6.8, win: true  },
      { dir: 'SHORT', entry: 158,  exit: 149,  pnl:  5.7, win: true  },
      { dir: 'LONG',  entry: 128,  exit: 122,  pnl: -4.7, win: false },
    ],
  },
]

/* ── 시그널 이력 ────────────────────────────── */
export const SIGNALS = {
  'btc-trend': [
    { id: 1, type: 'LONG',  price: 83420, time: '03/26 14:22', pnl: null,    open: true,  note: 'EMA 크로스 확인'   },
    { id: 2, type: 'EXIT',  price: 85342, time: '03/25 09:14', pnl: '+2.3%', open: false, note: 'RSI 과매수 청산'   },
    { id: 3, type: 'SHORT', price: 84110, time: '03/24 21:08', pnl: '−1.1%', open: false, note: '하락 추세 진입'    },
    { id: 4, type: 'EXIT',  price: 82900, time: '03/24 15:45', pnl: null,    open: false, note: '스탑로스 청산'     },
    { id: 5, type: 'LONG',  price: 81500, time: '03/23 10:30', pnl: '+3.8%', open: false, note: 'EMA 골든크로스'   },
    { id: 6, type: 'EXIT',  price: 84600, time: '03/22 18:00', pnl: null,    open: false, note: '목표가 도달'       },
    { id: 7, type: 'LONG',  price: 79200, time: '03/21 08:15', pnl: '+6.8%', open: false, note: '강세 추세 진입'   },
    { id: 8, type: 'EXIT',  price: 84590, time: '03/20 22:00', pnl: null,    open: false, note: '추세 반전 청산'   },
  ],
  'eth-range': [
    { id: 1, type: 'LONG',  price: 3180, time: '03/26 11:00', pnl: null,    open: true,  note: '하단 밴드 반등'   },
    { id: 2, type: 'EXIT',  price: 3241, time: '03/25 22:30', pnl: '+1.9%', open: false, note: '중간 밴드 청산'   },
    { id: 3, type: 'SHORT', price: 3310, time: '03/25 14:00', pnl: '+2.1%', open: false, note: '상단 밴드 저항'   },
    { id: 4, type: 'EXIT',  price: 3241, time: '03/24 20:00', pnl: null,    open: false, note: '중간 밴드 청산'   },
    { id: 5, type: 'LONG',  price: 3150, time: '03/24 08:00', pnl: '+0.9%', open: false, note: '하단 밴드 반등'   },
  ],
  'btc-breakout': [
    { id: 0, type: 'WAIT',  price: null,  time: '03/26 10:00', pnl: null,    open: false, note: '명확한 돌파 신호 대기 중' },
    { id: 1, type: 'LONG',  price: 82100, time: '03/24 00:00', pnl: '+2.7%', open: false, note: '저항 돌파 확인'  },
    { id: 2, type: 'EXIT',  price: 84300, time: '03/23 06:00', pnl: null,    open: false, note: '목표가 청산'      },
    { id: 3, type: 'LONG',  price: 78500, time: '03/19 12:00', pnl: '+4.6%', open: false, note: '박스권 상단 돌파' },
    { id: 4, type: 'EXIT',  price: 82100, time: '03/18 18:00', pnl: null,    open: false, note: '트레일링 청산'    },
  ],
  'sol-momentum': [
    { id: 1, type: 'SHORT', price: 152,  time: '03/25 09:00', pnl: '−2.0%', open: false, note: 'ADX 모멘텀 강세'  },
    { id: 2, type: 'EXIT',  price: 148,  time: '03/24 18:00', pnl: null,    open: false, note: '스탑로스 청산'    },
    { id: 3, type: 'LONG',  price: 140,  time: '03/23 10:00', pnl: '+8.6%', open: false, note: '상승 모멘텀 포착' },
    { id: 4, type: 'EXIT',  price: 152,  time: '03/22 14:00', pnl: null,    open: false, note: '목표 수익 청산'   },
  ],
}

/* ── 차트 데이터 ─────────────────────────────── */
export const CHART_DATA = {
  'btc-trend': {
    prices:  [79200, 79800, 80100, 79500, 80500, 81200, 81000, 81800, 82200, 81900,
              82600, 83100, 82800, 83500, 83200, 84000, 83700, 84400, 84200, 84600, 84312],
    entries: [4, 10, 17],
    exits:   [8, 14],
  },
  'eth-range': {
    prices:  [3100, 3150, 3180, 3220, 3260, 3290, 3310, 3280, 3250, 3210,
              3180, 3160, 3180, 3210, 3241],
    entries: [2, 10],
    exits:   [6, 13],
  },
  'btc-breakout': {
    prices:  [78000, 78500, 79200, 80000, 80800, 81500, 82100, 82800, 83500, 84000, 84300, 84312],
    entries: [4],
    exits:   [10],
  },
  'sol-momentum': {
    prices:  [132, 135, 138, 136, 140, 143, 141, 145, 148, 146, 150, 152, 149, 148],
    entries: [4],
    exits:   [11],
  },
}

/* ── 구독 상태 설정 ──────────────────────────── */
export const STATUS_CONFIG = {
  not_started: {
    label: '미체험',    badge: 'default',
    cta: '무료 체험 시작',
    ctaSub: null,
    ctaVariant: 'primary',
  },
  active: {
    label: '체험 중',   badge: 'success',
    cta: '이 전략 계속 사용하기',
    ctaSub: '체험 종료 후 자동 잠금',
    ctaVariant: 'secondary',
  },
  expired: {
    label: '체험 종료', badge: 'warning',
    cta: '실시간 시그널 받기',
    ctaSub: '지금 놓치고 있는 수익 확인',
    ctaVariant: 'primary',
  },
  subscribed: {
    label: '구독 중',   badge: 'info',
    cta: '사용 중',
    ctaSub: null,
    ctaVariant: 'ghost',
  },
}

/* ── 운영 상태 설정 ──────────────────────────── */
export const RUNNING_STATUS_CONFIG = {
  running: { label: '운영 중', color: 'bg-emerald-500' },
  waiting: { label: '신호 대기', color: 'bg-amber-400' },
  stopped: { label: '종료',    color: 'bg-slate-400'  },
}

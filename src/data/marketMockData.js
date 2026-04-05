import { STRATEGIES } from './mockData'
import { normalizeMarketStrategy } from '../lib/marketStrategy'

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

// ─────────────────────────────────────────
// 전략별 마켓 전용 enrichment 데이터
// ctaStatus / recommendBadge / 시장 적합도 / 최근 시그널
// ─────────────────────────────────────────
const ENRICHMENT = {
  s1: {
    ctaStatus:      'not_started',
    recommendBadge: 'GOOD',
    fitSummary:     '추세장 전용 · 현재 횡보장 비적합',
    fitDetail:
      '현재 BTC는 박스권 횡보 구간으로 EMA 크로스 진입 조건이 충족되기 어렵습니다. ' +
      '추세 전환 신호가 나타나면 최우선으로 재검토할 전략입니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/20 09:00', result: '+4.2%', closed: true  },
      { dir: 'EXIT',  time: '03/22 14:30', result: '+2.1%', closed: true  },
      { dir: 'LONG',  time: '03/24 11:00', result: '대기중', closed: false },
    ],
  },
  s2: {
    ctaStatus:      'active',
    recommendBadge: 'BEST',
    fitSummary:     '횡보장 최적 · 현재 구간 강력 추천',
    fitDetail:
      '현재 횡보장에서 RSI 과매수/과매도 기반 단타 전략의 적중률이 높아집니다. ' +
      '변동성 수축 박스권 내 반복 수익 가능성이 높으며, 체험 기간 동안 실제 성과를 직접 확인해 보세요.',
    recentSignals: [
      { dir: 'LONG',  time: '03/25 11:30', result: '+1.8%', closed: false },
      { dir: 'EXIT',  time: '03/24 16:00', result: '+2.3%', closed: true  },
      { dir: 'SHORT', time: '03/23 09:15', result: '+1.5%', closed: true  },
    ],
  },
  s3: {
    ctaStatus:      'not_started',
    recommendBadge: 'RISKY',
    fitSummary:     '변동성 확대 시 유효 · 현재 비적합',
    fitDetail:
      '볼린저 밴드 수축 이후 돌파를 노리는 전략입니다. ' +
      'MDD가 높아 자금 관리에 주의가 필요하며, 변동성이 확대되는 시점에 재진입을 검토하세요.',
    recentSignals: [
      { dir: 'SHORT', time: '03/18 10:00', result: '-2.1%', closed: true },
      { dir: 'LONG',  time: '03/21 13:00', result: '+8.4%', closed: true },
      { dir: 'LONG',  time: '03/24 09:30', result: '+3.2%', closed: true },
    ],
  },
  s4: {
    ctaStatus:      'not_started',
    recommendBadge: 'GOOD',
    fitSummary:     'ETH 평균 이탈 · 평균회귀 조건 충족',
    fitDetail:
      'ETH가 최근 단기 이동평균에서 이탈한 구간에 있어 평균회귀 조건이 충족되고 있습니다. ' +
      'BTC 횡보 영향으로 ETH 방향성도 제한될 수 있어 포지션 크기 조절이 권장됩니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/23 15:00', result: '+3.1%', closed: true  },
      { dir: 'SHORT', time: '03/24 08:30', result: '+1.9%', closed: true  },
      { dir: 'LONG',  time: '03/25 10:00', result: '진행중', closed: false },
    ],
  },
  s5: {
    ctaStatus:      'not_started',
    recommendBadge: 'GOOD',
    fitSummary:     'MTF 정렬 미흡 · 진입 보류 권장',
    fitDetail:
      '15분·1시간·4시간봉의 모멘텀 정렬이 아직 완전하지 않습니다. ' +
      '모든 타임프레임 방향이 일치하는 시점에 진입 효율이 최대화됩니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/15 09:00', result: '+6.2%', closed: true },
      { dir: 'EXIT',  time: '03/18 11:00', result: '+3.8%', closed: true },
      { dir: 'LONG',  time: '03/22 10:30', result: '+4.1%', closed: true },
    ],
  },
  s6: {
    ctaStatus:      'subscribed',
    recommendBadge: 'BEST',
    fitSummary:     '횡보장 안정 운영 · 현재 구독 중',
    fitDetail:
      '낮은 변동성과 높은 승률을 우선하는 보수적 전략으로, 현재 횡보장 환경에서도 일관된 성과를 유지합니다. ' +
      '리스크 대비 수익률이 우수하여 장기 운영에 적합합니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/24 14:00', result: '+1.2%', closed: true  },
      { dir: 'SHORT', time: '03/25 09:00', result: '+0.9%', closed: true  },
      { dir: 'LONG',  time: '03/25 12:30', result: '진행중', closed: false },
    ],
  },
  s7: {
    ctaStatus:      'not_started',
    recommendBadge: 'GOOD',
    fitSummary:     '박스권 그리드 운영 · 현재 구간 적합',
    fitDetail:
      '현재 가격 레인지가 안정적으로 형성되어 그리드 배치에 유리한 구간입니다. ' +
      '자동화 전략 특성상 지속적인 모니터링 없이도 반복 수익이 가능합니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/25 08:00', result: '+0.8%', closed: true },
      { dir: 'SHORT', time: '03/25 10:00', result: '+0.7%', closed: true },
      { dir: 'LONG',  time: '03/25 13:00', result: '+0.6%', closed: true },
    ],
  },
  s8: {
    ctaStatus:      'expired',
    recommendBadge: 'RISKY',
    fitSummary:     '펀딩비 중립 구간 · 진입 조건 미충족',
    fitDetail:
      '현재 펀딩비는 중립 구간이라 진입 조건이 충족되지 않습니다. ' +
      '펀딩비 극단 발생 시 실시간 알림을 받으려면 구독을 유지하는 것을 권장합니다.',
    recentSignals: [
      { dir: 'SHORT', time: '03/10 12:00', result: '+4.8%', closed: true },
      { dir: 'LONG',  time: '03/14 09:30', result: '+3.2%', closed: true },
      { dir: 'SHORT', time: '03/19 16:00', result: '+2.9%', closed: true },
    ],
  },
  s9: {
    ctaStatus:      'not_started',
    recommendBadge: 'RISKY',
    fitSummary:     'AI 베타 전략 · 고위험 주의',
    fitDetail:
      '머신러닝 기반 실험적 전략으로 베타 운영 단계입니다. ' +
      '높은 ROI 잠재력을 가지나 MDD도 높아 전체 자산의 소규모 편입을 권장합니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/20 10:00', result: '+12.3%', closed: true  },
      { dir: 'EXIT',  time: '03/22 15:00', result: '-5.2%',  closed: true  },
      { dir: 'LONG',  time: '03/25 09:00', result: '진행중',  closed: false },
    ],
  },
  s10: {
    ctaStatus:      'not_started',
    recommendBadge: 'GOOD',
    fitSummary:     '주말 효과 대기 · 금요일 진입 예정',
    fitDetail:
      '주말 유동성 저하 패턴을 이용하는 전략으로, 금요일 오후부터 주말까지가 핵심 운영 구간입니다. ' +
      '현재 수요일로 포지션 진입 준비 단계에 있습니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/22 16:00', result: '+2.4%', closed: true },
      { dir: 'EXIT',  time: '03/24 09:00', result: '+1.8%', closed: true },
      { dir: 'LONG',  time: '03/15 15:30', result: '+3.1%', closed: true },
    ],
  },
  s11: {
    ctaStatus:      'not_started',
    recommendBadge: 'GOOD',
    fitSummary:     '알트 로테이션 대기 · 추세 확인 후 진입',
    fitDetail:
      '현재 BTC 횡보 영향으로 알트코인 상대 강도가 고르지 않은 상태입니다. ' +
      '특정 알트코인에서 상대 강도 시그널이 감지되면 순환 진입이 진행됩니다.',
    recentSignals: [
      { dir: 'LONG',  time: '03/12 10:00', result: '+9.2%', closed: true },
      { dir: 'EXIT',  time: '03/17 14:00', result: '+5.8%', closed: true },
      { dir: 'LONG',  time: '03/23 11:00', result: '+3.4%', closed: true },
    ],
  },
  s12: {
    ctaStatus:      'not_started',
    recommendBadge: 'GOOD',
    fitSummary:     'OBV 다이버전스 형성 중 · 전환 모니터링',
    fitDetail:
      'OBV와 가격 간 다이버전스가 점진적으로 형성되고 있습니다. ' +
      '완전한 다이버전스 확인 시 추세 전환 신호가 발생할 수 있으며, 현재는 진입 대기 구간입니다.',
    recentSignals: [
      { dir: 'SHORT', time: '03/19 09:00', result: '+4.6%', closed: true  },
      { dir: 'LONG',  time: '03/21 13:30', result: '+2.8%', closed: true  },
      { dir: 'LONG',  time: '03/25 08:00', result: '진행중', closed: false },
    ],
  },
}

/**
 * 전략마켓 ID → 모의투자 ID 매핑
 * 없으면 'btc-trend' 기본값 사용
 */
export const MARKET_TO_SIM_ID = {
  s1:  'btc-trend',
  s2:  'eth-range',
  s3:  'btc-breakout',
  s4:  'sol-momentum',
  s5:  'btc-trend',
  s6:  'eth-range',
  s7:  'eth-range',
  s8:  'btc-breakout',
  s9:  'btc-trend',
  s10: 'sol-momentum',
  s11: 'sol-momentum',
  s12: 'btc-breakout',
}

/** 전략별 최근 7일 수익률 */
const ROI7D = {
  s1:  3.2,  s2:  2.1,  s3: -1.8,  s4:  4.6,
  s5:  1.9,  s6:  1.4,  s7:  0.9,  s8:  5.2,
  s9:  8.1,  s10: 2.7,  s11: 3.8,  s12: 1.2,
}

/** 자산 유형, 보유 기간, 적합 시장 환경 */
const EXTRA = {
  s1:  { assetType: 'btc', holding: 'mid',   marketEnv: 'trend' },
  s2:  { assetType: 'btc', holding: 'short', marketEnv: 'range' },
  s3:  { assetType: 'btc', holding: 'short', marketEnv: 'trend' },
  s4:  { assetType: 'sol', holding: 'short', marketEnv: 'range' },
  s5:  { assetType: 'btc', holding: 'long',  marketEnv: 'trend' },
  s6:  { assetType: 'eth', holding: 'short', marketEnv: 'range' },
  s7:  { assetType: 'btc', holding: 'short', marketEnv: 'range' },
  s8:  { assetType: 'alt', holding: 'short', marketEnv: 'range' },
  s9:  { assetType: 'btc', holding: 'long',  marketEnv: 'trend' },
  s10: { assetType: 'btc', holding: 'mid',   marketEnv: 'range' },
  s11: { assetType: 'alt', holding: 'long',  marketEnv: 'trend' },
  s12: { assetType: 'btc', holding: 'mid',   marketEnv: 'trend' },
}

/** STRATEGIES + enrichment 병합 + 마켓 지표 정규화 */
export const MARKET_STRATEGIES = STRATEGIES.map((s) => normalizeMarketStrategy({
  ...s,
  ...(ENRICHMENT[s.id] ?? {}),
  ...(EXTRA[s.id] ?? {}),
  roi7d: ROI7D[s.id] ?? null,
}))

// ─────────────────────────────────────────
// 필터 / 정렬 옵션
// ─────────────────────────────────────────
export const TYPE_OPTIONS = [
  { value: 'trend',          label: '추세' },
  { value: 'range',          label: '횡보' },
  { value: 'breakout',       label: '변동성 돌파' },
  { value: 'mean_reversion', label: '평균회귀' },
  { value: 'seasonal',       label: '계절성' },
  { value: 'divergence',     label: '다이버전스' },
]

export const STATUS_OPTIONS = [
  { value: 'recommended', label: '추천' },
  { value: 'popular',     label: '인기' },
  { value: 'new',         label: '신규' },
]

export const RECOMMEND_OPTIONS = [
  { value: 'BEST',  label: 'BEST'  },
  { value: 'GOOD',  label: 'GOOD'  },
  { value: 'RISKY', label: 'RISKY' },
]

/** 상단 빠른 정렬 탭 (MarketPage) */
export const MARKET_SORT_TABS = [
  { value: 'recommend_desc', label: '추천순' },
  { value: 'return_desc',    label: '수익률순' },
  { value: 'recent7d_desc',  label: '최근순' },
  { value: 'winRate_desc',   label: '승률순' },
  { value: 'mdd_asc',        label: '안정성순' },
  { value: 'updated_desc',   label: '최신순' },
]

export const SORT_OPTIONS = [
  { value: 'recommend_desc', label: '추천순 (가중 점수)' },
  { value: 'return_desc',    label: '수익률 높은 순' },
  { value: 'recent7d_desc',  label: '최근 7일 성과 높은 순' },
  { value: 'winRate_desc',   label: '승률 높은 순' },
  { value: 'trades_desc',    label: '거래 수 많은 순' },
  { value: 'mdd_asc',        label: '최대 낙폭 낮은 순 (안정성)' },
  { value: 'updated_desc',   label: '최신 순' },
  { value: 'roi_desc',       label: 'ROI 높은 순 (호환)' },
  { value: 'name_asc',       label: '이름 순' },
]

export const ASSET_OPTIONS = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'sol', label: 'SOL' },
  { value: 'alt', label: '알트코인' },
]

export const TIMEFRAME_OPTIONS = [
  { value: 'short', label: '단기' },
  { value: 'mid',   label: '중기' },
  { value: 'long',  label: '장기' },
]

export const MARKET_ENV_OPTIONS = [
  { value: 'trend', label: '추세장' },
  { value: 'range', label: '횡보장' },
]

export const DEFAULT_FILTERS = {
  search:    '',
  types:     [],
  recommend: [],
  assets:    [],
  holdings:  [],
  marketEnv: [],
  roiMin:    '',
  recentRoiMin: '',
  winMin:    '',
  mddMax:    '',
  tradesMin: '',
  priceMaxKrw: '',
  sort:      'recommend_desc',
}

// ─────────────────────────────────────────
// 클라이언트 필터링 함수
// ─────────────────────────────────────────
export function applyMarketFilters(strategies, filters) {
  const { search, types, recommend, assets, holdings, marketEnv, roiMin, recentRoiMin, winMin, mddMax, tradesMin, priceMaxKrw, sort } = filters

  const enriched = (strategies ?? []).map((s) => (
    s.recommendationScore != null && Number.isFinite(s.recommendationScore)
      ? s
      : normalizeMarketStrategy(s)
  ))

  const result = enriched.filter((s) => {
    if (
      search &&
      !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !s.typeLabel.toLowerCase().includes(search.toLowerCase())
    ) return false
    if (types.length     && !types.includes(s.type))                     return false
    if (recommend.length && !recommend.includes(s.recommendBadge))        return false
    if (assets.length    && !assets.includes(s.assetType))                return false
    if (holdings.length  && !holdings.includes(s.holding))                return false
    if (marketEnv.length && !marketEnv.includes(s.marketEnv))             return false
    const ret = s.totalReturnPct != null ? s.totalReturnPct : s.roi
    const mddVal = s.maxDrawdown != null ? Math.abs(s.maxDrawdown) : Math.abs(s.mdd)
    const tc = s.tradeCount != null ? s.tradeCount : s.trades
    if (roiMin !== ''    && safeNum(ret, 0) < Number(roiMin))             return false
    if (recentRoiMin !== '' && safeNum(s.recentRoi7d ?? s.roi7d, 0) < Number(recentRoiMin)) return false
    if (winMin !== ''    && safeNum(s.winRate, 0) < Number(winMin))       return false
    if (mddMax !== ''    && mddVal > Number(mddMax))                      return false
    if (tradesMin !== '' && safeNum(tc, 0) < Number(tradesMin))           return false
    const listPrice = safeNum(s.monthlyPriceKrw ?? s.monthly_price ?? 0, 0)
    if (priceMaxKrw !== '' && listPrice > 0 && listPrice > Number(priceMaxKrw)) return false
    return true
  })

  const ret = (s) => (s.totalReturnPct != null ? s.totalReturnPct : s.roi)
  const mdd = (s) => (s.maxDrawdown != null ? Math.abs(s.maxDrawdown) : Math.abs(safeNum(s.mdd, 0)))
  const trades = (s) => (s.tradeCount != null ? s.tradeCount : s.trades)
  const updated = (s) => safeNum(s.updatedAt, 0)
  const recent7d = (s) => safeNum(s.recentRoi7d ?? s.roi7d, 0)

  result.sort((a, b) => {
    switch (sort) {
      case 'recommend_desc':
      case 'score_desc':
        return safeNum(b.recommendationScore, -1e18) - safeNum(a.recommendationScore, -1e18)
      case 'return_desc':
      case 'roi_desc':
        return ret(b) - ret(a)
      case 'winRate_desc':
        return safeNum(b.winRate, 0) - safeNum(a.winRate, 0)
      case 'recent7d_desc':
        return recent7d(b) - recent7d(a)
      case 'mdd_asc':
        return mdd(a) - mdd(b)
      case 'trades_desc':
        return trades(b) - trades(a)
      case 'updated_desc':
        return updated(b) - updated(a)
      case 'name_asc':
        return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko')
      default:
        return 0
    }
  })

  return result
}

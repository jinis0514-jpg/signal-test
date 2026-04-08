/**
 * 유저 플랜 유틸리티
 *
 * user 상태 형태:
 * {
 *   plan:                'free' | 'standard' | 'pro' | 'premium',
 *   unlockedStrategyIds: ['btc-trend'],             // 접근 허용된 시뮬레이션 전략 ID 목록
 *   subscriptionExpiresAt: string | null,             // ISO (subscriptions.expires_at)
 *   subscriptionSource:  'local' | 'remote',
 *   subscriptionRecordPlan: string | null,            // DB plan 컬럼 원본 (표시용)
 *   billingTier:         null,                      // 레거시 호환 필드(사용 안 함)
 * }
 *
 * 정책 요약 (표현 레이어 매핑)
 * - free     : 기본 열람, 광고 ON
 * - standard : 전략 구독 최대 2개, 등록 불가, 광고 OFF
 * - pro      : 전략 등록 최대 5개, 수수료 30%
 * - premium  : 전략 등록 최대 10개, 수수료 10%, 노출 우선
 */

import { OPERATOR_STRATEGY_SIM_IDS } from '../data/operatorStrategies'
import { STRATEGIES } from '../data/simulationMockData'

export const TRIAL_DAYS = 7
export const FREE_SIGNAL_LIMIT = 3
/** 무료 플랜에서 저장 가능한 사용자 전략 최대 개수 */
export const FREE_MAX_SAVED_STRATEGIES = 1

/** Pro: 마켓 검수 파이프라인 동시 보유 최대 개수 */
export const MARKET_PIPELINE_MAX_STRATEGIES = 5

/** Premium: 동시 제출·파이프라인 상한 */
export const MARKET_PIPELINE_MAX_PREMIUM = 10

/** 승인 전략 마켓 게시 기간(월) — 갱신 시 동일 기간 연장 */
export const MARKET_LISTING_PERIOD_MONTHS = 6

/** 플랜별 월 구독가(원, 표시용) */
export const PLAN_PRICE_KRW = {
  standard: 9_900,
  pro: 39_000,
  premium: 99_000,
}

/** 마켓 판매 정산 시 플랫폼 수수료 (%) */
export const MARKET_SELLER_FEE_PCT_PRO = 30
export const MARKET_SELLER_FEE_PCT_PREMIUM = 10

/** 전략 1건 마켓 등록 수수료(원) — 0이면 미부과, 정책 확정 후 설정 */
export const MARKET_LISTING_FEE_KRW = 0

export const PLAN_RULES = {
  free: {
    maxSubscriptions: 0,
    maxListings: 0,
    ads: true,
  },
  standard: {
    maxSubscriptions: 2,
    maxListings: 0,
    ads: false,
  },
  pro: {
    maxSubscriptions: Infinity,
    maxListings: 5,
    ads: false,
    feeRate: 0.3,
  },
  premium: {
    maxSubscriptions: Infinity,
    maxListings: 10,
    ads: false,
    feeRate: 0.1,
  },
}

export function getPlanRule(userOrPlan) {
  const p = typeof userOrPlan === 'string'
    ? userOrPlan
    : String(userOrPlan?.plan ?? 'free').toLowerCase()
  return PLAN_RULES[p] ?? PLAN_RULES.free
}

/** 3단계: user_plans.plan -> rules 해석 */
export function resolvePlanAndRules(userPlan) {
  const plan = String(userPlan?.plan ?? 'free').toLowerCase()
  const rules = PLAN_RULES[plan] ?? PLAN_RULES.free
  return { plan, rules }
}

/** 4단계: 구독 가능 수 제한 */
export function isSubscriptionLimitExceeded(subscriptions, userPlan) {
  const { rules } = resolvePlanAndRules(userPlan)
  const n = Array.isArray(subscriptions) ? subscriptions.length : 0
  return Number.isFinite(rules.maxSubscriptions) && n >= rules.maxSubscriptions
}

/** 4단계: 등록 가능 수 제한 */
export function isListingLimitExceeded(myStrategies, userPlan) {
  const { rules } = resolvePlanAndRules(userPlan)
  const n = Array.isArray(myStrategies) ? myStrategies.length : 0
  return Number.isFinite(rules.maxListings) && n >= rules.maxListings
}

/** 4단계: 수수료 계산 */
export function calculatePlatformFee(profit, userPlan) {
  const { rules } = resolvePlanAndRules(userPlan)
  const p = Number(profit)
  if (!Number.isFinite(p)) return 0
  const feeRate = Number.isFinite(rules.feeRate) ? rules.feeRate : 0
  return p * feeRate
}

/** 4단계: 무료 플랜 업그레이드 필요 여부 */
export function isUpgradeRequired(userPlan) {
  const { plan } = resolvePlanAndRules(userPlan)
  return plan === 'free'
}

/** 무료 접근 가능한 전략 ID */
export const FREE_SIM_ID    = 'btc-trend'
export const FREE_MARKET_ID = 's1'

/**
 * 무료로 항상 열람 가능한 마켓 전략 ID (기본 1종 외 큐레이션)
 * @type {Set<string>}
 */
export const FREE_MARKET_STRATEGY_EXTRA_IDS = new Set(['op-btc-trend-core'])

/**
 * 전략별 열람에 필요한 최소 상품 티어 (free / pro / premium)
 * - free: 누구나
 * - pro: Starter(체험) · Pro 구독
 * - premium: Premium 구독만
 */
export const STRATEGY_ACCESS_TIER = {
  FREE: 'free',
  PRO: 'pro',
  PREMIUM: 'premium',
}

function stableHashString(str) {
  let h = 0
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/**
 * 마켓 전략 ID → 열람에 필요한 최소 티어 (DB 필드 없이 안정적 분배)
 * @returns {'free'|'pro'|'premium'}
 */
export function getMarketStrategyAccessTier(strategyId) {
  const id = String(strategyId ?? '')
  if (!id) return STRATEGY_ACCESS_TIER.PREMIUM
  if (id === FREE_MARKET_ID || FREE_MARKET_STRATEGY_EXTRA_IDS.has(id)) {
    return STRATEGY_ACCESS_TIER.FREE
  }
  const bucket = stableHashString(id) % 100
  if (bucket < 18) return STRATEGY_ACCESS_TIER.FREE
  if (bucket < 78) return STRATEGY_ACCESS_TIER.PRO
  return STRATEGY_ACCESS_TIER.PREMIUM
}

/**
 * 현재 플랜으로 해당 마켓 전략을 열람할 수 있는지
 */
export function canAccessMarketStrategy(strategyId, user) {
  const required = getMarketStrategyAccessTier(strategyId)
  if (required === STRATEGY_ACCESS_TIER.FREE) return true
  const tier = getEffectiveProductTier(user ?? INITIAL_USER)
  if (tier === PLAN_TIER.FREE) return false
  if (required === STRATEGY_ACCESS_TIER.PRO) {
    return tier === PLAN_TIER.STARTER || tier === PLAN_TIER.PRO || tier === PLAN_TIER.PREMIUM
  }
  if (required === STRATEGY_ACCESS_TIER.PREMIUM) {
    return tier === PLAN_TIER.PREMIUM
  }
  return true
}

/**
 * 접근 불가 시 카드·모달용 안내 (티어별 구독 유도)
 * @returns {string | null} 열람 가능하면 null
 */
export function getStrategyAccessUpsellMessage(strategyId, user) {
  if (canAccessMarketStrategy(strategyId, user)) return null
  const required = getMarketStrategyAccessTier(strategyId)
  const tier = getEffectiveProductTier(user ?? INITIAL_USER)
  if (tier === PLAN_TIER.FREE) {
    if (required === STRATEGY_ACCESS_TIER.PRO) {
      return 'Starter 체험 또는 Pro 이상에서 상세 내용을 열 수 있어요.'
    }
    return 'Premium 플랜에서 프리미엄 전략 전체를 열람할 수 있어요.'
  }
  if (required === STRATEGY_ACCESS_TIER.PREMIUM && tier !== PLAN_TIER.PREMIUM) {
    return 'Premium으로 업그레이드하면 이 전략을 포함한 전체 카탈로그를 이용할 수 있어요.'
  }
  return PLAN_MESSAGES.subscriberOnly
}

const CATALOG_SIM_IDS = new Set(STRATEGIES.map((s) => s.id))

/**
 * 체험 시 unlockedStrategyIds에 넣을 시뮬레이션 카탈로그 ID로 정규화
 * (마켓/운영자 id → btc-trend 등)
 * @param {object | null} strategy
 * @returns {string | null}
 */
export function resolveSimIdForUnlock(strategy) {
  if (!strategy || typeof strategy !== 'object') return null
  const id = String(strategy.id ?? '')
  const mapped = OPERATOR_STRATEGY_SIM_IDS[id]
  if (mapped) return mapped
  if (String(strategy.type ?? 'signal') === 'method' && strategy.linked_signal_strategy_id) {
    const l = String(strategy.linked_signal_strategy_id)
    if (CATALOG_SIM_IDS.has(l)) return l
  }
  if (CATALOG_SIM_IDS.has(id)) return id
  return id || null
}

/** 초기 user 상태 */
export const INITIAL_USER = {
  plan:                'free',
  unlockedStrategyIds: ['btc-trend'],
  subscriptionExpiresAt: null,
  subscriptionStartedAt: null,
  subscriptionStatus:    null,
  subscriptionSource:    'local',
  subscriptionRecordPlan:  null,
  billingTier:           null,
  /** false면 마켓 제출 불가(판매자 자격 미충족). 미설정은 허용(하위 호환). */
  sellerQualified:         undefined,
  /**
   * 전략 id → 시그널 알림 세부 설정 (기본 미설정 시 모두 ON으로 간주)
   * @type {Record<string, { all?: boolean, long?: boolean, short?: boolean, exit?: boolean }>}
   */
  strategyNotifySettings: {},
}

/**
 * 구독 유도 카피 — 가치 먼저, 제한은 부가 설명 (강제 차단 톤 지양)
 */
export const UPSELL_COPY = {
  valueRealtime:
    '검증된 성과를 바탕으로 실시간 시그널·포지션·전체 히스토리까지 한 화면에서 이어서 확인할 수 있어요.',
  fullAccessHint:
    '스탠다드 이상에서 실시간 실행·전체 시그널·운영 알림까지 제한 없이 이용할 수 있어요.',
  runRequiresPlan:
    '이 전략은 유료 플랜에서 실행·실시간 연동을 이용할 수 있어요. 성과를 확인했다면 다음 단계로 이어갈 수 있습니다.',
  signalTeaser:
    '무료로는 최근 시그널 일부만 빠르게 확인할 수 있어요. 전체 타임라인·실시간 갱신은 유료 플랜에서 열립니다.',
  editorAfterTest:
    '테스트로 전략 성과를 확인했어요. 시그널 페이지에서 같은 규칙으로 실시간 실행하려면 유료 플랜이 필요합니다.',
  ctaSubscribe: '지금 시작하기',
  ctaTrial: '플랜 보기',
  ctaTrialShort: '플랜',
  chartOverlay: '실시간 차트·진입 표시는 구독 또는 체험에서 더 선명하게 제공됩니다.',
}

/** 플랜 안내 문구 (UI 공통) */
export const PLAN_MESSAGES = {
  saveLimit:
    '무료 플랜은 전략 1개까지만 저장할 수 있습니다. 기존 전략을 수정하거나, 체험·구독으로 한도를 늘리세요.',
  subscriberOnly: '이 기능은 유료 플랜에서 사용할 수 있습니다.',
  notifications: '알림 목록은 스탠다드 이상에서 이용할 수 있습니다.',
  notificationsProDetail:
    '실시간 알림·전체 목록·읽음 처리는 스탠다드 이상에서 사용할 수 있습니다.',
  validationLocked:
    '이 전략의 상세 검증·지표는 스탠다드 이상에서 볼 수 있습니다. 과거 수익은 보장되지 않으며 참고용입니다.',
  simulationLocked:
    '실시간 시그널·전체 타임라인은 유료 플랜에서 이용할 수 있습니다.',
  marketMoreStrategies:
    '지표 열람은 계속 가능합니다. 실시간 시그널 전체는 유료 플랜에서 이어집니다.',
  strategySubscribeRequired:
    '유료 플랜이 필요합니다. 플랜을 올리면 상세 지표·설명·실행까지 이어질 수 있어요.',
  marketSubmitProOnly:
    '마켓 등록·판매는 Pro 이상에서 가능합니다.',
  marketSubmitFree:
    '마켓 등록은 Pro 이상 플랜에서 이용할 수 있습니다.',
  marketPipelineCap: (n) =>
    `Pro 플랜은 최대 ${n}개 전략까지만 제출할 수 있습니다. 승인·반려 후 슬롯이 비면 다시 제출할 수 있습니다.`,
}

/** UI·정책 표에서 쓰는 티어: free | standard | pro | premium */
export const PLAN_TIER = {
  FREE: 'free',
  STARTER: 'standard',
  STANDARD: 'standard',
  PRO: 'pro',
  PREMIUM: 'premium',
}

/**
 * 내부 plan → 표시 티어
 * @returns {'free'|'standard'|'pro'|'premium'}
 */
export function getEffectivePlanTier(user) {
  return getEffectiveProductTier(user)
}

/**
 * 상품 티어 (Standard / Pro / Premium 구분)
 * @returns {'free'|'standard'|'pro'|'premium'}
 */
export function getEffectiveProductTier(user) {
  if (!user) return PLAN_TIER.FREE
  if (user.plan === 'standard') return PLAN_TIER.STARTER
  if (user.plan === 'pro') return PLAN_TIER.PRO
  if (user.plan === 'premium') return PLAN_TIER.PREMIUM
  return PLAN_TIER.FREE
}

/** 티어 한글 (비교표·요약) */
export function getPlanTierDisplayName(tier) {
  const m = {
    [PLAN_TIER.FREE]: 'Free',
    [PLAN_TIER.STARTER]: 'Standard',
    [PLAN_TIER.PRO]: 'Pro',
    [PLAN_TIER.PREMIUM]: 'Premium',
  }
  return m[tier] ?? 'Free'
}

/**
 * 마켓·추천 등 프리미엄 전략 열람 (Standard 이상)
 * — 시뮬·알림 등 유료 체험 기능과 동일 기준 (전략 ID별 티어는 isMarketLocked 참고)
 */
export function canViewPremiumStrategies(user) {
  return hasPaidPlanFeatures(user)
}

/** 상세 검증·백테스트 지표 등 고급 검증 UI */
export function canUseAdvancedValidation(user) {
  return hasPaidPlanFeatures(user)
}

/** 인앱 알림 전체(목록·실시간·읽음) */
export function canReceiveAdvancedNotifications(user) {
  return hasPaidPlanFeatures(user)
}

/** 요금제·구독 안내 페이지로 이동 */
export function navigateToSubscriptionSection(onNavigate) {
  onNavigate?.('plans')
}

/**
 * 플랜 비교표 행 (Free / Starter / Pro / Premium)
 * @type {{ key: string, label: string, free: string, starter: string, pro: string, premium: string }[]}
 */
export const PLAN_COMPARISON_FEATURES = [
  { key: 'view', label: '전략 열람', free: '기본', starter: '확대', pro: '전체', premium: '전체' },
  { key: 'sim', label: '시그널', free: '제한', starter: '확대', pro: '전체', premium: '전체' },
  { key: 'val', label: '검증·지표', free: '제한', starter: '확대', pro: '전체', premium: '전체·심화' },
  { key: 'notif', label: '알림', free: '제한', starter: '확대', pro: '전체', premium: '전체·우선' },
  { key: 'sell', label: '마켓 제출', free: '불가', starter: '불가', pro: `최대 ${MARKET_PIPELINE_MAX_STRATEGIES}개`, premium: `최대 ${MARKET_PIPELINE_MAX_PREMIUM}개` },
  { key: 'fee', label: '판매 수수료', free: '—', starter: '—', pro: `${MARKET_SELLER_FEE_PCT_PRO}%`, premium: `${MARKET_SELLER_FEE_PCT_PREMIUM}%` },
]

/** 유료 플랜 = 유료 기능 사용 가능 */
export function hasPaidPlanFeatures(user) {
  if (!user) return false
  return [
    'standard',
    'pro',
    'premium',
  ].includes(String(user.plan ?? '').toLowerCase())
}

/** Pro(구독) — 마켓 제출·검수 요청 */
export function isProSubscriber(user) {
  if (!user) return false
  const p = String(user.plan ?? '').toLowerCase()
  return p === 'pro' || p === 'premium'
}

/**
 * 새 전략 저장(생성) 가능 여부
 * @param {boolean} isEditingExisting — 이미 서버에 있는 UUID 전략을 수정하는 경우 true
 */
export function canSaveNewStrategy(user, savedCount, isEditingExisting) {
  if (isEditingExisting) return true
  const max = Number(getPlanRule(user).maxListings)
  if (!Number.isFinite(max)) return true
  return savedCount < max
}

const PIPELINE_STATUSES = new Set(['submitted', 'under_review', 'approved'])

/**
 * 마켓 검수 파이프라인에 올라간 전략 수 (제출됨·검수중·승인됨)
 */
export function countMarketPipelineStrategies(strategies) {
  if (!Array.isArray(strategies)) return 0
  return strategies.filter((s) => s && PIPELINE_STATUSES.has(String(s.status ?? ''))).length
}

/**
 * 이번 제출 후 파이프라인 슬롯 초과 여부
 * @param {object[]} strategies — 내 전략 목록
 * @param {string|null} editingId — 저장 중인 전략 id
 * @param {boolean} willEnterPipeline — 제출 시 파이프라인에 들어가는지
 */
export function wouldExceedMarketPipelineCap(strategies, editingId, willEnterPipeline, user) {
  if (!willEnterPipeline) return false
  const current = editingId ? strategies.find((s) => s.id === editingId) : null
  const alreadyIn = current && PIPELINE_STATUSES.has(String(current.status ?? ''))
  const n = countMarketPipelineStrategies(strategies)
  const next = alreadyIn ? n : n + 1
  return next > getMaxSubmittedStrategies(user)
}

/** 마켓에 제출(검수 요청) 가능 여부 — Pro 이상 + 판매자 자격 */
export function canSubmitStrategyToMarket(user) {
  return isProSubscriber(user) && isSellerQualified(user)
}

/**
 * 마켓 파이프라인 동시 보유 상한
 * @returns {number} 구독이 아니면 0
 */
export function getMaxMarketStrategies(user) {
  return getMaxSubmittedStrategies(user)
}

/**
 * 마켓 제출·파이프라인 동시 상한 (Pro / Premium)
 */
export function getMaxSubmittedStrategies(user) {
  if (!isProSubscriber(user)) return 0
  const listingLimit = Number(getPlanRule(user).maxListings)
  if (Number.isFinite(listingLimit)) return listingLimit
  if (getEffectiveProductTier(user) === PLAN_TIER.PREMIUM) return MARKET_PIPELINE_MAX_PREMIUM
  return MARKET_PIPELINE_MAX_STRATEGIES
}

/** 마켓 판매 정산 시 플랫폼 수수료율 (0~100) */
export function getMarketSellerFeePercent(user) {
  const r = getPlanRule(user)
  if (typeof r.feeRate !== 'number') return null
  return Math.round(r.feeRate * 100)
}

/** 전략 구독 한도 (Infinity 가능) */
export function getMaxSubscriptions(user) {
  return getPlanRule(user).maxSubscriptions
}

/** 전략 등록 한도 */
export function getMaxListings(user) {
  const n = Number(getPlanRule(user).maxListings)
  if (Number.isFinite(n)) return n
  return null
}

/**
 * 판매자 자격(자격 테스트·기준 충족) — 명시적으로 false면 제출 불가
 */
export function isSellerQualified(user) {
  if (!user) return false
  if (user.sellerQualified === false) return false
  return true
}

/**
 * 공개(검수 파이프라인) 전략을 하나 더 올릴 수 있는지
 * @param {number} currentPipelineCount — submitted+under_review+approved 개수
 */
export function canCreatePublicStrategy(user, currentPipelineCount) {
  const n = Math.max(0, Math.floor(Number(currentPipelineCount) || 0))
  if (!isProSubscriber(user)) return false
  return n < getMaxSubmittedStrategies(user)
}

/** 인앱 알림 드롭다운(목록·읽음) — 무료는 진입만 막고 안내 */
export function canUseInAppNotifications(user) {
  return hasPaidPlanFeatures(user)
}

/**
 * 시뮬레이션 / 검증 전략이 잠겨있는지
 * - free 플랜이면서 unlockedStrategyIds에 없는 경우 잠금
 */
export function isSimLocked(strategyId, user) {
  if (user.plan !== 'free') return false
  return !user.unlockedStrategyIds.includes(strategyId)
}

/**
 * 마켓 전략이 잠겨있는지 (플랜별 열람 티어)
 * - Free: 일부 전략만
 * - Standard·Pro: 대부분
 * - Premium: 전체
 */
export function isMarketLocked(marketId, user) {
  return !canAccessMarketStrategy(marketId, user)
}

/**
 * 노출할 시그널 최대 개수
 * - subscribed만 전체, 나머지는 3개 제한
 */
export function getSignalLimit(user) {
  return isProSubscriber(user) ? Infinity : FREE_SIGNAL_LIMIT
}

function fmtExpiry(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** 플랜 라벨 (Topbar 표시용) */
export function getPlanLabel(user) {
  if (!user) return 'Guest'
  const exp = fmtExpiry(user.subscriptionExpiresAt)
  const suffix = exp ? ` · 만료 ${exp}` : ''
  if (user.subscriptionStatus === 'canceled' && user.plan === 'free') {
    return '무료 · 해지됨'
  }
  if (user.plan === 'premium') return `Premium · 구독 중${suffix}`
  if (user.plan === 'pro') return `Pro · 구독 중${suffix}`
  if (user.plan === 'standard') return `Standard · 구독 중${suffix}`
  return 'Free'
}

/** 마이페이지 등에서 쓰는 플랜 한글 이름 */
export function getPlanKindLabel(user) {
  if (!user) return '—'
  if (user.subscriptionStatus === 'canceled' && user.plan === 'free') {
    return '무료 (구독 해지됨)'
  }
  if (user.subscriptionStatus === 'expired' && user.plan === 'free') {
    return '무료 (기간 만료)'
  }
  if (user.plan === 'premium') return 'Premium (구독)'
  if (user.plan === 'pro') return 'Pro (구독)'
  if (user.plan === 'standard') return 'Standard (구독)'
  return 'Free (무료)'
}

/** 광고 노출 여부: free만 ON */
export function shouldShowAds(user) {
  return getPlanRule(user).ads === true
}

/** DB status → 배지 라벨 (merge 결과와 함께 사용) */
export function getSubscriptionStatusLabel(user) {
  if (!user?.subscriptionStatus) return null
  const m = {
    active: '활성',
    expired: '만료',
    canceled: '해지됨',
  }
  return m[user.subscriptionStatus] ?? user.subscriptionStatus
}

/**
 * 체험 긴박감 텍스트 색상
 * 5~7일 기본 / 3일 이하 주황 / 1일 빨강
 */
export function getTrialUrgencyClass(trialDaysLeft) {
  if (trialDaysLeft <= 1) return 'text-red-600 dark:text-red-500'
  if (trialDaysLeft <= 3) return 'text-amber-600 dark:text-amber-500'
  return 'text-slate-500 dark:text-slate-400'
}

/**
 * 체험 긴박감 배지 배경/보더 색상
 */
export function getTrialUrgencyBg(trialDaysLeft) {
  if (trialDaysLeft <= 1)
    return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/40'
  if (trialDaysLeft <= 3)
    return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40'
  return 'bg-slate-50 border-slate-200 dark:bg-gray-800/40 dark:border-gray-700'
}

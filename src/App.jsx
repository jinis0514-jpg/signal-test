import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import HomePage       from './pages/HomePage'
import MarketPage     from './pages/MarketPage'
import SignalPage from './pages/SignalPage'
import ValidationPage from './pages/ValidationPage'
import EditorPage     from './pages/EditorPage'
import MyPage         from './pages/MyPage'
import PlansPage      from './pages/PlansPage'
import EditorErrorBoundary from './components/editor/EditorErrorBoundary'
import {
  INITIAL_USER,
  canSaveNewStrategy,
  PLAN_MESSAGES,
  canSubmitStrategyToMarket,
  wouldExceedMarketPipelineCap,
  MARKET_PIPELINE_MAX_STRATEGIES,
  countMarketPipelineStrategies,
  getMaxSubmittedStrategies,
} from './lib/userPlan'
import { runMarketSubmissionCheck } from './lib/marketSubmissionGate'
import {
  fetchMySubscription,
  mergeSubscriptionIntoUser,
  startTrial,
  startPaidPlan,
  cancelMySubscription,
  SubscriptionServiceError,
} from './lib/subscriptionService'
import { loadUserStrategies, saveUserStrategies, upsertUserStrategy } from './lib/userStrategies'
import AdminReviewPage from './pages/AdminReviewPage'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { getCurrentSession, signInWithPassword, signOut } from './lib/authService'
import { ensureProfile } from './lib/profileService'
import { normalizeStrategyPayload } from './lib/strategyPayload'
import { getMyStrategies, createStrategy, updateStrategy, deleteStrategy, submitStrategy } from './lib/strategyService'
import { insertStrategyVersionSnapshot } from './lib/strategyVersionService'
import {
  createNotification,
  NOTIFICATION_TYPES,
  formatReviewApproved,
  formatReviewRejected,
  formatStrategySubmitted,
  formatStrategyUnderReview,
  formatSystemTrialStarted,
  formatSystemSubscribed,
  formatSystemCanceled,
} from './lib/notificationService'
import { useNotifications } from './hooks/useNotifications'
import { useInAppNotifications } from './context/InAppNotificationContext'
import { isAppNotificationId } from './lib/notificationModel'
import { setBrowserSignalNavigateHandler } from './lib/browserSignalNotify'
import { OPERATOR_STRATEGY_SIM_IDS } from './data/operatorStrategies'
import {
  DEFAULT_STRATEGY_NOTIFY,
  normalizeStrategyNotifySettings,
} from './lib/strategyNotificationSettings'

const VALID_APP_PAGES = new Set([
  'home', 'market', 'signal', 'validation', 'editor', 'mypage', 'admin', 'plans',
])

const LS_USER     = 'bb_user'
const LS_STRATEGY = 'bb_strategy'

/** localStorage에서 user 로드 (플랜은 로그인 후 Supabase subscriptions가 단일 소스) */
function loadUser() {
  try {
    const raw = localStorage.getItem(LS_USER)
    if (!raw) return { ...INITIAL_USER }

    const u = JSON.parse(raw)
    if (!u || typeof u !== 'object') return { ...INITIAL_USER }

    return {
      ...INITIAL_USER,
      ...u,
      strategyNotifySettings:
        u.strategyNotifySettings && typeof u.strategyNotifySettings === 'object'
          ? u.strategyNotifySettings
          : {},
    }
  } catch {
    return { ...INITIAL_USER }
  }
}

function loadStrategy() {
  try {
    return localStorage.getItem(LS_STRATEGY) || 'btc-trend'
  } catch {
    return 'btc-trend'
  }
}

export default function App() {
  const navigate = useNavigate()
  const { page: pageParam } = useParams()
  const page = VALID_APP_PAGES.has(pageParam) ? pageParam : 'home'

  function setPage(next) {
    navigate(`/app/${next}`)
  }

  useEffect(() => {
    if (!VALID_APP_PAGES.has(pageParam)) {
      navigate('/app/home', { replace: true })
    }
  }, [pageParam, navigate])

  const [isDark,             setIsDark]             = useState(() => {
    try {
      return localStorage.getItem('bb_theme') === 'dark'
    } catch {
      return false
    }
  })
  const [selectedStrategyId, setSelectedStrategyId] = useState(loadStrategy)
  const [user,               setUser]               = useState(loadUser)
  const [userStrategies,     setUserStrategies]     = useState(loadUserStrategies)
  const [isAdmin,            setIsAdmin]            = useState(false)
  const [editorInitData,     setEditorInitData]     = useState(null)
  const [editingStrategyId,  setEditingStrategyId]  = useState(null)
  /** 마켓·홈 상세에서「전략 복사하기」로 에디터 진입 시 코드·메타 프리필 (페이지 이탈 시 초기화) */
  const [editorMarketCopyPrefill, setEditorMarketCopyPrefill] = useState(null)
  const [currentUser,        setCurrentUser]        = useState(null)
  const [profile,            setProfile]            = useState(null)
  const [profileLoading,     setProfileLoading]     = useState(false)
  const [authError,          setAuthError]          = useState('')
  const [authLoading,        setAuthLoading]        = useState(false)
  const [strategiesLoading,  setStrategiesLoading]  = useState(false)
  const [strategiesError,    setStrategiesError]    = useState('')
  const [dataVersion,        setDataVersion]        = useState(0)
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState(false)
  const [subscriptionFeedback, setSubscriptionFeedback] = useState({ ok: '', err: '' })

  useEffect(() => {
    if (page !== 'editor') setEditorMarketCopyPrefill(null)
  }, [page])

  const supaReady = isSupabaseConfigured()

  const {
    notifications: serverNotifications,
    notificationsLoading,
    notificationsError,
    unreadNotificationCount: serverUnreadCount,
    handleReadNotification: handleServerNotificationRead,
    handleReadAllNotifications: handleServerNotificationsReadAll,
  } = useNotifications({
    supaReady,
    currentUserId: currentUser?.id,
    user,
  })

  const {
    items: inAppNotifications,
    markRead: markInAppNotificationRead,
    markAllRead: markAllInAppNotificationsRead,
    unreadCount: inAppUnreadCount,
  } = useInAppNotifications()

  const mergedNotifications = useMemo(() => {
    const merged = [...inAppNotifications, ...serverNotifications]
    merged.sort(
      (a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at),
    )
    return merged.slice(0, 100)
  }, [inAppNotifications, serverNotifications])

  const mergedUnreadCount = useMemo(
    () => mergedNotifications.filter((n) => !n.is_read).length,
    [mergedNotifications],
  )

  /** 브라우저 탭 제목: unread 시 (n) 접두, 미확인 없으면 기본 제목 복구 */
  const baseDocumentTitleRef = useRef(null)
  useEffect(() => {
    if (baseDocumentTitleRef.current === null) {
      baseDocumentTitleRef.current = document.title
    }
    const base = baseDocumentTitleRef.current
    const n = mergedUnreadCount
    document.title =
      n > 0 ? `(${n > 99 ? '99+' : n}) ${base}` : base
  }, [mergedUnreadCount])

  useEffect(() => {
    return () => {
      const b = baseDocumentTitleRef.current
      if (b != null) document.title = b
    }
  }, [])

  const notificationPanelLoading =
    notificationsLoading && mergedNotifications.length === 0

  const handleNotificationMarkRead = useCallback(
    (notificationId) => {
      if (isAppNotificationId(notificationId)) {
        markInAppNotificationRead(notificationId)
        return
      }
      handleServerNotificationRead(notificationId)
    },
    [markInAppNotificationRead, handleServerNotificationRead],
  )

  const handleNotificationMarkAllRead = useCallback(async () => {
    markAllInAppNotificationsRead()
    await handleServerNotificationsReadAll()
  }, [markAllInAppNotificationsRead, handleServerNotificationsReadAll])

  const notifyCreatorOnReview = useCallback(async (row, action, note = '') => {
    if (!supaReady || !row?.creator_id) return
    try {
      if (row.creator_id === currentUser?.id) return
      const payload =
        action === 'approve'
          ? formatReviewApproved(row.name ?? '전략')
          : formatReviewRejected(row.name ?? '전략', note)
      await createNotification({
        userId: row.creator_id,
        type: NOTIFICATION_TYPES.REVIEW_RESULT,
        title: payload.title,
        message: payload.message,
      })
    } catch {
      /* 알림 실패는 검수 플로우를 막지 않음 */
    }
  }, [supaReady, currentUser?.id])

  /* 다크모드 (+ /auth 등 앱 외 경로에서도 동일 테마 유지) */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem('bb_theme', isDark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [isDark])

  /* user → localStorage 자동 저장 */
  useEffect(() => {
    try { localStorage.setItem(LS_USER, JSON.stringify(user)) } catch {}
  }, [user])

  /* selectedStrategyId → localStorage 자동 저장 */
  useEffect(() => {
    try { localStorage.setItem(LS_STRATEGY, selectedStrategyId) } catch {}
  }, [selectedStrategyId])

  /* ── Supabase auth/session ───────────────────── */
  useEffect(() => {
    if (!supaReady || !supabase) return
    let unsub = null

    async function init() {
      try {
        setAuthLoading(true)
        const { session } = await getCurrentSession()
        setCurrentUser(session?.user ?? null)
      } catch (e) {
        setAuthError(e?.message ?? '인증 초기화 실패')
      } finally {
        setAuthLoading(false)
      }
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null)
    })
    unsub = () => sub?.subscription?.unsubscribe?.()

    return () => { try { unsub?.() } catch {} }
  }, [supaReady])

  /* ── profiles 조회/생성 ─────────────────────── */
  useEffect(() => {
    if (!supaReady || !supabase) return
    if (!currentUser?.id) { setProfile(null); return }

    let cancelled = false
    async function ensureProfileInner() {
      try {
        if (!cancelled) setProfileLoading(true)
        const p = await ensureProfile(currentUser)
        if (!cancelled) setProfile(p)
      } catch (e) {
        if (!cancelled) setAuthError(e?.message ?? '프로필 로드 실패')
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }

    ensureProfileInner()
    return () => { cancelled = true }
  }, [supaReady, currentUser?.id])

  const refreshSubscription = useCallback(async () => {
    if (!supaReady || !currentUser?.id) return
    try {
      const row = await fetchMySubscription(currentUser.id)
      setUser((prev) => mergeSubscriptionIntoUser(prev, row))
    } catch (e) {
      console.warn('구독 정보 동기화 실패:', e)
    }
  }, [supaReady, currentUser?.id])

  /* 로그인 시 subscriptions → user (DB 단일 소스) */
  useEffect(() => {
    refreshSubscription()
  }, [refreshSubscription])

  async function handleLogin(email, password) {
    if (!supaReady || !supabase) { setAuthError('Supabase 환경변수가 설정되지 않았습니다.'); return }
    if (!password) {
      setAuthError('비밀번호를 입력해 주세요.')
      return
    }
    try {
      setAuthError('')
      setAuthLoading(true)
      await signInWithPassword(email, password)
    } catch (e) {
      setAuthError(e?.message ?? '로그인 실패')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleLogout() {
    if (!supaReady || !supabase) return
    try {
      setAuthError('')
      setAuthLoading(true)
      await signOut()
      setCurrentUser(null)
      setProfile(null)
      setUserStrategies(loadUserStrategies())
      setUser(loadUser())
      setSubscriptionFeedback({ ok: '', err: '' })
      setDataVersion((v) => v + 1)
    } catch (e) {
      setAuthError(e?.message ?? '로그아웃 실패')
    } finally {
      setAuthLoading(false)
    }
  }

  async function refreshMyStrategies() {
    if (!supaReady || !supabase || !currentUser?.id) {
      setUserStrategies(loadUserStrategies())
      return
    }
    try {
      setStrategiesLoading(true)
      setStrategiesError('')
      const data = await getMyStrategies(currentUser.id)

      const local = loadUserStrategies()
      const merged = (data ?? []).map((row) => {
        const l = local.find((x) => x.id === row.id) ?? {}
        const base = {
          ...l,
          id: row.id,
          name: row.name,
          description: row.description ?? l.description ?? l.desc ?? '',
          strategy_summary: row.strategy_summary ?? l.strategy_summary ?? '',
          entry_logic: row.entry_logic ?? l.entry_logic ?? '',
          exit_logic: row.exit_logic ?? l.exit_logic ?? '',
          market_condition: row.market_condition ?? l.market_condition ?? '',
          risk_description: row.risk_description ?? l.risk_description ?? '',
          strategy_pdf_path: row.strategy_pdf_path ?? l.strategy_pdf_path ?? null,
          strategy_pdf_preview_path: row.strategy_pdf_preview_path ?? l.strategy_pdf_preview_path ?? null,
          strategy_preview_mode: row.strategy_preview_mode ?? l.strategy_preview_mode ?? 'none',
          asset: row.asset,
          timeframe: row.timeframe,
          mode: row.mode,
          riskLevel: row.risk_level ?? l.riskLevel ?? 'mid',
          tags: Array.isArray(row.tags) ? row.tags : (l.tags ?? []),
          code: row.code ?? l.code ?? '',
          conditions: row.conditions ?? l.conditions ?? [],
          risk_config: row.risk_config ?? l.risk_config ?? {},
          type: row.type ?? l.type ?? 'signal',
          version_no: row.version_no ?? l.version_no ?? 1,
          backtest_meta: row.backtest_meta ?? l.backtest_meta ?? {},
          performance: row.performance ?? l.performance ?? {},
          method_pdf_path: row.method_pdf_path ?? l.method_pdf_path ?? null,
          method_pdf_preview_path: row.method_pdf_preview_path ?? l.method_pdf_preview_path ?? null,
          method_preview_mode: row.method_preview_mode ?? l.method_preview_mode ?? 'none',
          linked_signal_strategy_id: row.linked_signal_strategy_id ?? l.linked_signal_strategy_id ?? null,
          createdAt: l.createdAt ?? (row.created_at ? Date.parse(row.created_at) : Date.now()),
          updatedAt: row.updated_at ? Date.parse(row.updated_at) : (l.updatedAt ?? Date.now()),
        }
        const n = normalizeStrategyPayload(base)
        return {
          ...l,
          ...n,
          id: row.id,
          creator: 'me',
          creator_id: row.creator_id,
          typeLabel: (row.type ?? l.type ?? 'signal') === 'method' ? '매매법' : '전략',
          strategyType: row.strategy_type ?? l.strategyType ?? 'trend',
          strategyTypeLabel: l.strategyTypeLabel ?? '사용자 전략',
          status: row.status,
          is_public: row.status === 'approved' || row.status === 'published',
          reviewNote: row.review_note ?? l.reviewNote ?? '',
          isUserStrategy: true,
          roi: l.roi ?? 0,
          winRate: l.winRate ?? 0,
          mdd: l.mdd ?? 0,
          trades: l.trades ?? 0,
          recommendBadge: l.recommendBadge ?? null,
          ctaStatus: l.ctaStatus ?? 'not_started',
          author: l.author ?? '나',
          fitSummary: l.fitSummary ?? '사용자 전략',
        }
      })

      setUserStrategies(merged)
      try {
        saveUserStrategies(merged)
      } catch {
        /* 캐시 실패는 무시 — Supabase가 단일 소스 */
      }
    } catch (e) {
      setStrategiesError(e?.message ?? '전략 로드 실패')
      setUserStrategies(loadUserStrategies())
    } finally {
      setStrategiesLoading(false)
    }
  }

  /* 로그인 시 내 전략 fetch */
  useEffect(() => {
    refreshMyStrategies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  /** 전략 선택 후 모의투자 페이지 이동 */
  function handleGoSignal(strategyId) {
    const mapped = typeof strategyId === 'string' && OPERATOR_STRATEGY_SIM_IDS[strategyId]
      ? OPERATOR_STRATEGY_SIM_IDS[strategyId]
      : strategyId
    if (mapped) setSelectedStrategyId(mapped)
    setPage('signal')
  }

  const handleStrategyNotifySettingsChange = useCallback((strategyId, patch) => {
    setUser((prev) => {
      const sid = String(strategyId ?? '')
      if (!sid) return prev
      const prevMap = prev.strategyNotifySettings && typeof prev.strategyNotifySettings === 'object'
        ? prev.strategyNotifySettings
        : {}
      const cur = normalizeStrategyNotifySettings(prevMap[sid])
      return {
        ...prev,
        strategyNotifySettings: {
          ...prevMap,
          [sid]: { ...DEFAULT_STRATEGY_NOTIFY, ...cur, ...patch },
        },
      }
    })
  }, [])

  const handleGoSignalRef = useRef(handleGoSignal)
  handleGoSignalRef.current = handleGoSignal

  useEffect(() => {
    setBrowserSignalNavigateHandler((id) => {
      if (id == null || id === '') return
      handleGoSignalRef.current(id)
    })
    return () => setBrowserSignalNavigateHandler(null)
  }, [])

  /** 전략 검증 페이지 이동 */
  function handleGoValidation(strategyId) {
    if (strategyId) setSelectedStrategyId(strategyId)
    setPage('validation')
  }

  /** 인앱 알림 클릭 → 시그널(전략 선택)·마이페이지 등 */
  function handleNotificationNavigate(target) {
    if (!target?.page) return
    try {
      if (target.section) {
        sessionStorage.setItem('bb_mypage_section', target.section)
      }
    } catch {
      /* ignore */
    }
    if (target.page === 'signal' && target.strategyId) {
      handleGoSignal(target.strategyId)
      return
    }
    if (target.page === 'signal') {
      setPage('signal')
      return
    }
    setPage(target.page)
  }

  /**
   * 7일 무료 체험 (subscriptions.startTrial → merge)
   * @param {string} [strategyId] 마켓/시뮬에서 잠금 해제용으로 unlockedStrategyIds에 추가
   */
  async function handleStartTrial(strategyId) {
    const sid = typeof strategyId === 'string' && strategyId.length > 0 ? strategyId : null
    if (!supaReady || !currentUser?.id) {
      setAuthError('체험을 시작하려면 Supabase에 로그인해 주세요.')
      return
    }
    setSubscriptionFeedback({ ok: '', err: '' })
    setSubscriptionActionLoading(true)
    try {
      setAuthError('')
      await startTrial(currentUser.id)
      const row = await fetchMySubscription(currentUser.id)
      setUser((prev) => {
        const merged = mergeSubscriptionIntoUser(prev, row)
        if (sid == null) return merged
        return {
          ...merged,
          unlockedStrategyIds: [...new Set([...(merged.unlockedStrategyIds ?? []), sid])],
        }
      })
      setSubscriptionFeedback({ ok: '7일 무료 체험이 시작되었습니다.', err: '' })
      try {
        await createNotification({
          userId: currentUser.id,
          type: NOTIFICATION_TYPES.SYSTEM,
          ...formatSystemTrialStarted(),
        })
      } catch {
        /* ignore */
      }
    } catch (e) {
      const msg = e instanceof SubscriptionServiceError
        ? e.message
        : (e?.message ?? '체험 시작에 실패했습니다.')
      setAuthError(msg)
      setSubscriptionFeedback({ ok: '', err: msg })
    } finally {
      setSubscriptionActionLoading(false)
    }
  }

  /**
   * mock 유료 전환 (startPaidPlan → merge) + billingTier(pro|premium)
   * 이미 Pro 구독 중이면 Premium만 클라이언트 티어 업그레이드 (DB는 추후 메타 컬럼으로 이전 가능)
   */
  async function handleSubscribe(billingTier = 'pro') {
    if (!supaReady || !currentUser?.id) {
      setAuthError('로그인 후 이용할 수 있습니다.')
      return
    }
    setSubscriptionFeedback({ ok: '', err: '' })
    setSubscriptionActionLoading(true)
    try {
      setAuthError('')
      const wantPremium = billingTier === 'premium'
      if (user?.plan === 'subscribed') {
        const cur = user?.billingTier === 'premium' ? 'premium' : 'pro'
        if (wantPremium && cur === 'pro') {
          setUser((prev) => ({ ...prev, billingTier: 'premium' }))
          setSubscriptionFeedback({ ok: 'Premium 혜택이 적용되었습니다. (결제 연동 시 영수증·기간이 함께 표시됩니다.)', err: '' })
          return
        }
      }
      await startPaidPlan(currentUser.id, 'subscribed')
      const row = await fetchMySubscription(currentUser.id)
      setUser((prev) => {
        const merged = mergeSubscriptionIntoUser(prev, row)
        return {
          ...merged,
          billingTier: wantPremium ? 'premium' : 'pro',
        }
      })
      setSubscriptionFeedback({ ok: '유료 플랜이 활성화되었습니다.', err: '' })
      try {
        await createNotification({
          userId: currentUser.id,
          type: NOTIFICATION_TYPES.SYSTEM,
          ...formatSystemSubscribed(),
        })
      } catch {
        /* ignore */
      }
    } catch (e) {
      const msg = e instanceof SubscriptionServiceError
        ? e.message
        : (e?.message ?? '구독 처리에 실패했습니다.')
      setAuthError(msg)
      setSubscriptionFeedback({ ok: '', err: msg })
    } finally {
      setSubscriptionActionLoading(false)
    }
  }

  async function handleCancelSubscription() {
    if (!supaReady || !currentUser?.id) return
    setSubscriptionFeedback({ ok: '', err: '' })
    setSubscriptionActionLoading(true)
    try {
      await cancelMySubscription(currentUser.id)
      const row = await fetchMySubscription(currentUser.id)
      setUser((prev) => mergeSubscriptionIntoUser(prev, row))
      setSubscriptionFeedback({ ok: '구독이 해지되었습니다. 무료 플랜 제한이 다시 적용됩니다.', err: '' })
      try {
        await createNotification({
          userId: currentUser.id,
          type: NOTIFICATION_TYPES.SYSTEM,
          ...formatSystemCanceled(),
        })
      } catch {
        /* ignore */
      }
    } catch (e) {
      const msg = e instanceof SubscriptionServiceError
        ? e.message
        : (e?.message ?? '해지 처리에 실패했습니다.')
      setSubscriptionFeedback({ ok: '', err: msg })
    } finally {
      setSubscriptionActionLoading(false)
    }
  }

  /**
   * 전략 에디터에서 저장 (임시/제출 공통)
   * @param {object} data   EditorPage 폼 데이터
   * @param {'draft'|'submitted'} status
   * @returns {object}  저장된 전략 객체
   */
  function isUuidLike(id) {
    return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  }

  async function handleSaveStrategy(data, status = 'draft') {
    if (supaReady && !currentUser?.id) {
      setAuthError('로그인 후 저장/제출할 수 있습니다.')
      return null
    }

    const editingExisting = isUuidLike(data?.id)
    const savedCount = userStrategies.length

    if (status === 'submitted') {
      if (!canSubmitStrategyToMarket(user)) {
        const msg = PLAN_MESSAGES.marketSubmitProOnly
        setAuthError(msg)
        setStrategiesError(msg)
        return null
      }
      if (wouldExceedMarketPipelineCap(userStrategies, data?.id ?? null, true)) {
        const msg = PLAN_MESSAGES.marketPipelineCap(MARKET_PIPELINE_MAX_STRATEGIES)
        setAuthError(msg)
        setStrategiesError(msg)
        return null
      }
      const check = await runMarketSubmissionCheck(normalizeStrategyPayload(data))
      if (!check.isValid) {
        const msg = check.errors.join('\n')
        setAuthError(check.errors[0] ?? '자동 검증 실패')
        setStrategiesError(msg)
        return null
      }
    }

    if (!canSaveNewStrategy(user, savedCount, editingExisting)) {
      const msg = PLAN_MESSAGES.saveLimit
      setAuthError(msg)
      setStrategiesError(msg)
      return null
    }
    setStrategiesError('')
    setAuthError('')

    const local = upsertUserStrategy(data, status)
    const saved = normalizeStrategyPayload(local)
    setUserStrategies(loadUserStrategies())

    if (!supaReady || !currentUser?.id) return local

    try {
      const rc = saved.risk_config ?? {}
      const isEditingUuid = isUuidLike(data?.id)
      const prevRow = isEditingUuid
        ? (userStrategies.find((s) => s.id === data.id) ?? null)
        : null
      const nextVersionNo = isEditingUuid
        ? (Number(prevRow?.version_no ?? prevRow?.versionNo ?? 1) + 1)
        : 1

      // 제출 시점에는 백테스트 메타/성과를 고정 저장 (재현성/신뢰 확보)
      let backtestMeta = saved.backtest_meta ?? null
      let performance = saved.performance ?? null
      let engineTrades = saved.engine_trades ?? null
      if (status === 'submitted') {
        const check = await runMarketSubmissionCheck(saved)
        backtestMeta = check.backtestMeta ?? backtestMeta
        performance = check.performance ?? performance
        engineTrades = Array.isArray(check.trades) ? check.trades : engineTrades
      }

      const payload = {
        creator_id: currentUser.id,
        type: saved.type ?? 'signal',
        version_no: nextVersionNo,
        name: saved.name,
        description: saved.description ?? '',
        strategy_summary: saved.strategy_summary ?? '',
        entry_logic: saved.entry_logic ?? '',
        exit_logic: saved.exit_logic ?? '',
        market_condition: saved.market_condition ?? '',
        risk_description: saved.risk_description ?? '',
        backtest_meta: backtestMeta ?? {},
        performance: performance ?? {},
        engine_trades: Array.isArray(engineTrades) ? engineTrades : [],
        live_trading_text: saved.live_trading_text ?? '',
        strategy_pdf_path: saved.strategy_pdf_path ?? null,
        strategy_pdf_preview_path: saved.strategy_pdf_preview_path ?? null,
        strategy_pdf_url: saved.strategy_pdf_url ?? null,
        strategy_preview_mode: saved.strategy_preview_mode ?? 'none',
        asset: saved.asset ?? 'BTC',
        timeframe: saved.timeframe || '1h',
        mode: 'code',
        strategy_type: local.strategyType ?? 'trend',
        risk_level: saved.riskLevel ?? 'mid',
        status: status,
        tags: Array.isArray(saved.tags) ? saved.tags : [],
        code: saved.code ?? '',
        conditions: saved.conditions ?? [],
        risk_config: {
          stopType: rc.stopType ?? 'fixed_pct',
          stopValue: rc.stopValue ?? '',
          takeProfitPct: rc.takeProfitPct ?? '',
          posSize: rc.posSize ?? '',
          maxOpenPos: rc.maxOpenPos ?? '1',
          minSignalGap: rc.minSignalGap ?? '',
          allowReentry: !!rc.allowReentry,
          ...(saved.conditionLogic != null ? { conditionLogic: saved.conditionLogic } : {}),
        },
        method_pdf_path: saved.method_pdf_path ?? null,
        method_pdf_preview_path: saved.method_pdf_preview_path ?? null,
        method_preview_mode: saved.method_preview_mode ?? 'none',
        linked_signal_strategy_id: saved.linked_signal_strategy_id ?? null,
        review_note: status === 'submitted' ? '' : (local.reviewNote ?? ''),
      }

      if (isUuidLike(data?.id)) {
        const updated = await updateStrategy(data.id, payload)
        // 버전 스냅샷 저장 (이전 결과 유지)
        try {
          await insertStrategyVersionSnapshot({
            strategyId: data.id,
            versionNo: nextVersionNo,
            code: payload.code ?? '',
            snapshot: {
              payload: {
                name: payload.name,
                type: payload.type,
                asset: payload.asset,
                timeframe: payload.timeframe,
                mode: payload.mode,
                strategy_type: payload.strategy_type,
                risk_level: payload.risk_level,
                tags: payload.tags,
                conditions: payload.conditions,
                risk_config: payload.risk_config,
                strategy_summary: payload.strategy_summary,
                entry_logic: payload.entry_logic,
                exit_logic: payload.exit_logic,
                market_condition: payload.market_condition,
                risk_description: payload.risk_description,
              },
              backtest_meta: updated?.backtest_meta ?? payload.backtest_meta ?? {},
              performance: updated?.performance ?? payload.performance ?? {},
              saved_at: new Date().toISOString(),
            },
          })
        } catch {
          // 스냅샷 저장 실패는 저장 플로우를 막지 않음
        }
      } else {
        const created = await createStrategy(payload)
        try {
          await insertStrategyVersionSnapshot({
            strategyId: created.id,
            versionNo: 1,
            code: payload.code ?? '',
            snapshot: {
              payload: {
                name: payload.name,
                type: payload.type,
                asset: payload.asset,
                timeframe: payload.timeframe,
                mode: payload.mode,
                strategy_type: payload.strategy_type,
                risk_level: payload.risk_level,
                tags: payload.tags,
                conditions: payload.conditions,
                risk_config: payload.risk_config,
                strategy_summary: payload.strategy_summary,
                entry_logic: payload.entry_logic,
                exit_logic: payload.exit_logic,
                market_condition: payload.market_condition,
                risk_description: payload.risk_description,
              },
              backtest_meta: created?.backtest_meta ?? payload.backtest_meta ?? {},
              performance: created?.performance ?? payload.performance ?? {},
              saved_at: new Date().toISOString(),
            },
          })
        } catch {
          // ignore
        }
        const all = loadUserStrategies()
        const replaced = all.map((s) => (s.id === local.id ? { ...s, id: created.id } : s))
        try { localStorage.setItem('bb_user_strategies', JSON.stringify(replaced)) } catch {}
        setUserStrategies(replaced)
        setEditingStrategyId(created.id)
      }

      await refreshMyStrategies()
      if (status === 'submitted') {
        try {
          await createNotification({
            userId: currentUser.id,
            type: NOTIFICATION_TYPES.STRATEGY_UPDATE,
            ...formatStrategySubmitted(saved.name || '전략'),
          })
        } catch {
          /* ignore */
        }
      }
      setDataVersion((v) => v + 1)
    } catch (e) {
      setAuthError(e?.message ?? 'Supabase 저장 실패 (localStorage로 유지됨)')
      throw e
    }

    return local
  }

  async function handleDeleteStrategy(id) {
    if (!supaReady) return
    if (!currentUser?.id) { setAuthError('로그인 후 삭제할 수 있습니다.'); return }
    try {
      setAuthError('')
      await deleteStrategy(id)
      await refreshMyStrategies()
      setDataVersion((v) => v + 1)
    } catch (e) {
      setAuthError(e?.message ?? '삭제 실패')
    }
  }

  async function handleSubmitStrategy(id) {
    if (!supaReady) return
    if (!currentUser?.id) { setAuthError('로그인 후 제출할 수 있습니다.'); return }
    const strat = userStrategies.find((s) => s.id === id)
    if (!strat) {
      setAuthError('전략을 찾을 수 없습니다.')
      return
    }
    if (!canSubmitStrategyToMarket(user)) {
      setAuthError(PLAN_MESSAGES.marketSubmitProOnly)
      setStrategiesError(PLAN_MESSAGES.marketSubmitProOnly)
      return
    }
    if (wouldExceedMarketPipelineCap(userStrategies, id, true)) {
      const msg = PLAN_MESSAGES.marketPipelineCap(MARKET_PIPELINE_MAX_STRATEGIES)
      setAuthError(msg)
      setStrategiesError(msg)
      return
    }
    const check = await runMarketSubmissionCheck(normalizeStrategyPayload(strat))
    if (!check.isValid) {
      setAuthError(check.errors[0] ?? '자동 검증 실패')
      setStrategiesError(check.errors.join('\n'))
      return
    }
    try {
      setAuthError('')
      setStrategiesError('')
      const row = await updateStrategy(id, {
        status: 'submitted',
        review_note: '',
        backtest_meta: check.backtestMeta ?? {},
        performance: check.performance ?? {},
        engine_trades: Array.isArray(check.trades) ? check.trades : [],
      })
      const name = row?.name ?? userStrategies.find((s) => s.id === id)?.name ?? '전략'
      try {
        await createNotification({
          userId: currentUser.id,
          type: NOTIFICATION_TYPES.STRATEGY_UPDATE,
          ...formatStrategySubmitted(name),
        })
      } catch {
        /* ignore */
      }
      await refreshMyStrategies()
      setDataVersion((v) => v + 1)
    } catch (e) {
      setAuthError(e?.message ?? '제출 실패')
    }
  }

  /** 검수 액션 (어드민) */
  async function handleReviewAction(id, action, note) {
    if (!supaReady || !currentUser?.id) {
      setAuthError('로그인 후 검수할 수 있습니다.')
      return
    }

    try {
      setAuthError('')
      setStrategiesError('')

      if (action === 'approve') {
        const row = await updateStrategy(id, {
          status: 'approved',
          review_note: '',
        })
        await notifyCreatorOnReview(row, 'approve')
      } else if (action === 'reject') {
        const row = await updateStrategy(id, {
          status: 'rejected',
          review_note: note ?? '',
        })
        await notifyCreatorOnReview(row, 'reject', note ?? '')
      } else if (action === 'under_review') {
        const row = await updateStrategy(id, {
          status: 'under_review',
        })
        if (row?.creator_id && row.creator_id !== currentUser?.id) {
          try {
            await createNotification({
              userId: row.creator_id,
              type: NOTIFICATION_TYPES.STRATEGY_UPDATE,
              ...formatStrategyUnderReview(row.name ?? '전략'),
            })
          } catch {
            /* ignore */
          }
        }
      }

      await refreshMyStrategies()
      setDataVersion((v) => v + 1)
    } catch (e) {
      setStrategiesError(e?.message ?? '검수 처리 실패')
    }
  }

  /** 반려된 전략 에디터로 불러오기 */
  function handleEditStrategy(strategyId) {
    const strat = userStrategies.find((s) => s.id === strategyId)
    if (!strat) return
    setEditorMarketCopyPrefill(null)
    setEditorInitData(normalizeStrategyPayload(strat))
    setEditingStrategyId(strategyId)
    setPage('editor')
  }

  /** 마켓/홈 상세: 코드 복사 후 에디터로 이동·삽입 */
  function handleCopyStrategyToEditor(strategy) {
    const code = String(strategy?.code ?? '').trim()
    if (!code) return
    setEditorInitData(null)
    setEditingStrategyId(null)
    setEditorMarketCopyPrefill({
      code,
      nameHint: strategy?.name,
      asset: strategy?.asset,
      timeframe: strategy?.timeframe,
    })
    setPage('editor')
  }

  async function handleApproveForTest(strategyId) {
    if (!supaReady || !currentUser?.id) { setAuthError('로그인 후 승인 테스트가 가능합니다.'); return }
    try {
      setAuthError('')
      const row = await updateStrategy(strategyId, { status: 'approved' })
      await notifyCreatorOnReview(row, 'approve')
      await refreshMyStrategies()
      setDataVersion((v) => v + 1)
    } catch (e) {
      setStrategiesError(e?.message ?? '승인 테스트 실패')
    }
  }

  function renderPage() {
    switch (page) {
      case 'market':
        return (
          <EditorErrorBoundary>
            <MarketPage
              onNavigate={setPage}
              onGoSimulation={handleGoSignal}
              onGoValidation={handleGoValidation}
              user={user}
              onStartTrial={handleStartTrial}
              onSubscribe={() => setPage('plans')}
              dataVersion={dataVersion}
              onCopyStrategyToEditor={handleCopyStrategyToEditor}
              onGoSubscription={() => setPage('plans')}
            />
          </EditorErrorBoundary>
        )
      case 'signal':
        return (
          <EditorErrorBoundary>
            <SignalPage
              initialStrategyId={selectedStrategyId}
              user={user}
              onStartTrial={handleStartTrial}
              onSubscribe={handleSubscribe}
              userStrategies={userStrategies}
              currentUser={currentUser}
              onNavigate={setPage}
              onGoValidation={handleGoValidation}
              onStrategyNotifySettingsChange={handleStrategyNotifySettingsChange}
            />
          </EditorErrorBoundary>
        )
      case 'validation':
        return (
          <EditorErrorBoundary>
            <ValidationPage
              onNavigate={setPage}
              onGoSimulation={handleGoSignal}
              selectedStrategyId={selectedStrategyId}
              user={user}
              onStartTrial={handleStartTrial}
              userStrategies={userStrategies}
            />
          </EditorErrorBoundary>
        )
      case 'home':
        return (
          <EditorErrorBoundary>
            <HomePage
              onNavigate={setPage}
              onGoSimulation={handleGoSignal}
              onStartTrial={handleStartTrial}
              onSubscribe={() => setPage('plans')}
              dataVersion={dataVersion}
              user={user}
              userStrategies={userStrategies}
              signalStrategyId={selectedStrategyId}
              retentionUserKey={currentUser?.id ?? 'local'}
              onCopyStrategyToEditor={handleCopyStrategyToEditor}
              onGoSubscription={() => setPage('plans')}
            />
          </EditorErrorBoundary>
        )
      case 'editor':
        return (
          <EditorErrorBoundary>
            <EditorPage
              onSaveStrategy={handleSaveStrategy}
              onNavigate={setPage}
              onRunStrategy={handleGoSignal}
              initialData={editorInitData}
              marketCopyPrefill={editorMarketCopyPrefill}
              editingStrategyId={editingStrategyId}
              currentUser={currentUser}
              userStrategies={userStrategies}
              saveLoading={strategiesLoading}
              saveErrorMessage={strategiesError || authError}
              user={user}
              savedStrategyCount={userStrategies.length}
              canSubmitToMarket={canSubmitStrategyToMarket(user)}
              marketPipelineCount={countMarketPipelineStrategies(userStrategies)}
              maxMarketSlots={getMaxSubmittedStrategies(user)}
              editingStrategyStatus={
                editingStrategyId
                  ? userStrategies.find((s) => s.id === editingStrategyId)?.status ?? null
                  : null
              }
              editingReviewNote={
                editingStrategyId
                  ? userStrategies.find((s) => s.id === editingStrategyId)?.reviewNote ?? ''
                  : ''
              }
              userPlanKind={user?.plan ?? 'free'}
              onSubscribe={handleSubscribe}
              onStartTrial={handleStartTrial}
            />
          </EditorErrorBoundary>
        )
      case 'plans':
        return (
          <EditorErrorBoundary>
            <PlansPage
              user={user}
              currentUser={currentUser}
              supaReady={supaReady}
              onNavigate={setPage}
              onStartTrial={() => handleStartTrial()}
              onSubscribe={handleSubscribe}
              subscriptionActionLoading={subscriptionActionLoading}
              subscriptionFeedback={subscriptionFeedback}
              onGoAuth={() => navigate('/auth?mode=login')}
            />
          </EditorErrorBoundary>
        )
      case 'mypage':
        return (
          <EditorErrorBoundary>
            <MyPage
              user={user}
              userStrategies={userStrategies}
              onEditStrategy={handleEditStrategy}
              onNavigate={setPage}
              onGoPlans={() => setPage('plans')}
              currentUser={currentUser}
              profile={profile}
              authError={authError}
              onLogout={handleLogout}
              onRefreshStrategies={refreshMyStrategies}
              authLoading={authLoading}
              onDeleteStrategy={handleDeleteStrategy}
              onSubmitStrategy={handleSubmitStrategy}
              onApproveForTest={handleApproveForTest}
              strategiesLoading={strategiesLoading}
              strategiesError={strategiesError}
              profileLoading={profileLoading}
              supaReady={supaReady}
              onRefreshSubscription={refreshSubscription}
              subscriptionActionLoading={subscriptionActionLoading}
              subscriptionFeedback={subscriptionFeedback}
              onSubscriptionTrial={() => handleStartTrial()}
              onSubscriptionUpgrade={handleSubscribe}
              onSubscriptionCancel={handleCancelSubscription}
            />
          </EditorErrorBoundary>
        )
      case 'admin':
        return (
          <EditorErrorBoundary>
            {isAdmin ? (
              <AdminReviewPage
                currentUser={currentUser}
                supaReady={supaReady}
                dataVersion={dataVersion}
                onReviewAction={handleReviewAction}
              />
            ) : (
              <HomePage
                onNavigate={setPage}
                onGoSimulation={handleGoSignal}
                onStartTrial={handleStartTrial}
                onSubscribe={() => setPage('plans')}
                dataVersion={dataVersion}
                user={user}
                userStrategies={userStrategies}
                signalStrategyId={selectedStrategyId}
                retentionUserKey={currentUser?.id ?? 'local'}
                onCopyStrategyToEditor={handleCopyStrategyToEditor}
                onGoSubscription={() => setPage('plans')}
              />
            )}
          </EditorErrorBoundary>
        )
      default:
        return (
          <HomePage
            onNavigate={setPage}
            onGoSimulation={handleGoSignal}
            onStartTrial={handleStartTrial}
            onSubscribe={() => setPage('plans')}
            dataVersion={dataVersion}
            user={user}
            userStrategies={userStrategies}
            signalStrategyId={selectedStrategyId}
            retentionUserKey={currentUser?.id ?? 'local'}
            onCopyStrategyToEditor={handleCopyStrategyToEditor}
            onGoSubscription={() => setPage('plans')}
          />
        )
    }
  }

  return (
    <AppLayout
      currentPage={page}
      onNavigate={setPage}
      onLandingNavigate={() => navigate('/')}
      isDark={isDark}
      onToggleDark={() => setIsDark((d) => !d)}
      user={user}
      isAdmin={isAdmin}
      onToggleAdmin={() => setIsAdmin((v) => !v)}
      currentUser={currentUser}
      profile={profile}
      authLoading={authLoading}
      authError={authError}
      onLogout={handleLogout}
      supaReady={supaReady}
      notifications={mergedNotifications}
      unreadNotificationCount={mergedUnreadCount}
      notificationsLoading={notificationPanelLoading}
      notificationsError={notificationsError}
      onNotificationMarkRead={handleNotificationMarkRead}
      onNotificationMarkAllRead={handleNotificationMarkAllRead}
      onNotificationNavigate={handleNotificationNavigate}
    >
      {renderPage()}
    </AppLayout>
  )
}

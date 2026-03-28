import { useState, useEffect } from 'react'
import AppLayout from './components/layout/AppLayout'
import HomePage       from './pages/HomePage'
import MarketPage     from './pages/MarketPage'
import SimulationPage from './pages/SimulationPage'
import ValidationPage from './pages/ValidationPage'
import EditorPage     from './pages/EditorPage'
import MyPage         from './pages/MyPage'
import { INITIAL_USER, TRIAL_DAYS } from './lib/userPlan'
import { loadUserStrategies, upsertUserStrategy } from './lib/userStrategies'
import AdminReviewPage from './pages/AdminReviewPage'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { getCurrentSession, signInWithOtp, signOut } from './lib/authService'
import { ensureProfile } from './lib/profileService'
import { getMyStrategies, createStrategy, updateStrategy, deleteStrategy, submitStrategy } from './lib/strategyService'

const LS_USER     = 'bb_user'
const LS_STRATEGY = 'bb_strategy'
const LS_LASTLOAD = 'bb_lastload'

/**
 * localStorage에서 user 상태 로드
 * - 체험 중이고 30초 이상 경과했으면 체험 일수 1 감소 (mock 1일 경과)
 * - trialDaysLeft 0 도달 시 plan → 'free' 로 복귀
 */
function loadUser() {
  try {
    const raw = localStorage.getItem(LS_USER)
    if (!raw) return INITIAL_USER

    const u = JSON.parse(raw)
    if (!u || typeof u !== 'object') return INITIAL_USER

    const lastLoad = parseInt(localStorage.getItem(LS_LASTLOAD) || '0', 10)
    const now = Date.now()

    /* 체험 일수 mock 감소: 30초 경과를 "하루 지남"으로 처리 */
    if (u.plan === 'trial' && u.trialDaysLeft > 0 && now - lastLoad > 30_000) {
      const newDays = u.trialDaysLeft - 1
      return {
        ...u,
        trialDaysLeft: newDays,
        plan: newDays <= 0 ? 'free' : 'trial',
      }
    }

    return u
  } catch {
    return INITIAL_USER
  } finally {
    try { localStorage.setItem(LS_LASTLOAD, String(Date.now())) } catch {}
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
  const [page,               setPage]               = useState('home')
  const [isDark,             setIsDark]             = useState(false)
  const [selectedStrategyId, setSelectedStrategyId] = useState(loadStrategy)
  const [user,               setUser]               = useState(loadUser)
  const [userStrategies,     setUserStrategies]     = useState(loadUserStrategies)
  const [isAdmin,            setIsAdmin]            = useState(false)
  const [editorInitData,     setEditorInitData]     = useState(null)
  const [editingStrategyId,  setEditingStrategyId]  = useState(null)
  const [currentUser,        setCurrentUser]        = useState(null)
  const [profile,            setProfile]            = useState(null)
  const [profileLoading,     setProfileLoading]     = useState(false)
  const [authError,          setAuthError]          = useState('')
  const [authLoading,        setAuthLoading]        = useState(false)
  const [strategiesLoading,  setStrategiesLoading]  = useState(false)
  const [strategiesError,    setStrategiesError]    = useState('')
  const [dataVersion,        setDataVersion]        = useState(0)

  const supaReady = isSupabaseConfigured()

  /* 다크모드 */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
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

  async function handleLogin(email) {
    if (!supaReady || !supabase) { setAuthError('Supabase 환경변수가 설정되지 않았습니다.'); return }
    try {
      setAuthError('')
      setAuthLoading(true)
      await signInWithOtp(email)
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
        return {
          ...l,
          id: row.id,
          creator: 'me',
          creator_id: row.creator_id,
          name: row.name,
          desc: row.description ?? l.desc ?? '',
          asset: row.asset,
          timeframe: row.timeframe,
          mode: row.mode,
          type: row.strategy_type ?? l.type ?? 'trend',
          typeLabel: l.typeLabel ?? '사용자 전략',
          riskLevel: row.risk_level ?? l.riskLevel ?? 'mid',
          status: row.status,
          reviewNote: row.review_note ?? l.reviewNote ?? '',
          tags: Array.isArray(row.tags) ? row.tags : (l.tags ?? []),
          code: row.code ?? l.code ?? '',
          conditions: row.conditions ?? l.conditions ?? [],
          risk_config: row.risk_config ?? l.risk_config ?? {},
          createdAt: l.createdAt ?? (row.created_at ? Date.parse(row.created_at) : Date.now()),
          updatedAt: row.updated_at ? Date.parse(row.updated_at) : (l.updatedAt ?? Date.now()),
          isUserStrategy: true,
          /* UI 안전 기본값 */
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
  function handleGoSimulation(strategyId) {
    if (strategyId) setSelectedStrategyId(strategyId)
    setPage('simulation')
  }

  /**
   * 7일 무료 체험 시작
   * - plan → 'trial'
   * - 현재 전략을 unlockedStrategyIds에 추가
   */
  function handleStartTrial(strategyId) {
    setUser((prev) => ({
      plan:                'trial',
      trialDaysLeft:       TRIAL_DAYS,
      unlockedStrategyIds: [
        ...new Set([...(prev.unlockedStrategyIds ?? []), strategyId ?? selectedStrategyId]),
      ],
    }))
  }

  /** 구독 전환 */
  function handleSubscribe() {
    setUser((prev) => ({ ...prev, plan: 'subscribed' }))
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

    const local = upsertUserStrategy(data, status)
    setUserStrategies(loadUserStrategies())
    setStrategiesError('')

    if (!supaReady || !currentUser?.id) return local

    try {
      const payload = {
        creator_id: currentUser.id,
        name: local.name,
        description: local.desc ?? '',
        asset: local.asset ?? 'BTC',
        timeframe: local.timeframe || '1h',
        mode: local.mode || 'nocode',
        strategy_type: local.type ?? 'trend',
        risk_level: local.riskLevel ?? 'mid',
        status: status,
        tags: Array.isArray(local.tags) ? local.tags : [],
        code: local.code ?? '',
        conditions: local.conditions ?? [],
        risk_config: {
          stopType: local.stopType ?? 'fixed_pct',
          stopValue: local.stopValue ?? '',
          takeProfitPct: local.takeProfitPct ?? '',
          posSize: local.posSize ?? '',
          maxOpenPos: local.maxOpenPos ?? '1',
        },
        review_note: status === 'submitted' ? '' : (local.reviewNote ?? ''),
      }

      if (isUuidLike(data?.id)) {
        await updateStrategy(data.id, payload)
      } else {
        const created = await createStrategy(payload)
        const all = loadUserStrategies()
        const replaced = all.map((s) => (s.id === local.id ? { ...s, id: created.id } : s))
        try { localStorage.setItem('bb_user_strategies', JSON.stringify(replaced)) } catch {}
        setUserStrategies(replaced)
        setEditingStrategyId(created.id)
      }

      await refreshMyStrategies()
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
    try {
      setAuthError('')
      await submitStrategy(id)
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
        await updateStrategy(id, {
          status: 'approved',
          review_note: '',
        })
      } else if (action === 'reject') {
        await updateStrategy(id, {
          status: 'rejected',
          review_note: note ?? '',
        })
      } else if (action === 'under_review') {
        await updateStrategy(id, {
          status: 'under_review',
        })
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
    setEditorInitData(strat)
    setEditingStrategyId(strategyId)
    setPage('editor')
  }

  async function handleApproveForTest(strategyId) {
    if (!supaReady || !currentUser?.id) { setAuthError('로그인 후 승인 테스트가 가능합니다.'); return }
    try {
      setAuthError('')
      await updateStrategy(strategyId, { status: 'approved' })
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
          <MarketPage
            onNavigate={setPage}
            onGoSimulation={handleGoSimulation}
            user={user}
            onStartTrial={handleStartTrial}
            userStrategies={userStrategies}
            dataVersion={dataVersion}
          />
        )
      case 'simulation':
        return (
          <SimulationPage
            initialStrategyId={selectedStrategyId}
            user={user}
            onStartTrial={handleStartTrial}
            onSubscribe={handleSubscribe}
            userStrategies={userStrategies}
          />
        )
      case 'validation':
        return (
          <ValidationPage
            onNavigate={setPage}
            onGoSimulation={handleGoSimulation}
            selectedStrategyId={selectedStrategyId}
            user={user}
            onStartTrial={handleStartTrial}
            userStrategies={userStrategies}
          />
        )
      case 'home':   return <HomePage />
      case 'editor':
        return (
          <EditorPage
            onSaveStrategy={handleSaveStrategy}
            onNavigate={setPage}
            initialData={editorInitData}
            editingStrategyId={editingStrategyId}
            currentUser={currentUser}
            saveLoading={strategiesLoading}
            saveErrorMessage={strategiesError || authError}
          />
        )
      case 'mypage':
        return (
          <MyPage
            user={user}
            userStrategies={userStrategies}
            onEditStrategy={handleEditStrategy}
            onNavigate={setPage}
            currentUser={currentUser}
            profile={profile}
            authError={authError}
            onLogin={handleLogin}
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
          />
        )
      case 'admin':
        return isAdmin ? (
          <AdminReviewPage
            currentUser={currentUser}
            supaReady={supaReady}
            dataVersion={dataVersion}
            onReviewAction={handleReviewAction}
          />
        ) : <HomePage />
      default: return <HomePage />
    }
  }

  return (
    <AppLayout
      currentPage={page}
      onNavigate={setPage}
      isDark={isDark}
      onToggleDark={() => setIsDark((d) => !d)}
      user={user}
      isAdmin={isAdmin}
      onToggleAdmin={() => setIsAdmin((v) => !v)}
      currentUser={currentUser}
      profile={profile}
      authLoading={authLoading}
      authError={authError}
      onLogin={handleLogin}
      onLogout={handleLogout}
      supaReady={supaReady}
      profileLoading={profileLoading}
    >
      {renderPage()}
    </AppLayout>
  )
}

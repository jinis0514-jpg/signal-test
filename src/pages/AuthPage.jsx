import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { signInWithPassword, signUpWithEmail, resetPasswordForEmail, signInWithGoogle } from '../lib/authService'
import { isSupabaseConfigured } from '../lib/supabase'
import Button from '../components/ui/Button'
import Logo from '../components/Logo'
import Input from '../components/ui/Input'

const VALID_MODES = new Set(['login', 'signup', 'forgot'])

/** 로그인/가입 후 이동 경로 (오픈 리다이렉트 방지: 앱 내부 경로만) */
function safeNextPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/app/')) return '/app/home'
  if (raw.includes('..') || raw.includes('//')) return '/app/home'
  return raw
}

function validateEmail(email) {
  const s = String(email ?? '').trim()
  if (!s.includes('@')) return '이메일 주소를 입력해 주세요.'
  if (s.length > 200) return '이메일이 너무 깁니다.'
  return null
}

function validatePassword(pw) {
  if (!pw || String(pw).length < 6) return '비밀번호는 6자 이상이어야 합니다.'
  if (String(pw).length > 128) return '비밀번호가 너무 깁니다.'
  return null
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = useMemo(() => {
    const m = searchParams.get('mode') || 'login'
    return VALID_MODES.has(m) ? m : 'login'
  }, [searchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')

  useEffect(() => {
    try {
      const t = localStorage.getItem('bb_theme')
      document.documentElement.classList.toggle('dark', t === 'dark')
    } catch {
      /* ignore */
    }
  }, [])

  function setMode(nextMode) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('mode', nextMode)
      return p
    })
    setError('')
    setInfo('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const ve = validateEmail(email)
    if (ve) {
      setError(ve)
      return
    }
    const vp = validatePassword(password)
    if (vp) {
      setError(vp)
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }
    setLoading(true)
    try {
      await signInWithPassword(String(email).trim(), password)
      navigate(safeNextPath(searchParams.get('next')), { replace: true })
    } catch (err) {
      setError(err?.message ?? '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const ve = validateEmail(email)
    if (ve) {
      setError(ve)
      return
    }
    const vp = validatePassword(password)
    if (vp) {
      setError(vp)
      return
    }
    if (password !== password2) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }
    setLoading(true)
    try {
      const result = await signUpWithEmail(String(email).trim(), password)
      if (result?.user && !result?.session) {
        setInfo('가입 확인 메일을 보냈습니다. 메일함을 확인한 뒤 로그인해 주세요.')
      } else {
        setInfo('회원가입이 완료되었습니다. 잠시 후 앱으로 이동합니다.')
        const dest = safeNextPath(searchParams.get('next'))
        setTimeout(() => navigate(dest, { replace: true }), 600)
      }
    } catch (err) {
      setError(err?.message ?? '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const ve = validateEmail(email)
    if (ve) {
      setError(ve)
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }
    setLoading(true)
    try {
      await resetPasswordForEmail(String(email).trim())
      setInfo('비밀번호 재설정 링크를 메일로 보냈습니다. 메일함을 확인해 주세요.')
    } catch (err) {
      setError(err?.message ?? '메일 발송에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setInfo('')
    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }
    setLoading(true)
    try {
      await signInWithGoogle(safeNextPath(searchParams.get('next')))
    } catch (err) {
      setError(err?.message ?? 'Google 로그인에 실패했습니다.')
      setLoading(false)
    }
  }

  const title =
    mode === 'signup' ? '회원가입' : mode === 'forgot' ? '비밀번호 찾기' : '로그인'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] flex flex-col">
      <header className="border-b border-slate-200/80 dark:border-gray-800 shrink-0 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Logo size={28} textClassName="text-[15px]" />
          </Link>
          <Link
            to="/app/home"
            className="text-[13px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            앱으로
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-[10px] border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
          <h1 className="text-[22px] font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
            {mode === 'login' && '전략을 저장하고 시그널·알림을 이어가려면 로그인하세요.'}
            {mode === 'signup' && '이메일과 비밀번호로 계정을 만듭니다.'}
            {mode === 'forgot' && '가입하신 이메일로 재설정 링크를 보내 드립니다.'}
          </p>

          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-5">
              <Button
                variant="secondary"
                size="lg"
                className="w-full justify-center"
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
              >
                Google로 1초 로그인
              </Button>
              <p className="mt-1.5 text-center text-[12px] text-slate-500 dark:text-slate-400">
                회원가입 없이 바로 시작
              </p>
            </div>
          )}

          {mode === 'login' && (
            <p className="mt-3 text-center text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
              로그인 상태는 이 브라우저에 안전하게 유지됩니다. 다음에 방문해도 바로 이어서 이용할 수 있어요.
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
          {info && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100">
              {info}
            </div>
          )}

          {mode === 'login' && (
            <form className="mt-6 space-y-4" onSubmit={handleLogin} noValidate>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  이메일
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  비밀번호
                </label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  disabled={loading}
                />
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center"
                type="submit"
                loading={loading}
                disabled={loading}
              >
                로그인
              </Button>
            </form>
          )}

          {mode === 'signup' && (
            <form className="mt-6 space-y-4" onSubmit={handleSignUp} noValidate>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  이메일
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  비밀번호
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  비밀번호 확인
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  disabled={loading}
                />
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center"
                type="submit"
                loading={loading}
                disabled={loading}
              >
                회원가입
              </Button>
            </form>
          )}

          {mode === 'forgot' && (
            <form className="mt-6 space-y-4" onSubmit={handleForgot} noValidate>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  이메일
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="가입 시 사용한 이메일"
                  disabled={loading}
                />
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center"
                type="submit"
                loading={loading}
                disabled={loading}
              >
                재설정 메일 보내기
              </Button>
            </form>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-5 text-[13px] dark:border-gray-800">
            {mode !== 'login' && (
              <button
                type="button"
                className="font-semibold text-[#2962ff] hover:underline"
                onClick={() => setMode('login')}
              >
                로그인
              </button>
            )}
            {mode !== 'signup' && (
              <button
                type="button"
                className="font-semibold text-[#2962ff] hover:underline"
                onClick={() => setMode('signup')}
              >
                회원가입
              </button>
            )}
            {mode !== 'forgot' && (
              <button
                type="button"
                className="font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => setMode('forgot')}
              >
                비밀번호 찾기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Radio,
  ShieldCheck,
  Shield,
  Sparkles,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Logo from '../components/Logo'
import { cn } from '../lib/cn'

function SectionShell({ id, className, children }) {
  return (
    <section id={id} className={cn('scroll-mt-20', className)}>
      {children}
    </section>
  )
}

/** Hero·하단 CTA — 서비스 탐색 중심 (로그인 강제 없음) */
function PrimaryCtaPair({ size = 'lg' }) {
  const navigate = useNavigate()
  const goExplore = () => navigate('/app/market')
  const goBuild = () => navigate('/app/editor')

  return (
    <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full max-w-lg mx-auto">
      <Button
        variant="primary"
        type="button"
        size={size}
        onClick={goExplore}
        className="min-w-[200px] sm:min-w-[220px] h-11 sm:h-12 text-[15px] font-semibold shadow-sm"
      >
        전략 둘러보기
      </Button>
      <Button
        variant="secondary"
        type="button"
        size={size}
        onClick={goBuild}
        className="min-w-[200px] sm:min-w-[220px] h-11 sm:h-12 text-[15px] font-semibold border-slate-200 dark:border-gray-600"
      >
        전략 만들기
      </Button>
    </div>
  )
}

function SecondaryCtaPair() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col sm:flex-row justify-center gap-3">
      <Button
        variant="primary"
        type="button"
        size="lg"
        onClick={() => navigate('/app/market')}
        className="min-w-[200px] h-11 text-[15px] font-semibold"
      >
        전략 보러가기
      </Button>
      <Button
        variant="secondary"
        type="button"
        size="lg"
        onClick={() => navigate('/app/home')}
        className="min-w-[200px] h-11 text-[15px] font-semibold border-slate-300 dark:border-gray-600"
      >
        무료로 둘러보기
      </Button>
    </div>
  )
}

const featureCards = [
  {
    id: 'builder',
    title: '전략 생성',
    desc: '나만의 조건으로 전략을 만들고 저장할 수 있습니다.',
    icon: 'builder',
  },
  {
    id: 'signals',
    title: '실시간 시그널',
    desc: '현재 진입 타이밍과 포지션 상태를 빠르게 확인할 수 있습니다.',
    icon: 'signal',
  },
  {
    id: 'verification',
    title: '검증 시스템',
    desc: '백테스트, 라이브 성과, 실거래 인증을 분리해서 보여줍니다.',
    icon: 'shield',
  },
]

const featureIconMap = {
  builder: Sparkles,
  signal: Radio,
  shield: ShieldCheck,
}

const featureNavigateTo = {
  builder: '/app/editor',
  signals: '/app/signal',
  verification: '/app/validation',
}

export default function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const t = localStorage.getItem('bb_theme')
      document.documentElement.classList.toggle('dark', t === 'dark')
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-[#06080d] text-slate-800 dark:text-slate-100 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-gray-800/90 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 rounded-lg hover:opacity-90 transition-opacity text-left"
            aria-label="랜딩 홈"
          >
            <Logo size={36} textClassName="text-[16px]" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/auth?mode=login')}
              className="text-[13px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => navigate('/auth?mode=signup')}
              className="text-[13px] font-semibold rounded-lg px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
            >
              회원가입
            </button>
          </div>
        </div>
      </header>

      <main className="bg-[#f6f8fb] dark:bg-[#05070c]">
        <SectionShell className="relative overflow-hidden border-b border-slate-200/40 dark:border-gray-800/70">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_25%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#0b1120_100%)]"
            />
            <div className="landing-orb landing-orb-a animate-float-slow" />
            <div className="landing-orb landing-orb-b animate-float-slow-reverse" />
            <div className="landing-orb landing-orb-c animate-float-slow" />
            <div className="absolute inset-0 landing-hero-grid opacity-[0.1] md:opacity-[0.11]" />
            <div className="absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-blue-500/10 to-transparent blur-2xl" />
          </div>
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/35 to-transparent" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-10 md:bottom-14 px-4 sm:px-5" aria-hidden>
            <div className="max-w-6xl mx-auto overflow-hidden">
              <svg viewBox="0 0 1200 220" className="w-full h-28 md:h-32 text-blue-300/45">
                <defs>
                  <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
                    <stop offset="45%" stopColor="currentColor" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
                  </linearGradient>
                </defs>
                <g className="landing-chart-drift">
                  <polyline
                    fill="none"
                    stroke="url(#heroLine)"
                    strokeWidth="3"
                    points="0,125 90,118 180,125 270,105 360,113 450,88 540,96 630,74 720,86 810,64 900,72 990,58 1080,70 1200,54"
                  />
                  <polyline
                    fill="none"
                    stroke="url(#heroLine)"
                    strokeWidth="1.6"
                    points="0,138 95,132 190,138 285,122 380,128 475,108 570,114 665,95 760,104 855,88 950,94 1045,80 1140,88 1200,82"
                    opacity="0.6"
                  />
                </g>
              </svg>
            </div>
          </div>
          <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  백테스트 / 라이브 / 실거래 분리 검증
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.08]">
                  검증된 코인 전략을
                  <br />
                  지금 바로 실행하세요
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                  감이 아니라 데이터로 전략을 선택하는 플랫폼.
                  백테스트, 라이브 검증, 실거래 인증을 분리해 더 신뢰할 수 있게 만듭니다.
                </p>
                <div className="mt-8 flex justify-start">
                  <PrimaryCtaPair />
                </div>
              </div>
              <div className="relative">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="hero-preview-card hero-preview-enter hero-preview-delay-1">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Trust Structure</p>
                          <h3 className="mt-1 text-sm font-semibold text-white">3단계 검증 구조</h3>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-emerald-400/10 flex items-center justify-center text-emerald-300">✓</div>
                      </div>
                      <div className="space-y-2">
                        {[
                          ['백테스트', '과거 성과'],
                          ['라이브 검증', '등록 이후'],
                          ['실거래 인증', '판매자 체결'],
                        ].map(([left, right]) => (
                          <div key={left} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                            <span className="text-sm text-slate-300">{left}</span>
                            <span className="text-xs font-medium text-slate-400">{right}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="hero-preview-card hero-preview-enter hero-preview-delay-2">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Live Signals</p>
                          <h3 className="mt-1 text-sm font-semibold text-white">최근 시그널</h3>
                        </div>
                        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                          LIVE
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-xl border border-emerald-400/10 bg-emerald-400/5 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-emerald-300">LONG</p>
                            <p className="text-[11px] text-slate-400">BTCUSDT · 04/07 19:20</p>
                          </div>
                          <p className="text-sm font-medium text-white">84,200</p>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-red-400/10 bg-red-400/5 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-red-300">SHORT</p>
                            <p className="text-[11px] text-slate-400">ETHUSDT · 04/07 18:05</p>
                          </div>
                          <p className="text-sm font-medium text-white">3,245</p>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">EXIT</p>
                            <p className="text-[11px] text-slate-400">SOLUSDT · 04/07 17:40</p>
                          </div>
                          <p className="text-sm font-medium text-emerald-300">+2.8%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:pt-10">
                    <div className="hero-preview-card hero-preview-enter hero-preview-delay-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Performance</p>
                          <h3 className="mt-1 text-sm font-semibold text-white">핵심 지표</h3>
                        </div>
                        <span className="text-[10px] text-slate-500">30D</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['수익률', '+42.3%', 'text-emerald-300'],
                          ['MDD', '-12.4%', 'text-white'],
                          ['승률', '63.2%', 'text-white'],
                          ['거래 수', '148회', 'text-white'],
                        ].map(([k, v, color]) => (
                          <div key={k} className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                            <p className="text-[11px] text-slate-400">{k}</p>
                            <p className={`mt-1 text-lg font-bold ${color}`}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        <div className="max-w-6xl mx-auto px-4 sm:px-5 py-14 md:py-20 space-y-14 md:space-y-20">
          <SectionShell id="solution">
            <section className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-400">
                  Platform Features
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                  전략 선택이 더 쉬워지는 구조
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
                  전략 생성부터 실시간 시그널, 검증까지 한 흐름으로 연결됩니다.
                </p>
              </div>

              <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {featureCards.map((item) => {
                  const Icon = featureIconMap[item.icon]
                  const go = featureNavigateTo[item.id]
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go && navigate(go)}
                      className="
                        group rounded-2xl border border-slate-200 bg-white p-6 text-left
                        shadow-sm transition-all duration-200 ease-out
                        hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl
                        dark:border-gray-700 dark:bg-gray-900/70 dark:hover:border-gray-500
                      "
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 transition-colors duration-200 group-hover:border-blue-300 group-hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {item.desc}
                      </p>

                      <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors duration-200 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200">
                        자세히 보기
                        <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          </SectionShell>

          <SectionShell id="trust">
            <div className="text-center mb-8">
              <h2 className="text-[20px] md:text-[24px] font-bold text-slate-900 dark:text-white">
                왜 이 플랫폼이 더 신뢰할 수 있나요?
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { t: '백테스트', d: '과거 구간 성과 확인', icon: BarChart3 },
                { t: '라이브 검증', d: '등록 이후 성과 추적', icon: Radio },
                { t: '실거래 인증', d: '판매자 실제 체결 비교', icon: Shield },
              ].map(({ t, d, icon: Icon }) => (
                <div
                  key={t}
                  className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/45 px-5 py-5 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:border-slate-300 dark:hover:border-gray-600"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10">
                    <Icon className="text-emerald-600 dark:text-emerald-300" size={18} aria-hidden />
                  </div>
                  <p className="mt-3 text-[16px] font-bold text-slate-900 dark:text-white">{t}</p>
                  <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/45 px-5 py-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:border-slate-300 dark:hover:border-gray-600">
              <p className="text-[12px] text-slate-700 dark:text-slate-300">
                신호와 성과를 같은 화면에서 확인하고, 검증 가능한 지표를 기준으로 판단할 수 있습니다.
              </p>
            </div>
          </SectionShell>

          <SectionShell id="cta" className="pb-2">
            <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-gradient-to-br from-slate-100 to-white dark:from-gray-900 dark:to-slate-950 px-6 py-12 md:py-14 text-center transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:border-slate-300 dark:hover:border-gray-600">
              <h2 className="text-[24px] md:text-[30px] font-bold text-slate-900 dark:text-white tracking-tight">
                이제 감으로 고르지 마세요
              </h2>
              <p className="mt-3 text-[15px] text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                검증된 데이터를 기준으로 전략을 비교하고 선택해보세요.
              </p>
              <div className="mt-8">
                <SecondaryCtaPair />
              </div>
            </div>
          </SectionShell>
        </div>
      </main>

      <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 py-10 md:py-12 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <Logo size={28} textClassName="text-[15px] text-white" />
            <p className="mt-2 text-[12px] text-slate-400 leading-relaxed">
              데이터 기반으로 전략을 비교하고 실행하는 코인 전략 플랫폼
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white mb-2">빠른 이동</p>
            <div className="space-y-1.5 text-[12px]">
              {[
                { t: '홈', to: '/app/home' },
                { t: '전략 마켓', to: '/app/market' },
                { t: '전략 만들기', to: '/app/editor' },
              ].map((x) => (
                <button
                  key={x.t}
                  type="button"
                  onClick={() => navigate(x.to)}
                  className="block hover:text-white transition-colors"
                >
                  {x.t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white mb-2">지원 / 문의</p>
            <div className="space-y-1.5 text-[12px]">
              <button type="button" onClick={() => navigate('/guide')} className="block hover:text-white transition-colors">
                이용 가이드
              </button>
              <button type="button" onClick={() => navigate('/support')} className="block hover:text-white transition-colors">
                문의하기
              </button>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white mb-2">정책</p>
            <div className="space-y-1.5 text-[12px]">
              {[
                { t: '이용약관', to: '/terms' },
                { t: '개인정보처리방침', to: '/privacy' },
                { t: '환불 정책', to: '/refund' },
                { t: '투자 유의사항', to: '/disclaimer' },
              ].map((x) => (
                <button key={x.t} type="button" onClick={() => navigate(x.to)} className="block hover:text-white transition-colors">
                  {x.t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-5 mt-8 pt-4 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">
            본 플랫폼은 투자 자문을 제공하지 않으며, 모든 투자 판단과 책임은 사용자 본인에게 있습니다.
          </p>
        </div>
      </footer>
    </div>
  )
}

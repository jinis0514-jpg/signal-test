import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  LineChart,
  ListChecks,
  Radio,
  Shield,
} from 'lucide-react'
import Button from '../components/ui/Button'
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
  const goExplore = () => navigate('/app/home')
  const goMarket = () => navigate('/app/market')

  return (
    <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full max-w-lg mx-auto">
      <Button
        variant="primary"
        type="button"
        size={size}
        onClick={goExplore}
        className="min-w-[200px] sm:min-w-[220px] h-11 sm:h-12 text-[15px] font-semibold shadow-sm"
      >
        무료로 둘러보기
      </Button>
      <Button
        variant="secondary"
        type="button"
        size={size}
        onClick={goMarket}
        className="min-w-[200px] sm:min-w-[220px] h-11 sm:h-12 text-[15px] font-semibold border-slate-200 dark:border-gray-600"
      >
        전략 보러가기
      </Button>
    </div>
  )
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
            <div className="w-9 h-9 rounded-[10px] bg-slate-900 dark:bg-white flex items-center justify-center shadow-sm">
              <span className="text-white dark:text-slate-900 font-bold text-[15px] font-mono leading-none">Q</span>
            </div>
            <span className="font-bold text-[16px] tracking-tight text-slate-900 dark:text-white">
              Quant Terminal
            </span>
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

      <main>
        <SectionShell className="relative overflow-hidden border-b border-slate-200/60 dark:border-gray-800/80">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(41,98,255,0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.12),transparent)]"
            aria-hidden
          />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-5 pt-14 pb-16 md:pt-20 md:pb-24 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2962ff] dark:text-blue-400 mb-4">
              검증 · 투명성 · 비교
            </p>
            <h1 className="text-[30px] sm:text-[38px] md:text-[42px] font-extrabold text-slate-900 dark:text-white leading-[1.12] tracking-tight max-w-3xl mx-auto">
              코인 전략의 성과를 같은 기준으로 비교하세요
            </h1>
            <p className="mt-6 text-[16px] md:text-[17px] text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
              누적 수익·낙폭·거래 기록이 공개된 전략만 모았습니다. 시그널 흐름과 검증 화면까지 한 플랫폼에서 확인할 수 있습니다.
            </p>
            <div className="mt-10">
              <PrimaryCtaPair />
            </div>
          </div>
        </SectionShell>

        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-14 md:py-20 space-y-16 md:space-y-24">
          <SectionShell id="problem">
            <div className="rounded-2xl border border-slate-200/90 dark:border-gray-800 bg-white dark:bg-gray-900/40 px-6 py-8 md:px-10 md:py-10">
              <h2 className="text-[20px] md:text-[22px] font-bold text-slate-900 dark:text-white mb-4">
                왜 같은 숫자를 봐야 할까요
              </h2>
              <p className="text-[15px] md:text-[16px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium mb-6">
                전략을 고를 때는 출처보다 재현 가능한 지표가 우선입니다.
              </p>
              <ul className="space-y-3 text-[14px] md:text-[15px] text-slate-600 dark:text-slate-400">
                {[
                  '과거 구간·거래 수·승률이 분리되어 공개되는지',
                  '최대 낙폭(MDD)과 수익률이 함께 제시되는지',
                  '진입·청산 근거를 데이터로 추적할 수 있는지',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </SectionShell>

          <SectionShell id="solution">
            <div className="text-center mb-8 md:mb-10">
              <h2 className="text-[20px] md:text-[24px] font-bold text-slate-900 dark:text-white">
                공개 지표로 선택을 좁힙니다
              </h2>
              <p className="mt-3 text-[15px] text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                동일한 표준으로 정리된 숫자만 보여 드립니다.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {[
                { icon: LineChart, label: '누적 수익률' },
                { icon: BarChart3, label: '최대 낙폭(MDD)' },
                { icon: CheckCircle2, label: '승률' },
                { icon: ListChecks, label: '거래 기록' },
                { icon: FileText, label: '진입 근거' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-slate-200/90 dark:border-gray-800',
                    'bg-white dark:bg-gray-900/50 px-4 py-3.5 shadow-sm',
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2962ff]/10 dark:bg-blue-500/15">
                    <Icon className="text-[#2962ff] dark:text-blue-400" size={20} strokeWidth={2} aria-hidden />
                  </div>
                  <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell id="trust">
            <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 px-6 py-8 md:px-10 md:py-10">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-gray-800">
                  <Shield className="text-slate-700 dark:text-slate-200" size={26} strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h2 className="text-[20px] md:text-[22px] font-bold text-slate-900 dark:text-white">
                    측정 방식을 가리지 않습니다
                  </h2>
                  <p className="mt-2 text-[15px] text-slate-500 dark:text-slate-400">
                    백테스트와 실시간 추적을 구분하고, 동일 조건 비교가 가능하도록 설계했습니다.
                  </p>
                </div>
              </div>
              <ul className="space-y-3.5 text-[14px] md:text-[15px] text-slate-700 dark:text-slate-300">
                {[
                  '백테스트 구간·실시간 구간 분리 표기',
                  '거래 로그·체결 순서 공개',
                  '전략 설명 자료는 보조 정보로 제공',
                  '전략 간 지표 단위 통일',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <CheckCircle2 className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" size={18} aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </SectionShell>

          <SectionShell id="flow">
            <h2 className="text-center text-[20px] md:text-[24px] font-bold text-slate-900 dark:text-white mb-10 md:mb-12">
              사용 흐름
            </h2>
            <div className="grid md:grid-cols-3 gap-6 md:gap-4">
              {[
                { step: '1', title: '열람', desc: '지표·가격·상태 확인', icon: FileText },
                { step: '2', title: '시그널', desc: '실시간 신호 흐름', icon: Radio },
                { step: '3', title: '검증', desc: '기록·구간별 성과', icon: BarChart3 },
              ].map(({ step, title, desc, icon: Icon }, i) => (
                <div
                  key={step}
                  className="relative rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/35 p-6 pt-7 md:p-7"
                >
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 z-10 text-slate-300 dark:text-gray-600">
                      <ArrowRight size={20} strokeWidth={2} aria-hidden />
                    </div>
                  )}
                  <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-slate-900 dark:bg-white text-[12px] font-bold text-white dark:text-slate-900 mb-4">
                    {step}
                  </span>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="text-slate-500 dark:text-slate-400" size={18} strokeWidth={2} aria-hidden />
                    <h3 className="text-[17px] font-bold text-slate-900 dark:text-white">{title}</h3>
                  </div>
                  <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell id="cta" className="pb-4">
            <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-gradient-to-b from-slate-50 to-white dark:from-gray-900/80 dark:to-gray-950 px-6 py-12 md:py-14 text-center">
              <h2 className="text-[22px] md:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight">
                지금 바로 둘러보기
              </h2>
              <p className="mt-3 text-[15px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                로그인 없이 홈·마켓을 탐색할 수 있습니다.
              </p>
              <div className="mt-9">
                <PrimaryCtaPair size="lg" />
              </div>
            </div>
          </SectionShell>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-gray-800 py-8 text-center shrink-0">
        <p className="text-[13px] text-slate-500 dark:text-slate-500 max-w-md mx-auto px-4 leading-relaxed">
          Quant Terminal은 투자 자문이 아닙니다. 모든 수익·손실은 이용자 판단과 책임 하에 이루어집니다.
        </p>
      </footer>
    </div>
  )
}

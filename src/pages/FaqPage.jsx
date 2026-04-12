import { Link } from 'react-router-dom'

const faqs = [
  {
    q: '이 전략은 자동 매매인가요?',
    a: '아닙니다. 시그널 기반으로 직접 실행하는 구조입니다.',
  },
  {
    q: '실거래 인증은 어떻게 하나요?',
    a: '거래소 API 연결을 통해 자동으로 기록됩니다.',
  },
  {
    q: '무료로 사용 가능한가요?',
    a: '일부 정보는 무료로 제공되며, 구독 시 전체 기능을 사용할 수 있습니다.',
  },
  {
    q: '전략은 어떤 순서로 보는 게 좋나요?',
    a: '홈에서 전략을 고른 뒤, 검증 페이지에서 기준과 기간을 확인하고 시그널 페이지로 이동하세요.',
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">FAQ</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          자주 묻는 질문을 빠르게 확인하세요.
        </p>

        <div className="mt-4 space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Q. {f.q}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">A. {f.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Link to="/app/home" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            앱으로 돌아가기 →
          </Link>
        </div>
      </div>
    </div>
  )
}


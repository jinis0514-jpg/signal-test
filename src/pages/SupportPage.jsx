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
]

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">고객지원</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
          문의 및 지원은 아래 채널로 가능합니다.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
          <li>이메일: <a className="font-medium hover:underline" href="mailto:support@bb-platform.com">support@bb-platform.com</a></li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-slate-900 dark:text-slate-100">FAQ</h2>
        <div className="mt-3 space-y-3">
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


import { Link } from 'react-router-dom'

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">이용 가이드</h1>
        <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <li className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="font-semibold text-slate-900 dark:text-slate-100">1. 전략 선택</p>
            <p className="mt-1">전략을 선택합니다.</p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="font-semibold text-slate-900 dark:text-slate-100">2. 검증 확인</p>
            <p className="mt-1">검증 데이터를 확인합니다.</p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="font-semibold text-slate-900 dark:text-slate-100">3. 시그널 실행</p>
            <p className="mt-1">시그널을 따라 실행합니다.</p>
          </li>
        </ol>
        <div className="mt-6">
          <Link to="/app/home" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            앱으로 돌아가기 →
          </Link>
        </div>
      </div>
    </div>
  )
}


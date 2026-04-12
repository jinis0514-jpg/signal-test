import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">이용약관</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
          본 플랫폼은 전략 탐색, 시그널 확인, 검증 지표 조회 기능을 제공합니다. 서비스 이용자는
          관계 법령 및 본 약관을 준수해야 하며, 계정 보안과 거래 행위에 대한 책임은 사용자 본인에게 있습니다.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
          본 플랫폼은 투자 자문을 제공하지 않으며,
          <br />
          모든 투자 판단과 책임은 사용자 본인에게 있습니다.
        </p>
        <div className="mt-6">
          <Link to="/app/home" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            앱으로 돌아가기 →
          </Link>
        </div>
      </div>
    </div>
  )
}

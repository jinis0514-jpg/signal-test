import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">개인정보처리방침</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
          서비스는 계정 식별, 알림 제공, 전략 저장을 위해 최소한의 개인정보를 처리합니다. 관련 정보는
          서비스 제공 목적 범위 내에서만 사용되며, 법령 또는 이용자 동의 없이 제3자에게 제공하지 않습니다.
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

import { Link } from 'react-router-dom'

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">환불 정책</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
          구독 결제 및 환불은 결제 사업자 정책과 관련 법령을 따릅니다. 결제 오류 또는 중복 결제 이슈는
          고객 문의를 통해 확인 후 환불 가능 범위를 안내합니다.
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

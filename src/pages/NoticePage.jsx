import { Link } from 'react-router-dom'
import { notices } from '../data/notices'

export default function NoticePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">공지사항</h1>
        <div className="mt-4 space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="text-xs text-slate-400">{n.date}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {n.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
                {n.content}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-400">
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

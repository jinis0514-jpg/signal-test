import { Component } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { InAppNotificationProvider } from './context/InAppNotificationContext'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import App from './App'

class AppCrashBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message ?? '알 수 없는 오류') }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-800 dark:text-slate-100 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <p className="text-[15px] font-bold">화면을 표시할 수 없습니다</p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              임시 오류가 발생했습니다. 홈으로 이동하거나 새로고침해 주세요.
            </p>
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 break-words">
              {this.state.message}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="h-8 px-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[12px] font-semibold"
                onClick={() => window.location.assign('/app/home')}
              >
                앱 홈으로
              </button>
              <button
                type="button"
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-gray-700 text-[12px] font-semibold"
                onClick={() => window.location.reload()}
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function AppRoot() {
  return (
    <AppCrashBoundary>
      <InAppNotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/app" element={<Navigate to="/app/home" replace />} />
          <Route path="/app/:page" element={<App />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </InAppNotificationProvider>
    </AppCrashBoundary>
  )
}

import { Component } from 'react'
import Button from '../ui/Button'

export default class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      error: null,
      info: null,
      global: [],
    }
    this._unsub = []
  }

  componentDidCatch(error, info) {
    this.setState({ error, info })
  }

  componentDidMount() {
    const onError = (e) => {
      const msg = e?.message ?? String(e)
      const stack = e?.error?.stack ?? null
      this.setState((s) => ({
        global: [{ type: 'error', msg, stack, at: Date.now() }, ...s.global].slice(0, 6),
      }))
    }
    const onRej = (e) => {
      const reason = e?.reason
      const msg = reason?.message ?? String(reason ?? e)
      const stack = reason?.stack ?? null
      this.setState((s) => ({
        global: [{ type: 'unhandledrejection', msg, stack, at: Date.now() }, ...s.global].slice(0, 6),
      }))
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRej)
    this._unsub.push(() => window.removeEventListener('error', onError))
    this._unsub.push(() => window.removeEventListener('unhandledrejection', onRej))
  }

  componentWillUnmount() {
    this._unsub.forEach((fn) => { try { fn() } catch {} })
    this._unsub = []
  }

  render() {
    const { error, info, global } = this.state
    if (!error) return this.props.children

    const message = error?.message ?? '에디터 렌더링 오류'
    const stack = error?.stack ?? ''
    const comp = info?.componentStack ?? ''

    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 px-4 py-3">
          <p className="text-[12px] font-bold text-red-700 dark:text-red-300 mb-1">에디터 오류로 화면 렌더링이 중단되었습니다</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            에디터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.
          </p>
          <p className="text-[12px] text-red-700 dark:text-red-300 whitespace-pre-wrap">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => this.setState({ error: null, info: null })}>
              다시 렌더링
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={() => window.location.reload()}>
              새로고침
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">에러 스택</p>
            <pre className="text-[10px] whitespace-pre-wrap text-slate-700 dark:text-slate-300">{stack || '—'}</pre>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">컴포넌트 스택</p>
            <pre className="text-[10px] whitespace-pre-wrap text-slate-700 dark:text-slate-300">{comp || '—'}</pre>
          </div>
        </div>

        {global?.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">최근 콘솔 에러(캡처)</p>
            <div className="space-y-2">
              {global.map((g) => (
                <div key={`${g.type}-${g.at}`} className="rounded-lg border border-slate-100 dark:border-gray-800 p-2">
                  <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                    {g.type} · {new Date(g.at).toLocaleString('ko-KR')}
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{g.msg}</p>
                  {g.stack && (
                    <pre className="mt-1 text-[10px] text-slate-500 whitespace-pre-wrap">{g.stack}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
}


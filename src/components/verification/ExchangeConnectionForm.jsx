import { useState, useEffect, useCallback } from 'react'
import {
  fetchMyConnections,
  createConnection,
  revokeConnection,
  SUPPORTED_EXCHANGES,
} from '../../lib/exchangeConnectionService'

function StatusDot({ status }) {
  const color = {
    active: 'bg-emerald-500',
    error: 'bg-red-500',
    revoked: 'bg-slate-400',
  }[status] ?? 'bg-slate-400'

  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
}

function StatusLabel({ status }) {
  const labels = { active: '연결됨', error: '오류', revoked: '해제됨' }
  return (
    <span className="text-xs text-slate-600 dark:text-slate-400">
      {labels[status] ?? status}
    </span>
  )
}

export default function ExchangeConnectionForm({ className = '' }) {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [exchange, setExchange] = useState('binance')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadConnections = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchMyConnections()
      setConnections(data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConnections() }, [loadConnections])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('API Key와 Secret을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      await createConnection({ exchange_name: exchange, api_key: apiKey.trim(), api_secret: apiSecret.trim() })
      setSuccess('거래소 연결이 완료되었습니다.')
      setApiKey('')
      setApiSecret('')
      setShowForm(false)
      await loadConnections()
    } catch (err) {
      setError(err?.message ?? '연결 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (connId) => {
    if (!confirm('거래소 연결을 해제하시겠습니까?')) return
    try {
      await revokeConnection(connId)
      await loadConnections()
    } catch (err) {
      setError(err?.message ?? '해제 실패')
    }
  }

  const activeConns = connections.filter((c) => c.is_active)

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          거래소 API 연결
        </h3>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setError(''); setSuccess('') }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            + 새 연결
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
        거래소 API를 연결하면 실거래 기록이 자동으로 수집되어 전략의 실거래 인증이 진행됩니다.
        <strong className="text-slate-700 dark:text-slate-300"> Read-only 권한만 허용</strong>되며,
        API Key는 서버에서만 사용됩니다.
      </p>

      {/* 기존 연결 목록 */}
      {loading && <div className="text-xs text-slate-400 animate-pulse mb-3">로딩 중...</div>}

      {!loading && connections.length > 0 && (
        <div className="space-y-2 mb-4">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <StatusDot status={conn.is_active ? 'active' : 'inactive'} />
                <div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {SUPPORTED_EXCHANGES.find((e) => e.id === conn.exchange_name)?.name ?? conn.exchange_name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {conn.last_sync_at
                      ? `마지막 동기화: ${new Date(conn.last_sync_at).toLocaleString('ko-KR')}`
                      : '동기화 대기 중'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusLabel status={conn.is_active ? 'active' : 'inactive'} />
                {conn.is_active && (
                  <button
                    onClick={() => handleRevoke(conn.id)}
                    className="text-[10px] text-red-500 hover:text-red-600 px-2 py-1 rounded border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    해제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && connections.length === 0 && !showForm && (
        <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
          연결된 거래소가 없습니다
        </div>
      )}

      {/* 연결 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">거래소</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              {SUPPORTED_EXCHANGES.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.logo} {ex.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Binance API Key"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Binance API Secret"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              autoComplete="off"
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-[11px] text-amber-700 dark:text-amber-400">
            <strong>보안 안내:</strong> API Key는 반드시 <strong>Read-only (조회 전용)</strong> 권한으로 생성하세요.
            출금/거래 권한이 있는 키는 사용하지 마세요. 입력한 키는 서버에 암호화 저장되며, 브라우저에 저장되지 않습니다.
          </div>

          {error && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
          {success && <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded">{success}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 text-xs px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? '연결 중...' : '연결하기'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); setApiKey(''); setApiSecret('') }}
              className="text-xs px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

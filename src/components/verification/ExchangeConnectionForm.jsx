import { useState, useEffect, useCallback } from 'react'
import {
  fetchMyConnections,
  createConnection,
  revokeConnection,
  testExchangeConnection,
  SUPPORTED_EXCHANGES,
} from '../../lib/exchangeConnectionService'
import ConnectionCard from './ConnectionCard'

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
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

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

  const handleTest = async () => {
    setError('')
    setSuccess('')
    setTestResult(null)
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('API Key와 Secret을 입력해 주세요.')
      return
    }
    setTesting(true)
    try {
      const r = await testExchangeConnection({
        exchange_name: exchange,
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
      })
      setTestResult(r)
    } catch (err) {
      setError(err?.message ?? '연결 테스트 실패')
    } finally {
      setTesting(false)
    }
  }

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
      setTestResult(null)
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

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
        거래소 API를 연결하면 실거래 기록이 수집되어 전략의 실거래 인증에 활용됩니다.
        <strong className="text-slate-700 dark:text-slate-300"> 1차는 읽기·인증 중심</strong>이며,
        키는 서버에만 암호화 저장됩니다.
      </p>

      <ul className="mb-4 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">
        <li>이 연동은 <strong className="text-slate-800 dark:text-slate-200">자동 실행이 아닌 직접 실행 구조</strong>를 전제로 합니다.</li>
        <li><strong className="text-slate-800 dark:text-slate-200">투자 판단과 책임은 사용자 본인</strong>에게 있습니다.</li>
        <li><strong className="text-slate-800 dark:text-slate-200">출금 권한이 없는 API 키</strong>만 연결하는 것을 권장합니다.</li>
      </ul>

      <div className="mb-4 rounded-lg border border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 px-3 py-2.5">
        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-1">PRO MODE (클릭 주문)</p>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          키는 <strong className="text-slate-800 dark:text-slate-200">Edge Function으로 전달되어 서버에만 암호화 저장</strong>되며,
          브라우저·로컬에 보관되지 않습니다.
          시그널 화면의 <strong className="text-slate-800 dark:text-slate-200">「주문 실행」</strong>을 누른 경우에만 주문 요청이 전달되며,
          <strong className="text-slate-800 dark:text-slate-200"> 시그널·스케줄에 의한 자동 실행은 없습니다.</strong>
          (실제 체결·권한 범위는 거래소·배포 정책을 따릅니다.)
        </p>
      </div>

      {/* 기존 연결 목록 */}
      {loading && <div className="text-xs text-slate-400 animate-pulse mb-3">로딩 중...</div>}

      {!loading && connections.length > 0 && (
        <div className="space-y-2 mb-4">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onRevoke={handleRevoke}
            />
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
            Secret은 저장 후 <strong>다시 화면에 표시되지 않습니다.</strong> 출금 권한이 있는 키는 연결하지 마세요.
          </div>

          {testing && (
            <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2" role="status">
              <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" aria-hidden />
              확인 중… 거래소에 연결 테스트 요청 중입니다.
            </div>
          )}

          {testResult?.ok && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">연결 테스트 결과</p>
              <div className="flex flex-wrap gap-1">
                <ReadBadge ok={testResult.permission_read} />
                <TradeBadge enabled={testResult.permission_trade} />
                <WithdrawBadge enabled={testResult.permission_withdraw} />
              </div>
              {testResult.api_key_masked && (
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  키(마스킹): {testResult.api_key_masked}
                </p>
              )}
              {testResult.permission_withdraw && (
                <div className="rounded-md bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-2 py-1.5 text-[11px] text-red-800 dark:text-red-200">
                  <strong>경고:</strong> 출금 권한이 감지되었습니다. 자산 이전이 가능한 키이므로 사용을 중단하고, 출금 비활성 키로 다시 발급하세요.
                </div>
              )}
              {testResult.permission_trade && !testResult.permission_withdraw && (
                <p className="text-[10px] text-amber-700 dark:text-amber-300">
                  거래 권한이 켜져 있습니다. 실거래 인증·클릭 실행 보조에만 사용하며, 자동 반복 주문은 없습니다.
                </p>
              )}
            </div>
          )}

          {error && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
          {success && <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded">{success}</div>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={testing || submitting}
              onClick={handleTest}
              className="text-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {testing ? '확인 중…' : '연결 테스트'}
            </button>
            <button
              type="submit"
              disabled={submitting || testing}
              className="flex-1 min-w-[120px] text-xs px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
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

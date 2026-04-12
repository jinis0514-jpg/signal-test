import { useState, useEffect, useCallback } from 'react'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import ConnectionCard from '../components/verification/ConnectionCard'
import {
  testExchangeConnection,
  createConnection,
  fetchMyConnections,
  revokeConnection,
  SUPPORTED_EXCHANGES,
} from '../lib/exchangeConnectionService'

/**
 * 거래소 연결 전용 화면 — 연결 테스트 + 저장
 * 키/시크릿은 Edge로만 전달되며 로컬에 저장하지 않습니다.
 */
export default function ExchangeConnectPage({
  onNavigate,
  currentUser,
}) {
  const [exchange, setExchange] = useState('binance')
  const [apiKey, setApiKey] = useState('')
  const [secret, setSecret] = useState('')
  const [testPhase, setTestPhase] = useState('idle')
  const [savePhase, setSavePhase] = useState('idle')
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [connections, setConnections] = useState([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)

  const loggedIn = !!currentUser?.id

  const loadConnections = useCallback(async () => {
    if (!loggedIn) {
      setConnections([])
      return
    }
    setConnectionsLoading(true)
    try {
      const rows = await fetchMyConnections()
      setConnections(Array.isArray(rows) ? rows : [])
    } catch {
      setConnections([])
    } finally {
      setConnectionsLoading(false)
    }
  }, [loggedIn])

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  const handleRevoke = async (connId) => {
    if (!confirm('거래소 연결을 해제하시겠습니까?')) return
    try {
      await revokeConnection(connId)
      await loadConnections()
    } catch (e) {
      setError(e?.message ?? '연결 해제에 실패했습니다.')
    }
  }

  const handleTest = async () => {
    setError('')
    setSavePhase('idle')
    setTestResult(null)
    if (!apiKey.trim() || !secret.trim()) {
      setError('API Key와 Secret을 입력해 주세요.')
      setTestPhase('error')
      return
    }
    if (!loggedIn) {
      setError('로그인 후 이용할 수 있습니다.')
      setTestPhase('error')
      return
    }
    setTestPhase('loading')
    try {
      const r = await testExchangeConnection({
        exchange_name: exchange,
        api_key: apiKey.trim(),
        api_secret: secret.trim(),
      })
      setTestResult(r)
      setTestPhase('success')
    } catch (e) {
      setError(e?.message ?? '연결 테스트에 실패했습니다.')
      setTestPhase('error')
    }
  }

  const handleSave = async () => {
    setError('')
    setTestPhase('idle')
    if (!apiKey.trim() || !secret.trim()) {
      setError('API Key와 Secret을 입력해 주세요.')
      return
    }
    if (!loggedIn) {
      setError('로그인 후 이용할 수 있습니다.')
      return
    }
    setSavePhase('loading')
    try {
      await createConnection({
        exchange_name: exchange,
        api_key: apiKey.trim(),
        api_secret: secret.trim(),
      })
      setApiKey('')
      setSecret('')
      setTestResult(null)
      setTestPhase('idle')
      setSavePhase('success')
      await loadConnections()
    } catch (e) {
      setError(e?.message ?? '연결 저장에 실패했습니다.')
      setSavePhase('error')
    }
  }

  const testing = testPhase === 'loading'
  const saving = savePhase === 'loading'

  return (
    <PageShell className="max-w-xl">
      <PageHeader
        title="거래소 연결"
        description="실거래 인증과 클릭 실행 보조를 위해 API를 연결합니다. 자동 매매·자동 반복 주문은 없습니다."
        action={
          <Button variant="secondary" size="sm" type="button" onClick={() => onNavigate?.('mypage')}>
            마이페이지
          </Button>
        }
      />

      {!loggedIn && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/25 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200">
          로그인이 필요합니다.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => { window.location.assign('/auth?mode=login') }}
          >
            로그인하기
          </button>
        </div>
      )}

      {loggedIn && (
        <section className="mb-8 space-y-2" aria-labelledby="exchange-status-heading">
          <h2 id="exchange-status-heading" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
            연결 상태
          </h2>
          {connectionsLoading && (
            <p className="text-[12px] text-slate-400 animate-pulse">불러오는 중…</p>
          )}
          {!connectionsLoading && connections.length === 0 && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400">등록된 연결이 없습니다.</p>
          )}
          {!connectionsLoading &&
            connections.map((c) => (
              <ConnectionCard key={c.id} connection={c} onRevoke={handleRevoke} />
            ))}
        </section>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="ex-connect-exchange" className="text-[12px] text-slate-600 dark:text-slate-400 mb-1 block">
            거래소
          </label>
          <select
            id="ex-connect-exchange"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            className="w-full h-11 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[13px] text-slate-900 dark:text-slate-100"
          >
            {SUPPORTED_EXCHANGES.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.logo} {ex.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ex-connect-key" className="text-[12px] text-slate-600 dark:text-slate-400 mb-1 block">
            API Key
          </label>
          <input
            id="ex-connect-key"
            type="text"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            className="w-full h-11 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label htmlFor="ex-connect-secret" className="text-[12px] text-slate-600 dark:text-slate-400 mb-1 block">
            API Secret
          </label>
          <input
            id="ex-connect-secret"
            type="password"
            placeholder="API Secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            className="w-full h-11 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:flex-1 h-11"
            disabled={testing || saving || !loggedIn}
            onClick={handleTest}
          >
            {testing ? '연결 확인 중…' : '연결 테스트'}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="w-full sm:flex-1 h-11"
            disabled={testing || saving || !loggedIn}
            onClick={handleSave}
          >
            {saving ? '저장 중…' : '연결 저장'}
          </Button>
        </div>

        {testing && (
          <p className="text-[13px] text-slate-600 dark:text-slate-400 flex items-center gap-2" role="status">
            <span
              className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"
              aria-hidden
            />
            연결 확인 중…
          </p>
        )}

        {testPhase === 'success' && testResult?.ok && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/20 px-3 py-2 text-[13px] text-emerald-800 dark:text-emerald-200">
            연결 테스트에 성공했습니다.
            {testResult.api_key_masked && (
              <span className="block mt-1 font-mono text-[12px] opacity-90">
                키(마스킹): {testResult.api_key_masked}
              </span>
            )}
          </div>
        )}

        {testResult?.permission_withdraw && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/25 px-3 py-2 text-[12px] text-red-800 dark:text-red-200">
            <strong>경고:</strong> 출금 권한이 감지되었습니다. 출금이 불가능한 키로 다시 발급하는 것을 권장합니다.
          </div>
        )}

        {savePhase === 'success' && (
          <p className="text-[13px] text-emerald-600 dark:text-emerald-400">저장되었습니다. 마이페이지에서 연결 상태를 확인할 수 있습니다.</p>
        )}

        {(testPhase === 'error' || savePhase === 'error') && error && (
          <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
        )}

        <ul className="mt-6 space-y-1.5 text-[13px] text-slate-500 dark:text-slate-400 list-disc list-inside leading-relaxed">
          <li>출금 권한이 없는 API 키만 연결하세요.</li>
          <li>자동 실행이 아닌 직접 실행 구조입니다. 투자 판단과 책임은 본인에게 있습니다.</li>
          <li>API Secret은 서버에서만 암호화 저장되며, 화면에 다시 표시되지 않습니다.</li>
        </ul>
      </div>
    </PageShell>
  )
}

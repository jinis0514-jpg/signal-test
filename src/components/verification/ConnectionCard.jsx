import { cn } from '../../lib/cn'
import { SUPPORTED_EXCHANGES } from '../../lib/exchangeConnectionService'

function TradeBadge({ enabled }) {
  const tone = enabled
    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300'
  return (
    <span className={cn('text-[10px] px-2 py-1 rounded font-medium', tone)}>
      거래: {enabled ? 'OK' : '—'}
    </span>
  )
}

function WithdrawBadge({ enabled }) {
  const tone = enabled
    ? 'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
  return (
    <span className={cn('text-[10px] px-2 py-1 rounded font-medium', tone)}>
      출금: {enabled ? '감지' : '—'}
    </span>
  )
}

function ReadBadge({ ok }) {
  const tone = ok
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
  return (
    <span className={cn('text-[10px] px-2 py-1 rounded font-medium', tone)}>
      읽기: {ok ? 'OK' : '—'}
    </span>
  )
}

/**
 * 연결 상태 카드 — seller_exchange_connections 행 또는 동일 필드 shape
 * @param {object} props
 * @param {object} props.connection
 * @param {(id: string) => void} [props.onRevoke]
 * @param {string} [props.className]
 */
export default function ConnectionCard({ connection, onRevoke, className = '' }) {
  const conn = connection ?? {}
  const exchangeLabel =
    SUPPORTED_EXCHANGES.find((e) => e.id === conn.exchange_name)?.name ?? conn.exchange_name ?? '—'
  const maskedKey = conn.api_key_masked ?? '—'
  const active = conn.is_active !== false

  const read = conn.permission_read
  const trade = conn.permission_trade
  const withdraw = conn.permission_withdraw

  const lastTested = conn.last_connection_test_at
    ? new Date(conn.last_connection_test_at).toLocaleString('ko-KR')
    : null
  const lastSync = conn.last_sync_at
    ? new Date(conn.last_sync_at).toLocaleString('ko-KR')
    : null

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/40 p-4 space-y-2',
        className,
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{exchangeLabel}</p>
        <span
          className={cn(
            'text-xs font-medium shrink-0',
            active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
          )}
        >
          {active ? '연결됨' : '비활성'}
        </span>
      </div>

      <p className="text-[13px] text-slate-500 dark:text-slate-400">
        <span className="text-slate-600 dark:text-slate-500">API Key: </span>
        <span className="font-mono tabular-nums">{maskedKey}</span>
      </p>

      <div className="flex flex-wrap gap-2 text-xs">
        {read != null && <ReadBadge ok={read} />}
        {trade != null && <TradeBadge enabled={trade} />}
        {withdraw != null && <WithdrawBadge enabled={withdraw} />}
        {read == null && trade == null && withdraw == null && (
          <span className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            권한 정보 없음 (재연결 시 확인)
          </span>
        )}
      </div>

      <div className="text-[11px] text-slate-400 dark:text-slate-500 space-y-0.5">
        {lastTested && (
          <p>
            마지막 확인(권한): {lastTested}
            {conn.connection_test_ok === false ? ' · 재확인 필요' : ''}
          </p>
        )}
        {lastSync && (
          <p>마지막 동기화: {lastSync}</p>
        )}
        {!lastTested && !lastSync && <p>마지막 확인: —</p>}
      </div>

      {onRevoke && conn.id && active && (
        <button
          type="button"
          className="mt-1 text-[13px] font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          onClick={() => onRevoke(conn.id)}
        >
          연결 해제
        </button>
      )}
    </div>
  )
}

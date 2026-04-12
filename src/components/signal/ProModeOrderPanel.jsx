import { useState, useEffect, useCallback } from 'react'
import { MousePointerClick } from 'lucide-react'
import Button from '../ui/Button'
import ConfirmModal from '../ui/ConfirmModal'
import ExecutionStatus from './ExecutionStatus'
import { fetchMyConnections } from '../../lib/exchangeConnectionService'
import { executeProModeOrderClick } from '../../lib/proModeOrderService'
import { isSupabaseConfigured } from '../../lib/supabase'

/**
 * PRO MODE — API는 마이페이지에서 등록(서버 암호화), 주문은 이 버튼 클릭 시에만
 */
export default function ProModeOrderPanel({
  binancePair,
  smartOrderPrep,
  onGoMyPage,
}) {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [executionStatus, setExecutionStatus] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    fetchMyConnections()
      .then((rows) => setConnections(Array.isArray(rows) ? rows : []))
      .catch(() => setConnections([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const activeConn = connections.find((c) => c && c.is_active !== false)

  const canTryOrder =
    !!activeConn
    && smartOrderPrep
    && Number(smartOrderPrep.entryPrice) > 0

  const runExecute = useCallback(async () => {
    if (!activeConn || !canTryOrder) return
    setPending(true)
    setFeedback('')
    setExecutionStatus('pending')
    try {
      const r = await executeProModeOrderClick({
        connectionId: activeConn.id,
        symbol: binancePair,
        side: smartOrderPrep.direction,
        recommendedKrw: smartOrderPrep.recommendedKrw,
      })
      const msg = r.message
        ?? (r.ok ? '주문 요청을 보냈습니다.' : '처리할 수 없습니다.')
      setFeedback(msg)
      setExecutionStatus(r.ok ? 'submitted' : 'failed')
    } catch (e) {
      const err = String(e?.message ?? '오류가 발생했습니다.')
      setFeedback(err)
      setExecutionStatus('failed')
    } finally {
      setPending(false)
    }
  }, [activeConn, binancePair, canTryOrder, smartOrderPrep])

  useEffect(() => {
    setExecutionStatus(null)
    setFeedback('')
  }, [binancePair, smartOrderPrep?.direction])

  const handleOpenConfirm = () => {
    if (!activeConn || !canTryOrder || pending || loading) return
    setConfirmOpen(true)
  }

  const handleConfirmExecute = () => {
    setConfirmOpen(false)
    void runExecute()
  }

  return (
    <>
    <ConfirmModal
      open={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      onConfirm={handleConfirmExecute}
      title="주문 확인"
      confirmLabel="실행"
      cancelLabel="취소"
    />
    <div className="rounded-lg border border-rose-200/90 dark:border-rose-900/45 bg-rose-50/50 dark:bg-rose-950/20 px-2.5 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <MousePointerClick size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
            PRO MODE · API 클릭 실행
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            API 키는 마이페이지에서만 입력되며 서버에 암호화 저장됩니다.
            <strong className="text-slate-700 dark:text-slate-300"> 자동 주문·자동 실행은 없고</strong>
            , 아래 버튼을 누른 때만 주문 요청이 전달됩니다.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-8 text-[11px] gap-1 bg-rose-700 hover:bg-rose-800 dark:bg-rose-800 dark:hover:bg-rose-700 border-0"
          disabled={pending || loading || !canTryOrder}
          onClick={handleOpenConfirm}
        >
          <MousePointerClick size={12} aria-hidden />
          {pending ? '요청 중…' : '주문 실행'}
        </Button>
        <button
          type="button"
          className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 hover:underline"
          onClick={() => onGoMyPage?.()}
        >
          API 키 설정 →
        </button>
        {!loading && !activeConn && (
          <span className="text-[10px] text-amber-700 dark:text-amber-400">연결 필요</span>
        )}
        {isSupabaseConfigured() ? null : (
          <span className="text-[10px] text-slate-400">로컬 데모</span>
        )}
      </div>

      <ExecutionStatus status={executionStatus} detail={feedback || undefined} />
    </div>
    </>
  )
}

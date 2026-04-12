import { cn } from '../../lib/cn'

export const EXECUTION_STATUS_LABELS = {
  pending: '주문 요청 중',
  submitted: '거래소 전달 완료',
  unknown: '확인 중',
  partial_fill: '부분 체결',
  filled: '체결 완료',
  canceled: '취소됨',
  failed: '실패',
}

const STATUS_TONE = {
  pending: 'border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
  submitted: 'border-blue-200 bg-blue-50/90 text-blue-900 dark:border-blue-900/45 dark:bg-blue-950/30 dark:text-blue-200',
  unknown: 'border-violet-200 bg-violet-50/90 text-violet-900 dark:border-violet-900/45 dark:bg-violet-950/30 dark:text-violet-200',
  partial_fill: 'border-cyan-200 bg-cyan-50/90 text-cyan-900 dark:border-cyan-900/45 dark:bg-cyan-950/30 dark:text-cyan-200',
  filled: 'border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/45 dark:bg-emerald-950/30 dark:text-emerald-200',
  canceled: 'border-slate-200 bg-slate-100 text-slate-800 dark:border-gray-600 dark:bg-gray-800/80 dark:text-slate-200',
  failed: 'border-red-200 bg-red-50/90 text-red-900 dark:border-red-900/45 dark:bg-red-950/35 dark:text-red-200',
}

/**
 * 실행 상태 카드 (execution_requests 상태와 동일 명칭)
 * @param {object} props
 * @param {keyof typeof EXECUTION_STATUS_LABELS | null | undefined} props.status
 * @param {string} [props.detail] 부가 메시지(서버 문구 등)
 * @param {string} [props.className]
 */
export default function ExecutionStatus({ status, detail, className = '' }) {
  if (status == null || !EXECUTION_STATUS_LABELS[status]) {
    return null
  }

  const label = EXECUTION_STATUS_LABELS[status]
  const tone = STATUS_TONE[status] ?? STATUS_TONE.unknown

  return (
    <div
      className={cn(
        'mt-4 rounded-xl border px-3 py-2.5 text-[13px] leading-snug',
        tone,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">{label}</p>
      {status === 'unknown' && (
        <p className="mt-1 text-[11px] opacity-90 font-normal">
          타임아웃 시 실패로 단정하지 않습니다. 잠시 후 다시 확인해 주세요.
        </p>
      )}
      {detail ? (
        <p className="mt-1 text-[11px] opacity-90 font-normal whitespace-pre-wrap">{detail}</p>
      ) : null}
    </div>
  )
}

import { memo } from 'react'
import Badge from '../ui/Badge'
import { cn } from '../../lib/cn'

const TYPE_BADGE = {
  LONG:  'long',
  SHORT: 'short',
  EXIT:  'default',
  WAIT:  'default',
}

const TYPE_LABEL = {
  LONG:  'LONG',
  SHORT: 'SHORT',
  EXIT:  'EXIT',
  WAIT:  'WAIT',
}

function fmtTs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return null
  try {
    return new Date(n).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

function SignalList({ signals }) {
  if (!signals.length) {
    return (
      <div className="px-4 py-7 text-center">
        <p className="text-[12px] text-slate-400">시그널 없음</p>
      </div>
    )
  }

  return (
    <div>
      {signals.map((s, i) => {
        const isWait = s.type === 'WAIT'
        const isExit = s.type === 'EXIT'
        const isEntry = s.type === 'LONG' || s.type === 'SHORT'

        return (
          <div
            key={s.id}
            className={cn(
              'flex items-start gap-3 px-3.5 py-2.5',
              i < signals.length - 1 && 'border-b border-slate-100 dark:border-gray-800',
              isWait && 'opacity-60',
            )}
          >
            {/* 타입 배지 */}
            <div className="pt-px flex-shrink-0">
              {isWait ? (
                <span className="inline-flex items-center h-[18px] px-2 text-[12px] font-semibold tracking-wide border rounded-md bg-slate-50 text-slate-400 border-slate-200 dark:bg-gray-800 dark:text-slate-600 dark:border-gray-700">
                  WAIT
                </span>
              ) : (
                <Badge variant={TYPE_BADGE[s.type] ?? 'default'}>
                  {TYPE_LABEL[s.type] ?? s.type}
                </Badge>
              )}
            </div>

            {/* 내용 */}
            <div className="flex-1 min-w-0">
              {isWait ? (
                <>
                  <p className="text-[12px] text-slate-400 dark:text-slate-600 italic">{s.note}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{s.time}</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      {s.price?.toLocaleString() ?? '—'}
                    </p>
                    {/* 오픈 포지션 표시 */}
                    {s.open && isEntry && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-500">
                        <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                        진행 중
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[11px] text-slate-400 tabular-nums">{s.time}</p>
                    {s.note && (
                      <p className="text-[11px] text-slate-400 truncate">{s.note}</p>
                    )}
                  </div>
                  {(s.generatedAtMs || s.displayedAtMs) && (
                    <div className="mt-1 text-[10px] text-slate-400 font-mono tabular-nums space-y-0.5">
                      {s.generatedAtMs && (
                        <p>생성 {fmtTs(s.generatedAtMs) ?? '—'}</p>
                      )}
                      {s.displayedAtMs && (
                        <p>표시 {fmtTs(s.displayedAtMs) ?? '—'}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 손익 */}
            {!isWait && !isExit && !s.open && s.pnl && (
              <span
                className={cn(
                  'flex-shrink-0 text-[12px] font-bold font-mono tabular-nums mt-px',
                  s.pnl.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                )}
              >
                {s.pnl}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function signalListEqual(prev, next) {
  if (prev.signals === next.signals) return true
  const a = prev.signals
  const b = next.signals
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.id !== y.id || x.type !== y.type || x.price !== y.price || x.pnl !== y.pnl || x.open !== y.open || x.note !== y.note) return false
  }
  return true
}

export default memo(SignalList, signalListEqual)

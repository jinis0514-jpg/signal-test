import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import Badge, { dirVariant } from '../ui/Badge'
import Button from '../ui/Button'
import { cn } from '../../lib/cn'

/**
 * 시그널 → 주문 준비 UI (클립보드·거래소 이동은 부모 onPrepare에서 처리)
 *
 * @param {object} props
 * @param {{ symbol: string, side: string }} props.signal
 * @param {string} [props.entryPriceLabel] 진입가 표시 문자열
 * @param {string} [props.recommendedKrwLabel] 추천 금액 표시 문자열
 * @param {(qty: string) => void | Promise<void>} props.onPrepare
 * @param {string} [props.feedback]
 * @param {string} [props.className]
 */
export default function SignalExecution({
  signal,
  entryPriceLabel,
  recommendedKrwLabel,
  onPrepare,
  feedback,
  className = '',
}) {
  const [qty, setQty] = useState('')

  const symbol = signal?.symbol ?? '—'
  const side = String(signal?.side ?? 'LONG').toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG'

  return (
    <div
      className={cn(
        'rounded-xl border border-violet-200/80 dark:border-violet-900/45 bg-violet-50/50 dark:bg-violet-950/20 p-4 mt-4 space-y-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">주문 준비</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            자동 주문이 아닙니다. 수량을 적은 뒤 준비하면 클립보드에 반영되며, 거래소에서 직접 확인하세요.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
        <div className="rounded-lg border border-white/80 bg-white/90 dark:bg-gray-900/60 dark:border-gray-700 px-3 py-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">심볼</p>
          <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {symbol}
          </p>
        </div>
        <div className="rounded-lg border border-white/80 bg-white/90 dark:bg-gray-900/60 dark:border-gray-700 px-3 py-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">방향</p>
          <div className="mt-0.5">
            <Badge variant={dirVariant(side)}>{side}</Badge>
          </div>
        </div>
      </div>

      {(entryPriceLabel != null || recommendedKrwLabel != null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
          {entryPriceLabel != null && (
            <div className="rounded-lg border border-white/80 bg-white/90 dark:bg-gray-900/60 dark:border-gray-700 px-3 py-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">진입 가격(참고)</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {entryPriceLabel}
              </p>
            </div>
          )}
          {recommendedKrwLabel != null && (
            <div className="rounded-lg border border-white/80 bg-white/90 dark:bg-gray-900/60 dark:border-gray-700 px-3 py-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">추천 금액(참고)</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {recommendedKrwLabel}
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="signal-exec-qty" className="text-[11px] text-slate-600 dark:text-slate-400 mb-1 block">
          수량 (선택, 거래소 기준에 맞게 입력)
        </label>
        <input
          id="signal-exec-qty"
          type="text"
          inputMode="decimal"
          placeholder="예: 0.001 또는 거래소 주문 수량"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          autoComplete="off"
          className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
      </div>

      <Button
        type="button"
        variant="primary"
        className="w-full h-10 text-[13px] gap-1.5"
        onClick={() => onPrepare?.(qty.trim())}
      >
        <Sparkles size={14} className="opacity-90" aria-hidden />
        주문 준비
      </Button>

      {feedback ? (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{feedback}</p>
      ) : null}

      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
        * 직접 실행되는 주문입니다 (자동 아님). 투자 판단과 책임은 본인에게 있습니다.
      </p>
    </div>
  )
}

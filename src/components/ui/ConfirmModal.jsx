import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

/**
 * 최종 실행 확인 모달 — 직접 실행·책임 고지
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onClose
 * @param {string} [props.title]
 * @param {React.ReactNode} [props.children] 추가 본문
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 */
export default function ConfirmModal({
  open,
  onConfirm,
  onClose,
  title = '주문 확인',
  children,
  confirmLabel = '실행',
  cancelLabel = '취소',
}) {
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, onKeyDown])

  if (!open) return null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 dark:bg-black/60 cursor-default"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-[20rem] rounded-xl border border-slate-200 dark:border-gray-700',
          'bg-white dark:bg-gray-900 shadow-xl p-6 space-y-3 text-left',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>

        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed mt-1">
          이 주문은 자동 실행이 아닌 사용자가 직접 실행하는 주문입니다.
        </p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
          모든 거래 책임은 사용자에게 있습니다.
        </p>

        {children}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-slate-200 dark:border-gray-600 text-[13px] font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-10 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

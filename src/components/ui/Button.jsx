import { useState, useCallback } from 'react'
import { cn } from '../../lib/cn'

const VARIANTS = {
  primary:
    'bg-[#2962ff] text-white border-[#2962ff] hover:bg-[#1e56e6] hover:border-[#1e56e6] ' +
    'dark:bg-[#2962ff] dark:text-white dark:border-[#2962ff] dark:hover:bg-[#3d7aff] dark:hover:border-[#3d7aff]',
  secondary:
    'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300 ' +
    'dark:bg-gray-900 dark:text-slate-200 dark:border-gray-600 dark:hover:bg-gray-800 dark:hover:border-gray-500',
  ghost:
    'bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-800 ' +
    'dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-slate-100',
  danger:
    'bg-[#ea3943] text-white border-[#ea3943] hover:bg-red-700 hover:border-red-700 ' +
    'dark:bg-[#ea3943] dark:border-[#ea3943] dark:hover:bg-red-500',
}

const SIZES = {
  sm: 'h-8  px-3    text-[11px] gap-1.5',
  md: 'h-10 px-4    text-[13px] gap-2',
  lg: 'h-11 px-5    text-[14px] gap-2',
}

const BASE =
  'inline-flex items-center justify-center font-semibold ' +
  'border rounded-[8px] ' +
  'transition-[color,background-color,border-color,opacity,box-shadow] duration-[120ms] ease-out ' +
  'focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-1'

const DISABLED =
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none'

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 mx-0.5" aria-hidden>
      <span className="bb-btn-dot" />
      <span className="bb-btn-dot animation-delay-150" />
      <span className="bb-btn-dot animation-delay-300" />
    </span>
  )
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  disabled,
  isLoading = false,
  onClick,
  type = 'button',
  ...props
}) {
  const [pressed, setPressed] = useState(false)
  const effectiveDisabled = disabled || isLoading

  const handleClick = useCallback(
    (e) => {
      if (effectiveDisabled) return
      setPressed(true)
      window.setTimeout(() => setPressed(false), 120)
      onClick?.(e)
    },
    [effectiveDisabled, onClick],
  )

  return (
    <button
      type={type}
      className={cn(
        BASE,
        DISABLED,
        isLoading && 'cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        pressed && !effectiveDisabled && 'scale-[0.98]',
        className,
      )}
      disabled={effectiveDisabled}
      aria-busy={isLoading || undefined}
      onClick={handleClick}
      {...props}
    >
      {isLoading && (
        <span className="inline-flex items-center shrink-0 mr-1" aria-hidden>
          <LoadingDots />
        </span>
      )}
      <span className={cn('inline-flex items-center', isLoading && 'opacity-60')}>{children}</span>
    </button>
  )
}

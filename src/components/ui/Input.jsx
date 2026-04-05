import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

const Input = forwardRef(function Input(
  { className, icon, error, 'aria-invalid': ariaInvalid, ...props },
  ref,
) {
  const invalid = Boolean(error) || ariaInvalid === true || props['aria-invalid'] === 'true'
  const type = props.type ?? 'text'
  const showInvalidStyle = invalid || (type === 'number' && props.value !== '' && props.value != null && Number.isNaN(Number(props.value)))

  const base =
    'h-9 w-full bg-white text-[13px] text-slate-700 placeholder:text-slate-400 ' +
    'border rounded-[8px] ' +
    'focus:outline-none focus:ring-0 ' +
    'transition-[border-color,background-color,opacity] duration-[120ms] ' +
    'dark:bg-gray-900 dark:text-slate-300 ' +
    (showInvalidStyle
      ? 'border-red-400 focus:border-red-500 dark:border-red-600 dark:focus:border-red-500 bg-red-50/40 dark:bg-red-950/20 '
      : 'border-slate-200 focus:border-slate-500 dark:border-gray-700 dark:focus:border-slate-400 ')

  const inputProps = {
    ...props,
    ref,
    'aria-invalid': invalid || showInvalidStyle || undefined,
    title: typeof error === 'string' && error ? error : props.title,
  }

  const field = icon ? (
    <div className="relative flex items-center w-full">
      <span className="absolute left-2 text-slate-400 pointer-events-none flex items-center">
        {icon}
      </span>
      <input className={cn(base, 'pl-7 pr-2.5', className)} {...inputProps} />
    </div>
  ) : (
    <input className={cn(base, 'px-2', className)} {...inputProps} />
  )

  if (typeof error === 'string' && error) {
    return (
      <div className="w-full">
        {field}
        <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 leading-tight">{error}</p>
      </div>
    )
  }

  return field
})

export default Input

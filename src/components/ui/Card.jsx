import { cn } from '../../lib/cn'

function Card({ className, children, interactive = false }) {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-[8px]',
        'dark:bg-gray-900 dark:border-gray-800',
        'shadow-none',
        interactive && [
          'hover:border-slate-300 dark:hover:border-gray-600',
          'cursor-pointer',
        ],
        className,
      )}
    >
      {children}
    </div>
  )
}

Card.Header = function CardHeader({ className, children }) {
  return (
    <div
      className={cn(
        'px-4 py-3 border-b border-slate-100 dark:border-gray-800',
        className,
      )}
    >
      {children}
    </div>
  )
}

Card.Title = function CardTitle({ className, children }) {
  return (
    <h3 className={cn('text-[14px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight', className)}>
      {children}
    </h3>
  )
}

Card.Content = function CardContent({ className, children }) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({ className, children }) {
  return (
    <div
      className={cn(
        'px-4 py-2.5 border-t border-slate-100 dark:border-gray-800',
        className,
      )}
    >
      {children}
    </div>
  )
}

export default Card

import { cn } from '../../lib/cn'

function Card({ className, children }) {
  return (
    <div
      className={cn(
        'bg-white border border-slate-150 rounded-[2px]',
        'dark:bg-gray-900 dark:border-gray-800',
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
        'px-3 py-1.5 border-b border-slate-100 bg-slate-50/40',
        'dark:border-gray-800 dark:bg-gray-800/30',
        className,
      )}
    >
      {children}
    </div>
  )
}

Card.Title = function CardTitle({ className, children }) {
  return (
    <h3 className={cn('text-[11px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight', className)}>
      {children}
    </h3>
  )
}

Card.Content = function CardContent({ className, children }) {
  return (
    <div className={cn('p-3', className)}>
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({ className, children }) {
  return (
    <div
      className={cn(
        'px-3 py-1.5 border-t border-slate-100 bg-slate-50/30',
        'dark:border-gray-800 dark:bg-gray-800/20',
        className,
      )}
    >
      {children}
    </div>
  )
}

export default Card

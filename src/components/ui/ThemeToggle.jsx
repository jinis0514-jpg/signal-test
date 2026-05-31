import { Moon, Sun } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useTheme } from '../../hooks/useTheme'

export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => {
        toggleTheme()
      }}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-lg',
        'text-text-tertiary hover:text-text-primary',
        'hover:bg-bg-surface-2/60',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
        className,
      )}
      aria-label="테마 변경"
    >
      {isDark ? <Moon size={14} strokeWidth={1.8} /> : <Sun size={14} strokeWidth={1.8} />}
    </button>
  )
}


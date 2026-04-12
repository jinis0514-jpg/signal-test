import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * 시그널 차트용 심볼 선택 — 검색 + 키보드 (↑↓ Enter Esc) + 바깥 클릭 닫힘
 */
export default function ChartSymbolCombobox({
  value = '',
  onChange,
  onCommit,
  suggestions = [],
  favoriteSet,
  onToggleFavorite,
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(String(value ?? '').toUpperCase())
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setQ(String(value ?? '').toUpperCase())
  }, [value])

  const filtered = useMemo(() => {
    if (!Array.isArray(suggestions)) return []
    const qq = String(q ?? '').trim().toUpperCase()
    if (!qq) return suggestions.slice(0, 28)
    return suggestions.filter((p) => {
      const sym = typeof p?.symbol === 'string' ? p.symbol.toUpperCase() : ''
      const base = typeof p?.baseAsset === 'string' ? p.baseAsset.toUpperCase() : ''
      return sym.includes(qq) || base.includes(qq)
    }).slice(0, 40)
  }, [suggestions, q])

  useEffect(() => {
    setHighlight(0)
  }, [filtered.length, open, q])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = useCallback((pair) => {
    const s = String(pair ?? '').trim().toUpperCase()
    if (!s) return
    onChange?.(s)
    onCommit?.(s)
    setQ(s)
    setOpen(false)
  }, [onChange, onCommit])

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) {
        const row = filtered[highlight] ?? filtered[0]
        const pair = typeof row?.symbol === 'string' ? row.symbol : ''
        if (pair) pick(pair)
        return
      }
      const typed = String(q ?? '').trim().toUpperCase()
      if (typed) {
        onChange?.(typed)
        onCommit?.(typed)
        setOpen(false)
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative min-w-0 flex-1 sm:max-w-[240px]', className)}>
      <label htmlFor="chart-symbol-combo" className="text-[9px] text-slate-500 block mb-0.5">
        차트 심볼 (USDT)
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="chart-symbol-combo"
          type="text"
          value={q}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const v = String(e.target.value).toUpperCase()
            setQ(v)
            onChange?.(v)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          placeholder="BTCUSDT"
          className="w-full h-8 pl-2 pr-8 text-[11px] rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/35 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen((o) => !o); inputRef.current?.focus() }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
          aria-label="심볼 목록 열기"
        >
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && !disabled && filtered.length > 0 && (
        <ul
          className="absolute z-30 mt-1 w-full max-h-[10rem] overflow-y-auto rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] shadow-lg divide-y divide-slate-100 dark:divide-gray-800"
          role="listbox"
        >
          {filtered.map((p, idx) => {
            const pair = typeof p.symbol === 'string' ? p.symbol : ''
            const base = typeof p.baseAsset === 'string' ? p.baseAsset : ''
            const fav = base && favoriteSet?.has?.(base)
            return (
              <li
                key={pair || idx}
                className={cn(
                  'flex items-center gap-1 px-1',
                  idx === highlight && 'bg-slate-100 dark:bg-gray-800',
                )}
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left font-mono px-2 py-1.5 text-slate-800 dark:text-slate-200 truncate"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(pair)}
                >
                  {pair}
                </button>
                {base && typeof onToggleFavorite === 'function' && (
                  <button
                    type="button"
                    className="p-1 rounded text-amber-500 hover:bg-amber-50/80 dark:hover:bg-amber-950/30 shrink-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onToggleFavorite(base)}
                    aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기'}
                  >
                    <Star size={13} className={cn(fav ? 'fill-amber-400 text-amber-500' : 'text-slate-400')} strokeWidth={2} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

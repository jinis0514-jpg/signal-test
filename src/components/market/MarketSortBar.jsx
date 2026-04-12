import { cn } from '../../lib/cn'
import { MARKET_SORT_TABS } from '../../data/marketMockData'

export default function MarketSortBar({ value, onChange }) {
  const SIMPLE_SORT_TABS = MARKET_SORT_TABS.filter((tab) => (
    tab.value === 'recommend_desc'
    || tab.value === 'return_desc'
    || tab.value === 'winRate_desc'
    || tab.value === 'updated_desc'
  ))
  return (
    <div
      className="
        flex flex-wrap items-center gap-1.5 mb-3 pb-3
        border-b border-slate-100 dark:border-gray-800
      "
      role="tablist"
      aria-label="정렬 기준"
    >
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-1">
        정렬
      </span>
      {SIMPLE_SORT_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'h-7 px-2.5 text-[11px] font-medium rounded-lg border transition-colors',
            value === tab.value
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-800 ' +
                'dark:bg-gray-900 dark:text-slate-500 dark:border-gray-700 dark:hover:border-gray-500',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

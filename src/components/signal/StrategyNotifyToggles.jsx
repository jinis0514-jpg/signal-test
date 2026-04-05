import { cn } from '../../lib/cn'
import {
  normalizeStrategyNotifySettings,
} from '../../lib/strategyNotificationSettings'

function TinyToggle({ label, active, disabled, onToggle }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        active
          ? 'border-slate-800 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-200 bg-white text-slate-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-400',
      )}
    >
      {label}
    </button>
  )
}

/**
 * @param {{
 *   strategyName: string,
 *   settingsRaw: object | undefined,
 *   onPatch: (patch: { all?: boolean, long?: boolean, short?: boolean, exit?: boolean }) => void
 * }} props
 */
export default function StrategyNotifyToggles({
  strategyName,
  settingsRaw,
  onPatch,
}) {
  const s = normalizeStrategyNotifySettings(settingsRaw)
  const masterOff = !s.all

  return (
    <div
      className="rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-900/40"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[9px] font-semibold text-slate-700 dark:text-slate-200 truncate mb-1" title={strategyName}>
        {strategyName}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <TinyToggle
          label="전체"
          active={s.all}
          disabled={false}
          onToggle={() => onPatch({ all: !s.all })}
        />
        <TinyToggle
          label="LONG"
          active={s.long}
          disabled={masterOff}
          onToggle={() => onPatch({ long: !s.long })}
        />
        <TinyToggle
          label="SHORT"
          active={s.short}
          disabled={masterOff}
          onToggle={() => onPatch({ short: !s.short })}
        />
        <TinyToggle
          label="청산"
          active={s.exit}
          disabled={masterOff}
          onToggle={() => onPatch({ exit: !s.exit })}
        />
      </div>
    </div>
  )
}

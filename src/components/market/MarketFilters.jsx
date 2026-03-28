import { Search } from 'lucide-react'
import { cn } from '../../lib/cn'
import Input from '../ui/Input'
import Button from '../ui/Button'
import {
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  RECOMMEND_OPTIONS,
  SORT_OPTIONS,
  ASSET_OPTIONS,
  TIMEFRAME_OPTIONS,
  MARKET_ENV_OPTIONS,
} from '../../data/marketMockData'

function FilterSection({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

function PillGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onToggle(opt.value)}
          className={cn(
            'h-6 px-2 text-[11px] font-medium border rounded-[1px] transition-colors',
            selected.includes(opt.value)
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700 ' +
                'dark:bg-gray-900 dark:text-slate-500 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:text-slate-400',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function NumberInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] text-slate-400 block mb-0.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          h-7 w-full text-[11px] px-2
          border border-slate-200 dark:border-gray-700
          rounded-[1px]
          text-slate-700 dark:text-slate-300
          placeholder:text-slate-300 dark:placeholder:text-slate-700
          bg-white dark:bg-gray-900
          focus:outline-none focus:border-slate-400 dark:focus:border-gray-500
          transition-colors
        "
      />
    </div>
  )
}

export default function MarketFilters({ filters, onChange, onReset }) {
  function toggle(field, value) {
    const arr = filters[field] ?? []
    onChange(
      field,
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    )
  }

  const isActive =
    filters.search !== '' ||
    filters.types.length > 0 ||
    filters.status.length > 0 ||
    filters.recommend.length > 0 ||
    (filters.assets ?? []).length > 0 ||
    (filters.holdings ?? []).length > 0 ||
    (filters.marketEnv ?? []).length > 0 ||
    filters.roiMin !== '' ||
    filters.winMin !== '' ||
    filters.mddMax !== ''

  return (
    <div className="p-3.5">

      {/* 검색 */}
      <FilterSection title="전략 검색">
        <Input
          icon={<Search size={11} strokeWidth={1.8} />}
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
          placeholder="전략명 검색..."
        />
      </FilterSection>

      {/* 자산 유형 */}
      <FilterSection title="자산 유형">
        <PillGroup
          options={ASSET_OPTIONS}
          selected={filters.assets ?? []}
          onToggle={(v) => toggle('assets', v)}
        />
      </FilterSection>

      {/* 보유 기간 */}
      <FilterSection title="보유 기간">
        <PillGroup
          options={TIMEFRAME_OPTIONS}
          selected={filters.holdings ?? []}
          onToggle={(v) => toggle('holdings', v)}
        />
      </FilterSection>

      {/* 적합 시장 */}
      <FilterSection title="적합 시장">
        <PillGroup
          options={MARKET_ENV_OPTIONS}
          selected={filters.marketEnv ?? []}
          onToggle={(v) => toggle('marketEnv', v)}
        />
      </FilterSection>

      {/* 전략 유형 */}
      <FilterSection title="전략 유형">
        <PillGroup
          options={TYPE_OPTIONS}
          selected={filters.types}
          onToggle={(v) => toggle('types', v)}
        />
      </FilterSection>

      {/* 상태 */}
      <FilterSection title="상태">
        <PillGroup
          options={STATUS_OPTIONS}
          selected={filters.status}
          onToggle={(v) => toggle('status', v)}
        />
      </FilterSection>

      {/* 추천 등급 */}
      <FilterSection title="추천 등급">
        <PillGroup
          options={RECOMMEND_OPTIONS}
          selected={filters.recommend}
          onToggle={(v) => toggle('recommend', v)}
        />
      </FilterSection>

      {/* 수치 필터 */}
      <FilterSection title="수치 조건">
        <div className="space-y-2">
          <NumberInput
            label="ROI 최소 (%)"
            value={filters.roiMin}
            onChange={(v) => onChange('roiMin', v)}
            placeholder="예: 20"
          />
          <NumberInput
            label="승률 최소 (%)"
            value={filters.winMin}
            onChange={(v) => onChange('winMin', v)}
            placeholder="예: 60"
          />
          <NumberInput
            label="MDD 최대 (%)"
            value={filters.mddMax}
            onChange={(v) => onChange('mddMax', v)}
            placeholder="예: 15"
          />
        </div>
      </FilterSection>

      {/* 정렬 */}
      <FilterSection title="정렬 기준">
        <select
          value={filters.sort}
          onChange={(e) => onChange('sort', e.target.value)}
          className="
            h-7 w-full text-[11px] px-1.5
            border border-slate-200 dark:border-gray-700
            rounded-[1px]
            text-slate-700 dark:text-slate-300
            bg-white dark:bg-gray-900
            focus:outline-none focus:border-slate-400 dark:focus:border-gray-500
          "
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </FilterSection>

      {/* 초기화 */}
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="sm"
        onClick={onReset}
        className="w-full"
      >
        필터 초기화
      </Button>
    </div>
  )
}

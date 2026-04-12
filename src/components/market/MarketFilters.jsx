import { Search } from 'lucide-react'
import { cn } from '../../lib/cn'
import Input from '../ui/Input'
import Button from '../ui/Button'
import {
  TYPE_OPTIONS,
  ARCHETYPE_OPTIONS,
  PROFILE_OPTIONS,
  SORT_OPTIONS,
  ASSET_OPTIONS,
  MARKET_LENS_OPTIONS,
} from '../../data/marketMockData'

function FilterSection({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

function PillGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onToggle(opt.value)}
          className={cn(
            'h-7 px-2.5 text-[12px] font-medium border rounded-md transition-colors',
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
      <label className="text-[11px] text-slate-500 dark:text-slate-500 block mb-0.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          h-8 w-full text-[12px] px-2
          border border-slate-200 dark:border-gray-700
          rounded-md
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

  function toggleLens(value) {
    const arr = filters.marketLens ?? []
    onChange(
      'marketLens',
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    )
  }

  const isActive =
    filters.search !== '' ||
    filters.types.length > 0 ||
    (filters.archetype ?? []).length > 0 ||
    (filters.profile ?? []).length > 0 ||
    (filters.assets ?? []).length > 0 ||
    (filters.marketLens ?? []).length > 0 ||
    filters.roiMin !== '' ||
    (filters.recentRoiMin ?? '') !== '' ||
    filters.winMin !== '' ||
    filters.mddMax !== '' ||
    (filters.tradesMin ?? '') !== '' ||
    (filters.priceMaxKrw ?? '') !== ''

  return (
    <div className="p-3.5">
      <p className="mb-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200">목록 필터</p>

      <FilterSection title="검색">
        <Input
          icon={<Search size={12} strokeWidth={1.8} />}
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
          placeholder="이름 검색"
        />
      </FilterSection>

      <FilterSection title="자산">
        <PillGroup
          options={ASSET_OPTIONS}
          selected={filters.assets ?? []}
          onToggle={(v) => toggle('assets', v)}
        />
      </FilterSection>

      <FilterSection title="원본 유형 (태그)">
        <PillGroup
          options={TYPE_OPTIONS}
          selected={filters.types}
          onToggle={(v) => toggle('types', v)}
        />
      </FilterSection>

      <FilterSection title="분류 유형">
        <PillGroup
          options={ARCHETYPE_OPTIONS}
          selected={filters.archetype ?? []}
          onToggle={(v) => toggle('archetype', v)}
        />
      </FilterSection>

      <FilterSection title="투자 성향">
        <PillGroup
          options={PROFILE_OPTIONS}
          selected={filters.profile ?? []}
          onToggle={(v) => toggle('profile', v)}
        />
      </FilterSection>

      <FilterSection title="시장 연동">
        <PillGroup
          options={MARKET_LENS_OPTIONS}
          selected={filters.marketLens ?? []}
          onToggle={toggleLens}
        />
      </FilterSection>

      <FilterSection title="수치">
        <div className="space-y-2">
          <NumberInput
            label="월 구독가 상한 (원)"
            value={filters.priceMaxKrw ?? ''}
            onChange={(v) => onChange('priceMaxKrw', v)}
            placeholder="예: 50000"
          />
          <NumberInput
            label="누적 수익률 최소 (%)"
            value={filters.roiMin}
            onChange={(v) => onChange('roiMin', v)}
            placeholder="예: 20"
          />
          <NumberInput
            label="최근 7일 성과 최소 (%)"
            value={filters.recentRoiMin ?? ''}
            onChange={(v) => onChange('recentRoiMin', v)}
            placeholder="예: 2"
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
          <NumberInput
            label="거래 수 최소"
            value={filters.tradesMin ?? ''}
            onChange={(v) => onChange('tradesMin', v)}
            placeholder="예: 30"
          />
        </div>
      </FilterSection>

      <FilterSection title="정렬">
        <select
          value={filters.sort}
          onChange={(e) => onChange('sort', e.target.value)}
          className="
            h-8 w-full text-[12px] px-2
            border border-slate-200 dark:border-gray-700
            rounded-md
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

      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="sm"
        type="button"
        onClick={onReset}
        className="w-full"
      >
        필터 초기화
      </Button>
    </div>
  )
}

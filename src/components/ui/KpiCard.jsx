import { cn } from '../../lib/cn'
import { ds } from '../../theme/tokens'
import StatCard from './StatCard'

const TONE_CLASS = {
  default: '',
  positive: ds.pnlUp,
  negative: ds.pnlDown,
  danger: ds.risk,
  primary: ds.link,
}

/**
 * StatCard와 동일 레이아웃 — tone으로 수익/손실/위험 색만 일괄 적용
 */
export default function KpiCard({ tone = 'default', valueClassName, ...props }) {
  return (
    <StatCard
      {...props}
      valueClassName={cn(tone !== 'default' && TONE_CLASS[tone], valueClassName)}
    />
  )
}

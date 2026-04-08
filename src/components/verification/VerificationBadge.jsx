import { getVerificationBadgeConfig, VERIFICATION_LEVELS } from '../../lib/verificationBadge'

const ICONS = {
  [VERIFICATION_LEVELS.BACKTEST_ONLY]: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v2H2V3zm0 3h12v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6zm3 2a.5.5 0 000 1h6a.5.5 0 000-1H5z" />
    </svg>
  ),
  [VERIFICATION_LEVELS.LIVE_VERIFIED]: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M8 1a.5.5 0 01.5.5v5.793l3.354 3.354a.5.5 0 01-.708.708l-3.5-3.5A.5.5 0 017.5 7.5V1.5A.5.5 0 018 1z" />
      <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm0-1A7 7 0 118 1a7 7 0 010 14z" />
    </svg>
  ),
  [VERIFICATION_LEVELS.TRADE_VERIFIED]: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M16 8A8 8 0 110 8a8 8 0 0116 0zM6.97 11.03a.75.75 0 001.07 0l3.992-3.992a.75.75 0 00-1.071-1.071L7.5 9.439 5.53 7.47a.75.75 0 00-1.06 1.06l2.5 2.5z" />
    </svg>
  ),
}

export default function VerificationBadge({
  level,
  size = 'sm',
  showLabel = true,
  className = '',
}) {
  const config = getVerificationBadgeConfig(level)
  const icon = ICONS[config.level] ?? ICONS[VERIFICATION_LEVELS.BACKTEST_ONLY]

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
  }

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${config.bgClass} ${config.textClass} ${config.borderClass}
        ${sizeClasses[size] ?? sizeClasses.sm}
        ${className}
      `}
      title={config.label}
    >
      {icon}
      {showLabel && (
        <span>{size === 'xs' ? config.shortLabel : config.label}</span>
      )}
    </span>
  )
}

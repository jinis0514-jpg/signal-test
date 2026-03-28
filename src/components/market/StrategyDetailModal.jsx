import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { CTA_CONFIG, RECOMMEND_CONFIG, STRATEGY_STATUS_CONFIG } from '../../lib/strategyStatus'

/* ── 내부 소 컴포넌트 ───────────────────── */

function MetricBox({ label, value, positive, negative }) {
  return (
    <div className="flex flex-col items-center py-1.5 px-1 bg-slate-50/60 dark:bg-gray-800/30 border-r last:border-r-0 border-slate-100 dark:border-gray-800">
      <span className="text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-wide mb-[3px]">
        {label}
      </span>
      <span
        className={cn(
          'text-[13px] font-bold tabular-nums leading-none',
          positive && 'text-emerald-600',
          negative && 'text-red-600',
          !positive && !negative && 'text-slate-800 dark:text-slate-200',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div className="border border-slate-100 dark:border-gray-800 rounded-[1px] px-2 py-1.5">
      <p className="text-[9px] text-slate-400 dark:text-slate-600 mb-0.5">{label}</p>
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{value}</p>
    </div>
  )
}

function SLabel({ children }) {
  return (
    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">
      {children}
    </p>
  )
}

function sigDirCls(dir) {
  if (dir === 'LONG')  return 'text-emerald-600'
  if (dir === 'SHORT') return 'text-red-600'
  return 'text-slate-500'
}

function sigResultCls(result, closed) {
  if (!closed)               return 'text-blue-500'
  if (result.startsWith('+')) return 'text-emerald-600'
  if (result.startsWith('-')) return 'text-red-600'
  return 'text-slate-500'
}

function ctaCaption(ctaStatus) {
  if (ctaStatus === 'subscribed') return '현재 구독 중인 전략입니다.'
  if (ctaStatus === 'active')     return '체험 기간 중 · 만료 후 구독으로 이어집니다.'
  if (ctaStatus === 'expired')    return '체험이 종료됐습니다. 구독으로 계속 이용하세요.'
  return '7일 무료 체험 후 구독 전환이 가능합니다.'
}

/* ── StrategyDetailModal ────────────────── */

export default function StrategyDetailModal({ strategy, onClose, onSimulate }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  if (!strategy) return null

  const isUser    = !!strategy.isUserStrategy
  const cta       = CTA_CONFIG[strategy.ctaStatus]          ?? CTA_CONFIG.not_started
  const recCfg    = RECOMMEND_CONFIG[strategy.recommendBadge]
  const statusCfg = !isUser ? STRATEGY_STATUS_CONFIG[strategy.status] : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="
          relative bg-white dark:bg-gray-900
          w-full max-w-[560px]
          rounded-[2px]
          border border-slate-200 dark:border-gray-700
          max-h-[86vh] flex flex-col
        "
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── 헤더 ──────────────────────────────── */}
        <div className="flex items-start justify-between px-4 pt-3 pb-2.5 border-b border-slate-100 dark:border-gray-800 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              {isUser    && <Badge variant="info">내 전략</Badge>}
              {recCfg    && <Badge variant={recCfg.variant}>{recCfg.label}</Badge>}
              <Badge variant="default">{strategy.typeLabel ?? '—'}</Badge>
              {statusCfg && <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>}
            </div>
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {strategy.name}
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">by {strategy.author}</p>
          </div>

          <button
            onClick={onClose}
            className="
              w-6 h-6 flex items-center justify-center flex-shrink-0 ml-3 mt-0.5
              text-slate-400 hover:text-slate-700 hover:bg-slate-100
              dark:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-gray-800
              rounded-[1px] transition-colors
            "
            aria-label="닫기"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>

        {/* ── 바디 (스크롤) ─────────────────────── */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">

          {/* 핵심 지표 4분할 */}
          <div className="grid grid-cols-4 border border-slate-100 dark:border-gray-800 rounded-[1px] overflow-hidden">
            <MetricBox label="ROI"   value={`+${strategy.roi}%`}    positive />
            <MetricBox label="Win%"  value={`${strategy.winRate}%`}           />
            <MetricBox label="MDD"   value={`${strategy.mdd}%`}     negative  />
            <MetricBox label="거래"  value={`${strategy.trades}건`}           />
          </div>

          {/* 전략 소개 */}
          <div>
            <SLabel>전략 소개</SLabel>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              {strategy.desc || (isUser ? '직접 제작한 전략입니다.' : '—')}
            </p>
          </div>

          {/* 현재 시장 적합도 */}
          <div className="border-l-2 border-slate-200 dark:border-gray-700 pl-2.5">
            <SLabel>현재 시장 적합도</SLabel>
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
              {strategy.fitSummary || '—'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed">
              {strategy.fitDetail || (isUser ? '백테스트 완료 후 표시됩니다.' : '—')}
            </p>
          </div>

          {/* 최근 시그널 */}
          {strategy.recentSignals?.length > 0 && (
            <div>
              <SLabel>최근 시그널</SLabel>
              <div className="border border-slate-100 dark:border-gray-800 rounded-[1px] overflow-hidden">
                {strategy.recentSignals.map((sig, i) => (
                  <div
                    key={i}
                    className="
                      flex items-center gap-2 px-3 py-1.5
                      border-b last:border-b-0 border-slate-50 dark:border-gray-800/50
                    "
                  >
                    <span className={cn('w-[36px] text-[10px] font-bold', sigDirCls(sig.dir))}>
                      {sig.dir}
                    </span>
                    <span className="flex-1 text-[10px] text-slate-400 tabular-nums">
                      {sig.time}
                    </span>
                    <span className={cn('text-[10px] font-semibold tabular-nums', sigResultCls(sig.result, sig.closed))}>
                      {sig.result}
                    </span>
                    {!sig.closed && (
                      <span className="text-[9px] text-blue-400 border border-blue-100 rounded-[1px] px-1 leading-tight">
                        진행중
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 부가 정보 */}
          <div className="grid grid-cols-3 gap-1.5">
            <InfoCell label="평균 보유" value={strategy.avgHolding ?? '—'} />
            <InfoCell label="총 거래"   value={`${strategy.trades ?? 0}건`} />
            <InfoCell label="활성 시그" value={`${strategy.signals ?? 0}개`} />
          </div>
        </div>

        {/* ── 하단 CTA ──────────────────────────── */}
        <div className="
          flex items-center justify-between gap-3
          px-4 py-2
          border-t border-slate-100 dark:border-gray-800
          bg-slate-50/40 dark:bg-gray-800/20
          flex-shrink-0
        ">
          <p className="text-[10px] text-slate-400 dark:text-slate-600 leading-snug">
            {ctaCaption(strategy.ctaStatus)}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onSimulate && (
              <button
                onClick={() => { onClose(); onSimulate() }}
                className="
                  h-7 px-2.5 text-[10px] font-medium rounded-[2px]
                  text-slate-500 hover:text-slate-700 hover:bg-slate-100
                  dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-gray-800
                  border border-slate-200 dark:border-gray-700
                  transition-colors whitespace-nowrap
                "
              >
                모의투자 바로가기 →
              </button>
            )}
            <Button variant={cta.variant} size="md">
              {cta.label}
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}

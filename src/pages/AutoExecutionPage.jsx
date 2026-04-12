import { useMemo, useEffect, useState, useCallback } from 'react'
import {
  Link2, Bot, Wallet, Shield, Activity, Lock, ExternalLink,
} from 'lucide-react'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { cn } from '../lib/cn'
import { panelBase, panelSoft } from '../lib/panelStyles'
import { STRATEGIES as SIM_STRATEGIES } from '../data/simulationMockData'
import { MARKET_STRATEGIES } from '../data/marketMockData'
import { fetchMyConnections } from '../lib/exchangeConnectionService'
import { canUseAutoExecution } from '../lib/userPlan'
import { getBinanceSpotTradeUrl } from '../lib/binanceTradeLinks'
import { useAutoExecution } from '../hooks/useAutoExecution'

function buildStrategyCatalog() {
  const map = new Map()
  ;[...SIM_STRATEGIES, ...MARKET_STRATEGIES].forEach((s) => {
    if (s?.id) map.set(String(s.id), String(s.name ?? s.id))
  })
  return map
}

function fmtTs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Date(n).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '—'
  }
}

const STATUS_COPY = {
  idle: { label: '대기', tone: 'text-slate-600 dark:text-slate-300', badge: 'default' },
  running: { label: '실행 중', tone: 'text-emerald-600 dark:text-emerald-400', badge: 'success' },
  stopped: { label: '중지', tone: 'text-amber-700 dark:text-amber-300', badge: 'warning' },
}

export default function AutoExecutionPage({
  user,
  currentUser,
  onNavigate,
}) {
  const u = user ?? {}
  const unlocked = Array.isArray(u.unlockedStrategyIds) ? u.unlockedStrategyIds : []
  const catalog = useMemo(() => buildStrategyCatalog(), [])
  const strategyOptions = useMemo(() => {
    return unlocked.map((id) => ({
      id: String(id),
      name: catalog.get(String(id)) ?? String(id),
    }))
  }, [unlocked, catalog])

  const premiumOk = canUseAutoExecution(u)
  const loggedIn = !!currentUser?.id

  const { state, patch, startSession, stopSession, resetToIdle } = useAutoExecution()
  const [exchangeOk, setExchangeOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchMyConnections()
        if (cancelled) return
        const ok = Array.isArray(list) && list.some((c) => c && c.is_active !== false)
        setExchangeOk(ok)
      } catch {
        if (!cancelled) setExchangeOk(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const subscribedOk = unlocked.length > 0 && strategyOptions.some((o) => o.id === state.strategyId)

  const canPrimaryStart =
    premiumOk
    && loggedIn
    && subscribedOk
    && exchangeOk
    && state.status !== 'running'
    && Number(state.investKrw) > 0

  useEffect(() => {
    if (state.strategyId || !strategyOptions.length) return
    patch({
      strategyId: strategyOptions[0].id,
      strategyName: strategyOptions[0].name,
    })
  }, [strategyOptions, state.strategyId, patch])

  const primaryButtonDisabled =
    !loggedIn
    || (state.status === 'running'
      ? false
      : premiumOk
        ? !canPrimaryStart
        : false)

  const handlePrimary = useCallback(() => {
    if (!premiumOk) {
      onNavigate?.('plans')
      return
    }
    if (state.status === 'running') {
      stopSession()
      return
    }
    if (!canPrimaryStart) return
    startSession({
      strategyId: state.strategyId,
      strategyName: strategyOptions.find((o) => o.id === state.strategyId)?.name ?? state.strategyId,
      investKrw: state.investKrw,
      riskPct: state.riskPct,
      stopLossPct: state.stopLossPct,
    })
  }, [
    premiumOk, state.status, state.strategyId, state.investKrw, state.riskPct, state.stopLossPct,
    strategyOptions, canPrimaryStart, startSession, stopSession, onNavigate,
  ])

  const st = STATUS_COPY[state.status] ?? STATUS_COPY.idle

  return (
    <PageShell wide className="min-w-0">
      <PageHeader
        title="전략 자동 실행"
        description="구독한 전략을 거래소와 연결해 시그널에 맞춰 자동으로 주문합니다. (Ultimate · Premium)"
      />

      {!loggedIn && (
        <div className={cn(panelBase, 'mb-6 p-4 border-amber-200 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/25')}>
          <p className="text-sm text-amber-900 dark:text-amber-100">
            로그인 후 이용할 수 있습니다.
          </p>
        </div>
      )}

      {!premiumOk && loggedIn && (
        <div className={cn(panelBase, 'mb-6 p-4 border-violet-200 bg-violet-50/80 dark:border-violet-900/40 dark:bg-violet-950/20')}>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <p className="text-sm text-violet-900 dark:text-violet-100">
              <Lock size={14} className="inline mr-1 opacity-80" aria-hidden />
              전략 자동 실행은 <strong>Premium</strong> 플랜에서 이용할 수 있습니다.
            </p>
            <Button type="button" variant="primary" size="sm" onClick={() => onNavigate?.('plans')}>
              플랜 보기
            </Button>
          </div>
        </div>
      )}

      <section className="mb-8" aria-label="자동 실행 구조">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          동작 구조
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Wallet, title: '전략 구독', desc: '마켓에서 전략을 구독하면 시그널 스트림이 활성화됩니다.' },
            { icon: Link2, title: '거래소 API 연결', desc: '읽기·주문 권한 범위 내에서 API를 연결합니다.' },
            { icon: Bot, title: '시그널 → 자동 주문', desc: '진입·청산 시그널에 맞춰 주문이 라우팅됩니다.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <Icon className="text-sky-600 dark:text-sky-400 mb-2" size={22} strokeWidth={2} aria-hidden />
              <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{title}</p>
              <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className={cn(panelBase, 'shadow-sm')}>
            <Card.Header>
              <Card.Title className="text-[16px]">설정</Card.Title>
              <p className="text-[12px] text-slate-500 mt-1">투자 금액·리스크·손절 기준을 지정합니다.</p>
            </Card.Header>
            <Card.Content className="space-y-4">
              <div>
                <label htmlFor="ae-strategy" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  구독 전략
                </label>
                <select
                  id="ae-strategy"
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-slate-100 disabled:opacity-50"
                  value={state.strategyId}
                  onChange={(e) => patch({ strategyId: e.target.value })}
                  disabled={!premiumOk || !strategyOptions.length}
                >
                  <option value="">전략 선택</option>
                  {strategyOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                {!strategyOptions.length && (
                  <p className="mt-1 text-[11px] text-slate-500">구독 중인 전략이 없습니다. 마켓에서 먼저 구독해 주세요.</p>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="ae-invest" className="text-[11px] font-semibold text-slate-500">투자 금액 (원)</label>
                  <input
                    id="ae-invest"
                    type="number"
                    min={10000}
                    step={10000}
                    className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-900 disabled:opacity-50"
                    value={state.investKrw}
                    onChange={(e) => patch({ investKrw: Number(e.target.value) })}
                    disabled={!premiumOk || state.status === 'running'}
                  />
                </div>
                <div>
                  <label htmlFor="ae-risk" className="text-[11px] font-semibold text-slate-500">리스크 (%/포지션)</label>
                  <input
                    id="ae-risk"
                    type="number"
                    min={0.1}
                    max={20}
                    step={0.1}
                    className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-900 disabled:opacity-50"
                    value={state.riskPct}
                    onChange={(e) => patch({ riskPct: Number(e.target.value) })}
                    disabled={!premiumOk || state.status === 'running'}
                  />
                </div>
                <div>
                  <label htmlFor="ae-sl" className="text-[11px] font-semibold text-slate-500">손절 기준 (%)</label>
                  <input
                    id="ae-sl"
                    type="number"
                    min={0.1}
                    max={50}
                    step={0.1}
                    className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-900 disabled:opacity-50"
                    value={state.stopLossPct}
                    onChange={(e) => patch({ stopLossPct: Number(e.target.value) })}
                    disabled={!premiumOk || state.status === 'running'}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="min-w-[160px]"
                  onClick={handlePrimary}
                  disabled={primaryButtonDisabled}
                >
                  {state.status === 'running' ? '자동 실행 중지' : '자동 실행 시작'}
                </Button>
                {state.status === 'stopped' && (
                  <Button type="button" variant="secondary" size="lg" onClick={resetToIdle}>
                    대기로 초기화
                  </Button>
                )}
              </div>
              {!premiumOk && loggedIn && (
                <p className="text-[11px] text-slate-500">Premium으로 업그레이드하면 자동 실행을 사용할 수 있습니다.</p>
              )}
              {premiumOk && loggedIn && state.status !== 'running' && !exchangeOk && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  거래소 API를 연결하면 자동 실행을 시작할 수 있습니다.
                  {' '}
                  <button type="button" className="font-semibold underline" onClick={() => onNavigate?.('mypage')}>
                    마이페이지에서 연결
                  </button>
                </p>
              )}
            </Card.Content>
          </Card>

          <Card className={cn(panelBase, 'shadow-sm')}>
            <Card.Header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Card.Title className="text-[16px]">실행 기록</Card.Title>
                <p className="text-[12px] text-slate-500 mt-1">자동 실행 세션·요약(로컬 저장). 실거래 성과는 검증 탭과 함께 확인하세요.</p>
              </div>
            </Card.Header>
            <Card.Content>
              {!state.history?.length ? (
                <p className="text-sm text-slate-500 py-6 text-center">아직 저장된 기록이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-gray-800">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-slate-50 dark:bg-gray-800/80 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">시간</th>
                        <th className="px-3 py-2 font-semibold">유형</th>
                        <th className="px-3 py-2 font-semibold">내용</th>
                        <th className="px-3 py-2 font-semibold text-right">참고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.history.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 dark:border-gray-800">
                          <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{fmtTs(row.ts)}</td>
                          <td className="px-3 py-2">
                            <Badge variant={row.kind === 'result' ? 'success' : 'default'}>
                              {row.kind === 'result' ? '성과' : '시스템'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                            <span className="font-semibold">{row.title}</span>
                            {row.detail ? (
                              <span className="block text-[11px] text-slate-500 mt-0.5">{row.detail}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {row.pnlPct != null && Number.isFinite(Number(row.pnlPct))
                              ? (
                                <span className={Number(row.pnlPct) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                  {Number(row.pnlPct) >= 0 ? '+' : ''}
                                  {Number(row.pnlPct).toFixed(2)}%
                                </span>
                                )
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Content>
          </Card>
        </div>

        <aside className="space-y-4">
          <div className={cn(panelSoft, 'p-4')}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} className="text-sky-500" aria-hidden />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">상태</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-lg font-bold', st.tone)}>{st.label}</span>
              <Badge variant={st.badge}>{st.label}</Badge>
              {state.status === 'running' && (
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
              )}
            </div>
            {state.strategyId && (
              <p className="mt-3 text-[12px] text-slate-600 dark:text-slate-400">
                선택 전략: <span className="font-semibold text-slate-900 dark:text-slate-100">{state.strategyName || state.strategyId}</span>
              </p>
            )}
          </div>

          <div className={cn(panelSoft, 'p-4 space-y-2')}>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-slate-400" />
              <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">체크리스트</p>
            </div>
            <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
              <li className={subscribedOk ? 'text-emerald-700 dark:text-emerald-400' : ''}>
                {subscribedOk ? '✓' : '○'} 전략 구독
              </li>
              <li className={exchangeOk ? 'text-emerald-700 dark:text-emerald-400' : ''}>
                {exchangeOk ? '✓' : '○'} 거래소 API 연결
              </li>
              <li className={premiumOk ? 'text-emerald-700 dark:text-emerald-400' : ''}>
                {premiumOk ? '✓' : '○'} Premium (Ultimate)
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">SAFE MODE</p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              자동 주문 대신 직접 체결하려면 Binance BTCUSDT 현물 화면으로 이동하세요. 법적 책임은 거래소·본인 주문에 있습니다.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full gap-1 text-[11px]"
              onClick={() => window.open(getBinanceSpotTradeUrl('BTCUSDT'), '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink size={12} className="opacity-80" aria-hidden />
              거래소에서 실행
            </Button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            실제 주문은 거래소·권한·유동성에 따라 달라질 수 있습니다. 투자 판단의 책임은 사용자에게 있습니다.
          </p>
        </aside>
      </div>
    </PageShell>
  )
}

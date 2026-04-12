/**
 * 검증 페이지·홈용 실거래 인증 뷰 모델 (mock + 향후 API 확장)
 */
import {
  getMockVerificationSummary,
  getMockTradeMatches,
  getMockLiveSignals,
  getMockSellerTrades,
} from '../data/verificationMockData'
import { VERIFICATION_LEVELS } from './verificationBadge'

const { TRADE_VERIFIED, LIVE_VERIFIED } = VERIFICATION_LEVELS

/** 검증 탭 시뮬 ID → 데모용 실거래 mock 키 */
export const SIM_ID_TO_VERIFICATION_MOCK = {
  'btc-trend': 's1',
  'eth-range': 's2',
  'btc-breakout': 's1',
  'sol-momentum': 's2',
  'alt-basket': 's6',
}

/** 플랫폼 UI 티어 (배지 색 규칙) */
export const VERIFICATION_UI_TIER = {
  VERIFIED: 'VERIFIED',
  LIVE_ONLY: 'LIVE_ONLY',
  BACKTEST_ONLY: 'BACKTEST_ONLY',
}

export function mapBadgeLevelToUiTier(level) {
  if (level === TRADE_VERIFIED) return VERIFICATION_UI_TIER.VERIFIED
  if (level === LIVE_VERIFIED) return VERIFICATION_UI_TIER.LIVE_ONLY
  return VERIFICATION_UI_TIER.BACKTEST_ONLY
}

function safeFmtPct(n, digits = 1) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `${x >= 0 ? '+' : ''}${x.toFixed(digits)}%`
}

function safeFmtSec(s) {
  const n = Math.round(Number(s))
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 60) return `${n}초`
  const m = Math.floor(n / 60)
  const r = n % 60
  return r > 0 ? `${m}분 ${r}초` : `${m}분`
}

/**
 * 결론·근거 2줄 (과장 금지, 데이터 중심)
 */
function buildSummaryLines(summary, uiTier) {
  const n = Number(summary.last_30_signal_count ?? 0)
  const mr = Number(summary.match_rate ?? 0)
  const avgd = Number(summary.avg_time_diff_sec ?? 0)
  const pd = Number(summary.avg_price_diff_pct ?? 0)
  const vr = Number(summary.verified_return_pct ?? 0)

  if (uiTier === VERIFICATION_UI_TIER.BACKTEST_ONLY) {
    return {
      conclusion: '실거래 인증 표본이 아직 쌓이지 않았습니다.',
      evidence: '백테스트·라이브 구간만 확인할 수 있습니다. 최근 표본은 더 누적이 필요합니다.',
    }
  }

  if (uiTier === VERIFICATION_UI_TIER.LIVE_ONLY) {
    return {
      conclusion: '라이브 검증은 진행 중이며, 실거래 비교는 추가 확인이 필요합니다.',
      evidence:
        n > 0
          ? `최근 ${n}개 시그널 기준 추적 중 · 실거래 매칭은 아직 충분하지 않습니다.`
          : '라이브 시그널이 쌓이면 단계적으로 비교합니다.',
    }
  }

  // VERIFIED
  let conclusion = '실거래 기준으로 확인된 범위에서 비교적 안정적입니다.'
  if (mr >= 70) {
    conclusion = '실거래 기준으로도 비교적 안정적인 전략입니다.'
  } else if (mr < 55) {
    conclusion = '실거래 비교 결과는 추가 검증이 필요합니다.'
  } else if (mr < 70) {
    conclusion = '실거래 기준으로 일부 구간에서 편차가 관측됩니다.'
  }

  const evidence =
    n > 0 && Number.isFinite(mr)
      ? `최근 ${n}개 시그널 중 ${mr.toFixed(0)}% 매칭 · 평균 지연 ${safeFmtSec(avgd)} · 평균 가격 오차 ${pd.toFixed(2)}% · 실거래 수익률 ${safeFmtPct(vr)}`
      : '연결된 거래소 체결과 시그널을 비교한 결과입니다.'

  return { conclusion, evidence }
}

function buildMatchRateSeries(matches) {
  const sorted = [...(matches ?? [])].sort(
    (a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0),
  )
  const out = []
  let ok = 0
  let total = 0
  for (const m of sorted) {
    total += 1
    if (m.is_verified_match) ok += 1
    out.push(total > 0 ? Math.round((ok / total) * 100) : 0)
  }
  return out.length ? out : [0]
}

function buildComparisonRows(mockId, limit = 6) {
  const matches = getMockTradeMatches(mockId)
  const signals = getMockLiveSignals(mockId)
  const trades = getMockSellerTrades(mockId)
  const sigById = new Map(signals.map((s) => [s.id, s]))
  const trById = new Map(trades.map((t) => [t.id, t]))

  return matches.slice(0, limit).map((tm) => {
    const sig = sigById.get(tm.signal_id)
    const tr = trById.get(tm.trade_log_id)
    const sym = sig?.symbol ?? 'BTCUSDT'
    const sDir = String(sig?.direction ?? '—').toUpperCase()
    const tSide = String(tr?.side ?? '—').toUpperCase()
    const align = tm.is_verified_match
    const st = sig?.signal_time ? new Date(sig.signal_time).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
    const ft = tr?.executed_at ? new Date(tr.executed_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
    return {
      id: tm.id,
      symbol: sym,
      signalDir: sDir,
      fillSide: tSide,
      signalTimeLabel: st,
      fillTimeLabel: ft,
      timeDiffSec: tm.time_diff_sec,
      priceDiffPct: tm.price_diff_pct,
      aligned: align,
    }
  })
}

/**
 * @param {string} effectiveSimId  btc-trend 등
 */
export function buildRealTradeVerificationView(effectiveSimId) {
  const mockId = SIM_ID_TO_VERIFICATION_MOCK[effectiveSimId] ?? null
  if (!mockId) {
    return {
      hasData: false,
      mockId: null,
      uiTier: VERIFICATION_UI_TIER.BACKTEST_ONLY,
      summary: null,
      summaryLines: {
        conclusion: '이 전략은 데모 실거래 표본이 연결되지 않았습니다.',
        evidence: '백테스트·라이브 지표만 확인할 수 있습니다.',
      },
      kpis: null,
      comparisonRows: [],
      matchRateSeries: [],
      connectionLabel: '미연결',
    }
  }

  const summary = getMockVerificationSummary(mockId)
  const level = summary.verified_badge_level ?? 'backtest_only'
  const uiTier = mapBadgeLevelToUiTier(level)
  const summaryLines = buildSummaryLines(summary, uiTier)
  const matches = getMockTradeMatches(mockId)

  const mr = Number(summary.match_rate ?? 0)
  const n = Number(summary.last_30_signal_count ?? 0)
  const kpis = {
    matchRate: Number.isFinite(mr) ? `${mr.toFixed(0)}%` : '—',
    avgDelay: safeFmtSec(summary.avg_time_diff_sec),
    avgPriceDiff: Number.isFinite(Number(summary.avg_price_diff_pct))
      ? `${Number(summary.avg_price_diff_pct).toFixed(2)}%`
      : '—',
    verifiedReturn: safeFmtPct(summary.verified_return_pct),
    sampleCount: Number.isFinite(n) ? `${Math.round(n)}건` : '—',
    authStatus:
      uiTier === VERIFICATION_UI_TIER.VERIFIED
        ? '연결됨'
        : uiTier === VERIFICATION_UI_TIER.LIVE_ONLY
          ? '부분 연결'
          : '미연결',
    authSub:
      uiTier === VERIFICATION_UI_TIER.VERIFIED
        ? '거래소 API로 체결 조회'
        : '실거래 비교를 위해 API 연결이 필요합니다',
  }

  return {
    hasData: true,
    mockId,
    uiTier,
    badgeLevel: level,
    summary,
    summaryLines,
    kpis,
    comparisonRows: buildComparisonRows(mockId, 6),
    matchRateSeries: buildMatchRateSeries(matches),
    connectionLabel: uiTier === VERIFICATION_UI_TIER.BACKTEST_ONLY ? '미연결' : '확인됨',
  }
}

/** 홈·카드 한 줄용 */
export function formatVerificationHomeHint(view) {
  if (!view?.hasData) return null
  const { uiTier, summary, summaryLines } = view
  if (uiTier === VERIFICATION_UI_TIER.BACKTEST_ONLY) return null
  const mr = Number(summary?.match_rate ?? 0)
  if (uiTier === VERIFICATION_UI_TIER.VERIFIED && Number.isFinite(mr)) {
    return `실거래 인증 완료 · 최근 기준 약 ${mr.toFixed(0)}% 매칭`
  }
  if (uiTier === VERIFICATION_UI_TIER.LIVE_ONLY) {
    return '라이브 검증 진행 중 · 실거래 비교는 누적 중입니다.'
  }
  return summaryLines?.conclusion ?? null
}

/**
 * BTC 실시세·캔들 기반 시장 브리프 문장 생성 (외부 감성지수 API 없이)
 */

function safeNum(v, fb = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/**
 * @param {Array<{high?:number, low?:number, close?:number, volume?:number}>} candles
 * @param {{ changePercent?: number, usdPrice?: number }} priceMeta
 */
export function buildMarketBrief({ candles = [], priceMeta = {} }) {
  const changePct = safeNum(priceMeta.changePercent, 0)
  const n = candles.length
  const closes = candles.map((c) => safeNum(c.close, 0)).filter((x) => x > 0)
  const vols = candles.map((c) => safeNum(c.volume, 0))

  let volRatio = 1
  let avgRangePct = 0
  let volTrend = '중립'

  if (n >= 24) {
    const half = Math.floor(n / 2)
    const v1 = vols.slice(0, half).reduce((a, b) => a + b, 0)
    const v2 = vols.slice(half).reduce((a, b) => a + b, 0)
    if (v1 > 0 && v2 > 0) {
      volRatio = v2 / v1
      if (volRatio > 1.15) volTrend = '최근 구간 거래량 증가'
      else if (volRatio < 0.85) volTrend = '최근 구간 거래량 감소'
    }
  }

  if (closes.length >= 14) {
    let sum = 0
    let count = 0
    for (let i = Math.max(0, closes.length - 24); i < closes.length; i++) {
      const c = candles[i]
      if (!c) continue
      const cl = safeNum(c.close, 0)
      const hi = safeNum(c.high ?? cl, cl)
      const lo = safeNum(c.low ?? cl, cl)
      if (cl > 0) {
        sum += ((hi - lo) / cl) * 100
        count += 1
      }
    }
    if (count > 0) avgRangePct = sum / count
  }

  const volLabel = avgRangePct >= 2.2 ? '높은 변동성'
    : avgRangePct >= 1.0 ? '보통 변동성'
      : '낮은·수축적 변동성'

  const trendLabel = changePct > 1.5 ? '강한 상승 흐름'
    : changePct > 0.3 ? '완만한 상승'
      : changePct < -1.5 ? '강한 하락 압력'
        : changePct < -0.3 ? '완만한 하락'
          : '단기 박스·횡보에 가까운 흐름'

  const priceStr = priceMeta.usdPrice != null && Number.isFinite(priceMeta.usdPrice)
    ? `$${priceMeta.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '—'

  const lines = []

  lines.push(`BTC 기준가 ${priceStr}, 24시간 가격 변화율은 ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% 수준입니다.`)
  lines.push(`최근 봉 기준으로는 ${trendLabel}으로 요약됩니다.`)

  if (n > 0) {
    lines.push(`최근 ${Math.min(n, 48)}봉 평균 캔들 레인지(고저폭/종가)는 약 ${avgRangePct.toFixed(2)}%로, ${volLabel} 구간으로 읽힙니다.`)
    lines.push(`${volTrend} — 단기 유동성·참여도 변화를 시그널·체결 슬리피지에 반영할 때 유의하세요.`)
  } else {
    lines.push('캔들 데이터가 부족해 변동성·거래량 세부 비교는 생략됩니다.')
  }

  lines.push(changePct > 0
    ? '상승일 때는 추세·모멘텀 전략의 연속 신호를, 롱 과열 시에는 RSI·밴드 터치 전략의 역신호를 함께 보세요.'
    : '하락·박스권에서는 평균회귀·밴드 반전 전략의 빈도가 높아질 수 있으나, 돌파 실패 시 손절 거리를 짧게 유지하는 편이 안전합니다.')

  lines.push(avgRangePct > 1.8
    ? '변동성이 크면 청산·스탑 규칙이 같은 신호라도 실제 손익을 크게 바꿉니다. 리스크 설정을 전략과 함께 점검하세요.'
    : '변동성이 낮을 때는 시그널 수가 줄고 수수료 비중이 커질 수 있어, 포지션 크기와 거래 빈도를 조절하는 것이 좋습니다.')

  lines.push('거래량 급증 봉이 연속되면 추세 전환 또는 스톱헌팅 구간일 수 있으니, 다중 타임프레임으로 확인하는 것을 권장합니다.')

  const fg = changePct > 2 ? '탐욕 쪽으로 기울 수 있는 구간'
    : changePct < -2 ? '공포 쪽으로 기울 수 있는 구간'
      : '중립에 가까운 심리'

  lines.push(`단기 심리(공포·탐욕 프록시)는 ${fg}으로 보이며, 외부 공포탐욕 지수와 병행하면 맥락이 좋아집니다.`)

  lines.push('알트코인은 BTC 대비 베타·상대강도가 갈리기 쉬우니, 동일 전략이라도 자산별로 승률이 달라질 수 있습니다.')

  lines.push('펀딩·선물 베이시스는 트렌드 지속성 힌트로 쓸 수 있으나, 본 브리프는 현물 기준 가격·캔들만 사용합니다.')

  lines.push('마켓 전략은 승인·게시된 로직을 기준으로 홈·시뮬에 연결되니, 관심 전략의 타임프레임과 자산을 먼저 맞추세요.')

  lines.push('뉴스 이벤트 전후에는 동일 지표라도 분산이 커지므로, 검증 구간을 이벤트 전후로 나눠 보는 것이 안전합니다.')

  while (lines.length < 10) {
    lines.push('리스크는 포지션 크기·최대 손실 한도·동시 포지션 수로 먼저 제한하고, 그 다음에 진입 규칙을 최적화하세요.')
  }

  const now = new Date()
  const updatedAt = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} KST`

  const headline = `${trendLabel} · ${volLabel} · 24h ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`

  return { headline, lines: lines.slice(0, 14), updatedAt }
}

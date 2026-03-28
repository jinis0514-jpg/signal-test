import { useState, useEffect } from 'react'
import PageShell      from '../components/ui/PageShell'
import PageHeader     from '../components/ui/PageHeader'
import Card           from '../components/ui/Card'
import Button         from '../components/ui/Button'
import Input          from '../components/ui/Input'
import Badge          from '../components/ui/Badge'
import { cn }         from '../lib/cn'

/* ── 진입/청산 조건 그룹 ──────────────────── */
const ENTRY_CONDITIONS = [
  { id: 'ema_cross',      label: 'EMA 크로스 (20/50)',          category: '추세' },
  { id: 'ema_cross_fast', label: 'EMA 크로스 (5/13)',           category: '추세' },
  { id: 'macd_cross',     label: 'MACD 시그널 크로스',           category: '추세' },
  { id: 'rsi_ob_os',      label: 'RSI 과매수/과매도 (70/30)',    category: '모멘텀' },
  { id: 'rsi_mid',        label: 'RSI 중심선 크로스 (50)',       category: '모멘텀' },
  { id: 'bb_squeeze',     label: '볼린저 밴드 수축 돌파',         category: '변동성' },
  { id: 'bb_touch',       label: '볼린저 밴드 터치 반전',         category: '변동성' },
  { id: 'volume_surge',   label: '거래량 급증 (2배+)',           category: '거래량' },
  { id: 'obv_div',        label: 'OBV 다이버전스',               category: '거래량' },
]

const STOP_CONDITIONS = [
  { id: 'fixed_pct',     label: '고정 비율 손절 (%)',    hint: '진입가 대비 X% 하락 시' },
  { id: 'trailing',      label: '트레일링 스탑 (%)',     hint: '최고가 대비 X% 하락 시' },
  { id: 'time_based',    label: '시간 기반 청산 (시간)', hint: 'N시간 경과 후 자동 청산' },
  { id: 'atr_stop',      label: 'ATR 기반 손절 (배수)',  hint: 'ATR × N 이격 시 청산'  },
]

const CATEGORIES = ['추세', '모멘텀', '변동성', '거래량']

const STARTER_CODE = `// BTC Trend Rider v2 - 전략 코드
// EMA 크로스 + RSI 필터 기반 추세 추종 전략

longCondition  = ta.crossover(ta.ema(close, 20), ta.ema(close, 50))
shortCondition = ta.crossunder(ta.ema(close, 20), ta.ema(close, 50))

// RSI 필터: 롱은 RSI 50 이상, 숏은 50 이하
rsiFilter_long  = ta.rsi(close, 14) > 50
rsiFilter_short = ta.rsi(close, 14) < 50

if (longCondition and rsiFilter_long)
    strategy.entry("Long", strategy.long)
    strategy.exit("Exit Long", "Long", loss=200, trail_offset=100)

if (shortCondition and rsiFilter_short)
    strategy.entry("Short", strategy.short)
    strategy.exit("Exit Short", "Short", loss=200, trail_offset=100)`

export default function EditorPage({
  onSaveStrategy,
  onNavigate,
  initialData,
  editingStrategyId,
  currentUser,
  saveLoading = false,
  saveErrorMessage = '',
}) {
  /* ── 기본 폼 상태 ───────────────────── */
  const [mode,          setMode]          = useState('nocode')
  const [name,          setName]          = useState('')
  const [tags,          setTags]          = useState('')
  const [asset,         setAsset]         = useState('')
  const [timeframe,     setTimeframe]     = useState('')
  const [riskLevel,     setRiskLevel]     = useState('mid')
  const [selected,      setSelected]      = useState([])   // 진입 조건 IDs
  const [code,          setCode]          = useState(STARTER_CODE)

  /* ── 리스크 설정 상태 ───────────────── */
  const [stopType,      setStopType]      = useState('fixed_pct')
  const [stopValue,     setStopValue]     = useState('')
  const [takeProfitPct, setTakeProfitPct] = useState('')
  const [posSize,       setPosSize]       = useState('')
  const [maxOpenPos,    setMaxOpenPos]    = useState('1')

  /* ── 저장 피드백 ──────────────────── */
  const [saveStatus,   setSaveStatus]   = useState(null)   // null | 'draft' | 'submitted' | 'error'
  const [saveError,    setSaveError]    = useState('')
  const [currentId,    setCurrentId]    = useState(null)   // 현재 편집 중인 전략 ID

  /* 반려된 전략 불러오기 */
  useEffect(() => {
    if (!initialData) return
    setName(initialData.name ?? '')
    setTags(Array.isArray(initialData.tags) ? initialData.tags.join(', ') : (initialData.tags ?? ''))
    setAsset(initialData.asset ?? '')
    setTimeframe(initialData.timeframe ?? '')
    setRiskLevel(initialData.riskLevel ?? 'mid')
    setSelected(initialData.conditions ?? [])
    setCode(initialData.code ?? STARTER_CODE)
    setStopType(initialData.stopType ?? 'fixed_pct')
    setStopValue(initialData.stopValue ?? '')
    setTakeProfitPct(initialData.takeProfitPct ?? '')
    setPosSize(initialData.posSize ?? '')
    setMaxOpenPos(initialData.maxOpenPos ?? '1')
    setCurrentId(initialData.id ?? null)
    if (initialData.mode) setMode(initialData.mode)
    setSaveStatus(null)
    setSaveError('')
  }, [initialData])

  useEffect(() => {
    if (saveErrorMessage) setSaveError(saveErrorMessage)
  }, [saveErrorMessage])

  const toggle = (id) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  const selectedStop = STOP_CONDITIONS.find((s) => s.id === stopType)

  /* ── 공통 폼 데이터 수집 ──────────── */
  function collectData() {
    return {
      id:           currentId ?? editingStrategyId ?? undefined,
      name,
      tags:         tags.split(',').map((t) => t.trim()).filter(Boolean),
      asset:        asset || 'BTC',
      timeframe,
      mode,
      riskLevel,
      conditions:   selected,
      code,
      stopType,
      stopValue,
      takeProfitPct,
      posSize,
      maxOpenPos,
    }
  }

  /* ── 유효성 검사 ─────────────────── */
  function validate() {
    if (!name.trim()) { setSaveError('전략 이름을 입력해주세요.'); return false }
    if (mode === 'nocode' && selected.length === 0) {
      setSaveError('진입 조건을 하나 이상 선택해주세요.'); return false
    }
    setSaveError('')
    return true
  }

  /* ── 임시 저장 ───────────────────── */
  async function handleDraft() {
    if (!name.trim()) { setSaveError('전략 이름을 입력해주세요.'); return }
    setSaveError('')
    const data     = collectData()
    let strategy = null
    try {
      strategy = await onSaveStrategy?.(data, 'draft')
    } catch {
      strategy = null
    }
    if (!strategy) {
      setSaveStatus('error')
      setSaveError('로그인 후 저장할 수 있습니다.')
      return
    }
    setCurrentId(strategy.id)
    setSaveStatus('draft')
    setTimeout(() => setSaveStatus(null), 3000)
  }

  /* ── 마켓 제출 ───────────────────── */
  async function handleSubmit() {
    if (!validate()) return
    const data     = collectData()
    let strategy = null
    try {
      strategy = await onSaveStrategy?.(data, 'submitted')
    } catch {
      strategy = null
    }
    if (!strategy) {
      setSaveStatus('error')
      setSaveError('로그인 후 제출할 수 있습니다.')
      return
    }
    setCurrentId(strategy.id)
    setSaveStatus('submitted')
    /* 1초 후 전략마켓으로 이동 */
    setTimeout(() => {
      setSaveStatus(null)
      onNavigate?.('market')
    }, 1000)
  }

  return (
    <PageShell wide>
      <PageHeader
        title="전략 에디터"
        description="전략을 제작하고 마켓에 등록합니다."
        action={
          <div className="flex items-center gap-2">
            {saveError && (
              <span className="text-[11px] text-red-500">{saveError}</span>
            )}
            {saveStatus === 'draft' && (
              <span className="text-[11px] text-slate-500">✓ 임시 저장됨</span>
            )}
            {saveStatus === 'submitted' && (
              <span className="text-[11px] text-emerald-600 font-semibold">
                ✓ 마켓에 등록됨 — 이동 중...
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={handleDraft} disabled={saveLoading || !currentUser}>
              임시 저장
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saveLoading || !currentUser}>
              마켓에 제출
            </Button>
          </div>
        }
      />

      {!currentUser && (
        <div className="mb-3 px-3 py-2 border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40 rounded-[2px]">
          <p className="text-[11px] text-amber-700 dark:text-amber-400">로그인 후 전략 저장/제출이 가능합니다.</p>
        </div>
      )}

      {saveLoading && (
        <div className="mb-3 px-3 py-2 border border-slate-200 bg-slate-50/70 dark:bg-slate-900 dark:border-slate-800 rounded-[2px]">
          <p className="text-[11px] text-slate-500">저장 중...</p>
        </div>
      )}

      {/* 모드 토글 */}
      <div className="flex items-center gap-0 mb-4 w-fit border border-gray-200 dark:border-gray-800 rounded-[2px] overflow-hidden">
        {[['nocode', '간편 제작'], ['code', '코드 편집']].map(([id, label], i) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={[
              'px-4 py-2 text-[12px] font-semibold transition-colors',
              i > 0 ? 'border-l border-gray-200 dark:border-gray-800' : '',
              mode === id
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-white dark:bg-gray-900 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 3분할 에디터 */}
      <div className="grid grid-cols-[280px_1fr_280px] gap-3">

        {/* 좌: 전략 정보 + 입력 조건 */}
        <div className="flex flex-col gap-3">

          {/* 전략 기본 정보 */}
          <Card>
            <Card.Header><Card.Title>전략 정보</Card.Title></Card.Header>
            <Card.Content className="flex flex-col gap-2.5">
              <Input
                placeholder="전략 이름 (예: BTC Trend Rider v2)"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaveError('') }}
              />
              <Input
                placeholder="태그 (쉼표 구분: BTC, 추세, 중기)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className="flex-1 h-8 text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-[1px] bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                >
                  <option value="">자산 선택</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                  <option value="SOL">SOL</option>
                  <option value="ALT">알트코인</option>
                </select>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="flex-1 h-8 text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-[1px] bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                >
                  <option value="">타임프레임</option>
                  <option value="15m">15분</option>
                  <option value="1h">1시간</option>
                  <option value="4h">4시간</option>
                  <option value="1d">1일</option>
                </select>
              </div>
              {/* 리스크 레벨 */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">리스크 레벨</label>
                <div className="flex gap-1.5">
                  {[['low', '낮음'], ['mid', '중간'], ['high', '높음']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setRiskLevel(val)}
                      className={cn(
                        'flex-1 h-7 text-[10px] font-medium rounded-[1px] border transition-colors',
                        riskLevel === val
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                          : 'border-gray-200 dark:border-gray-700 text-slate-500 hover:bg-gray-50 dark:hover:bg-gray-800',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* 진입 조건 선택 (간편 제작 모드) */}
          {mode === 'nocode' && (
            <Card className="flex-1">
              <Card.Header>
                <Card.Title>진입 조건 선택</Card.Title>
                <Badge variant="info">{selected.length}개 선택</Badge>
              </Card.Header>
              <Card.Content className="flex flex-col gap-0 p-0">
                {CATEGORIES.map((cat) => (
                  <div key={cat}>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 pb-1">
                      {cat}
                    </p>
                    {ENTRY_CONDITIONS.filter((c) => c.category === cat).map((c) => (
                      <label
                        key={c.id}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors',
                          'border-b border-gray-50 dark:border-gray-800/50 last:border-b-0',
                          selected.includes(c.id)
                            ? 'bg-blue-50/60 dark:bg-blue-950/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => toggle(c.id)}
                          className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0"
                        />
                        <span className="text-[11px] text-gray-700 dark:text-gray-300 leading-tight">
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </Card.Content>
            </Card>
          )}
        </div>

        {/* 중앙: 코드 에디터 / 미리보기 */}
        <Card className="flex flex-col">
          <Card.Header>
            <Card.Title>{mode === 'code' ? '전략 코드' : '미리보기 / 생성 코드'}</Card.Title>
            <div className="flex items-center gap-2">
              <Badge variant="default">Pine Script v5</Badge>
              <Button variant="ghost" size="sm">복사</Button>
            </div>
          </Card.Header>
          <Card.Content className="flex-1 p-0">
            {mode === 'code' ? (
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="
                  w-full h-full min-h-[480px] p-4 text-[12px] font-mono leading-relaxed
                  bg-gray-950 text-gray-200 border-0
                  resize-none outline-none
                "
                spellCheck={false}
              />
            ) : (
              <pre className="
                text-[12px] font-mono leading-relaxed
                text-gray-400 dark:text-gray-500
                bg-gray-50 dark:bg-gray-800/40
                p-4 min-h-[480px]
                whitespace-pre-wrap overflow-auto
              ">
                {selected.length === 0
                  ? '// 왼쪽에서 진입 조건을 선택하면\n// 전략 코드가 자동 생성됩니다.'
                  : `// 생성된 전략 코드 (${selected.length}개 조건)\n\n` +
                    selected
                      .map((id) => {
                        const c = ENTRY_CONDITIONS.find((x) => x.id === id)
                        return `// ✓ ${c?.label}`
                      })
                      .join('\n') +
                    '\n\n// ... 조건을 더 추가하면 코드가 확장됩니다.'
                }
              </pre>
            )}
          </Card.Content>
        </Card>

        {/* 우: 리스크 설정 + 포지션 관리 */}
        <div className="flex flex-col gap-3">

          {/* 손절/익절 */}
          <Card>
            <Card.Header><Card.Title>손절 설정</Card.Title></Card.Header>
            <Card.Content className="flex flex-col gap-3">
              {/* 손절 유형 선택 */}
              <div>
                <p className="text-[10px] text-slate-400 mb-1.5 font-semibold">손절 유형</p>
                <div className="flex flex-col gap-1">
                  {STOP_CONDITIONS.map((s) => (
                    <label
                      key={s.id}
                      className={cn(
                        'flex items-start gap-2 px-2.5 py-2 border rounded-[1px] cursor-pointer transition-colors',
                        stopType === s.id
                          ? 'border-slate-900 bg-slate-50 dark:border-gray-400 dark:bg-gray-800/60'
                          : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40',
                      )}
                    >
                      <input
                        type="radio"
                        name="stopType"
                        value={s.id}
                        checked={stopType === s.id}
                        onChange={() => setStopType(s.id)}
                        className="mt-0.5 accent-slate-900 flex-shrink-0"
                      />
                      <div>
                        <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{s.label}</p>
                        <p className="text-[10px] text-gray-400">{s.hint}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 손절 값 */}
              {selectedStop && (
                <Input
                  placeholder={`${selectedStop.label} 값`}
                  type="number"
                  value={stopValue}
                  onChange={(e) => setStopValue(e.target.value)}
                />
              )}

              {/* 익절 */}
              <Input
                placeholder="익절 (%)"
                type="number"
                value={takeProfitPct}
                onChange={(e) => setTakeProfitPct(e.target.value)}
              />
            </Card.Content>
          </Card>

          {/* 포지션 관리 */}
          <Card>
            <Card.Header><Card.Title>포지션 관리</Card.Title></Card.Header>
            <Card.Content className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">포지션 크기 (%)</label>
                <Input
                  placeholder="전체 자본 대비 % (예: 10)"
                  type="number"
                  value={posSize}
                  onChange={(e) => setPosSize(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">최대 동시 포지션</label>
                <select
                  value={maxOpenPos}
                  onChange={(e) => setMaxOpenPos(e.target.value)}
                  className="h-8 w-full text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-[1px] bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                >
                  {['1', '2', '3', '5'].map((v) => (
                    <option key={v} value={v}>{v}개</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">피라미딩 허용</label>
                <div className="flex gap-2">
                  {['허용 안함', '최대 2회', '최대 3회'].map((v) => (
                    <button
                      key={v}
                      className="flex-1 h-7 text-[10px] border border-gray-200 dark:border-gray-700 rounded-[1px] text-slate-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* 백테스트 설정 */}
          <Card>
            <Card.Header><Card.Title>백테스트 설정</Card.Title></Card.Header>
            <Card.Content className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 block mb-1">시작일</label>
                  <input
                    type="date"
                    defaultValue="2024-01-01"
                    className="h-8 w-full text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-[1px] bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 block mb-1">종료일</label>
                  <input
                    type="date"
                    defaultValue="2025-03-01"
                    className="h-8 w-full text-[11px] px-2 border border-gray-200 dark:border-gray-700 rounded-[1px] bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">수수료 (%)</label>
                <Input placeholder="예: 0.04" type="number" defaultValue="0.04" />
              </div>
              <Button variant="secondary" size="sm" className="w-full justify-center">
                백테스트 실행
              </Button>
            </Card.Content>
          </Card>

        </div>
      </div>
    </PageShell>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import PageShell   from '../components/ui/PageShell'
import PageHeader  from '../components/ui/PageHeader'
import Card        from '../components/ui/Card'
import Badge       from '../components/ui/Badge'
import Button      from '../components/ui/Button'
import { cn }      from '../lib/cn'
import { REVIEW_STATUS } from '../lib/userStrategies'
import { getReviewStrategies } from '../lib/strategyService'

const STATUS_TABS = [
  { id: 'all',          label: '전체'    },
  { id: 'submitted',    label: '검토 대기' },
  { id: 'under_review', label: '검토 중'  },
  { id: 'approved',     label: '승인됨'   },
  { id: 'rejected',     label: '반려됨'   },
]

function fmtDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ── 상세 패널 ───────────────────────────────── */
function DetailPanel({ strategy, onAction, onClose }) {
  const [rejectNote, setRejectNote] = useState(strategy.reviewNote ?? '')
  const [noteError,  setNoteError]  = useState('')

  const statusCfg = REVIEW_STATUS[strategy.status] ?? REVIEW_STATUS.submitted

  function handleReject() {
    if (!rejectNote.trim()) { setNoteError('반려 사유를 입력해주세요.'); return }
    onAction(strategy.id, 'reject', rejectNote)
    setNoteError('')
  }

  const canAction = strategy.status === 'submitted' || strategy.status === 'under_review'

  return (
    <Card className="self-start sticky top-4 overflow-hidden">
      <Card.Header className="flex items-center justify-between">
        <Card.Title className="truncate max-w-[220px] text-[12px]">{strategy.name}</Card.Title>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded-[1px] text-[12px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </Card.Header>

      <Card.Content className="flex flex-col gap-3 text-[11px]">

        {/* 기본 정보 그리드 */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['자산',     strategy.asset      ?? '—'],
            ['타임프레임', strategy.timeframe ?? '—'],
            ['리스크',   strategy.riskLevel   ?? '—'],
            ['방식',     strategy.mode === 'code' ? '코드 편집' : '간편 제작'],
            ['제출일',   fmtDate(strategy.createdAt)],
            ['수정일',   fmtDate(strategy.updatedAt)],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50/60 dark:bg-gray-800/40 rounded-[1px] px-2.5 py-1.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
              <p className="font-semibold text-slate-700 dark:text-slate-300">{value}</p>
            </div>
          ))}
        </div>

        {/* 태그 */}
        {strategy.tags?.length > 0 && (
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">태그</p>
            <div className="flex flex-wrap gap-1">
              {strategy.tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-800 rounded-[1px] text-[10px] text-slate-600 dark:text-slate-400">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 진입 조건 (nocode 모드) */}
        {strategy.mode !== 'code' && strategy.conditions?.length > 0 && (
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">진입 조건</p>
            <ul className="space-y-0.5 text-slate-600 dark:text-slate-400">
              {strategy.conditions.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 리스크 설정 */}
        {(strategy.stopValue || strategy.takeProfitPct || strategy.posSize) && (
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">리스크 설정</p>
            <div className="flex flex-col gap-0.5 text-slate-600 dark:text-slate-400">
              {strategy.stopValue    && <span>손절: {strategy.stopType} / {strategy.stopValue}</span>}
              {strategy.takeProfitPct && <span>익절: {strategy.takeProfitPct}%</span>}
              {strategy.posSize      && <span>포지션 크기: {strategy.posSize}%</span>}
              {strategy.maxOpenPos   && <span>최대 동시 포지션: {strategy.maxOpenPos}개</span>}
            </div>
          </div>
        )}

        {/* 코드 미리보기 */}
        {strategy.mode === 'code' && strategy.code && (
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">전략 코드</p>
            <pre className="text-[10px] font-mono bg-gray-950 text-gray-300 rounded-[1px] p-2.5 max-h-[120px] overflow-y-auto whitespace-pre-wrap">
              {strategy.code}
            </pre>
          </div>
        )}

        {/* 기존 반려 사유 */}
        {strategy.status === 'rejected' && strategy.reviewNote && (
          <div className="bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-[1px] px-2.5 py-2">
            <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1">반려 사유</p>
            <p className="text-red-700 dark:text-red-400 leading-relaxed">{strategy.reviewNote}</p>
          </div>
        )}

        {/* 액션 영역 */}
        {canAction && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-gray-800">

            {strategy.status === 'submitted' && (
              <Button
                variant="secondary" size="sm"
                onClick={() => onAction(strategy.id, 'under_review')}
              >
                검토 시작
              </Button>
            )}

            {/* 반려 사유 */}
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                반려 사유 {strategy.status === 'under_review' && <span className="text-red-400">(반려 시 필수)</span>}
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => { setRejectNote(e.target.value); setNoteError('') }}
                placeholder="반려 사유를 입력하세요..."
                rows={2}
                className="
                  w-full text-[11px] px-2.5 py-2
                  border border-slate-200 dark:border-gray-700
                  rounded-[1px] bg-white dark:bg-gray-900
                  text-slate-700 dark:text-slate-300
                  resize-none focus:outline-none focus:border-slate-400
                "
              />
              {noteError && (
                <p className="text-[10px] text-red-500 mt-0.5">{noteError}</p>
              )}
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={handleReject}
                className="
                  flex-1 h-7 text-[11px] font-medium rounded-[1px]
                  border border-red-200 dark:border-red-900/60
                  text-red-600 dark:text-red-400
                  hover:bg-red-50 dark:hover:bg-red-950/30
                  transition-colors
                "
              >
                반려
              </button>
              <button
                onClick={() => onAction(strategy.id, 'approve')}
                className="
                  flex-1 h-7 text-[11px] font-semibold rounded-[1px]
                  bg-emerald-600 hover:bg-emerald-700
                  text-white transition-colors
                "
              >
                승인
              </button>
            </div>
          </div>
        )}

        {/* 승인/반려 완료 상태 */}
        {!canAction && strategy.status !== 'submitted' && (
          <div className={cn(
            'text-center py-2 rounded-[1px] text-[11px] font-semibold',
            strategy.status === 'approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400',
          )}>
            {strategy.status === 'approved' ? '✓ 마켓 게시 중' : '✕ 반려됨'}
          </div>
        )}

      </Card.Content>
    </Card>
  )
}

/* ── AdminReviewPage ────────────────────────── */
export default function AdminReviewPage({ currentUser, supaReady, dataVersion = 0, onReviewAction }) {
  const [tab,      setTab]      = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!supaReady) { setRows([]); setError(''); return }
      if (!currentUser?.id) { setRows([]); setError('로그인 후 검수 목록을 볼 수 있습니다.'); return }
      try {
        if (!cancelled) { setLoading(true); setError('') }
        const data = await getReviewStrategies()
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e?.message ?? '검수 목록 로드 실패')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supaReady, currentUser?.id, dataVersion])

  const userStrategies = useMemo(() => {
    return (rows ?? []).map((row) => {
      const risk = (row?.risk_config && typeof row.risk_config === 'object') ? row.risk_config : {}
      return {
        id: row.id,
        name: row.name,
        desc: row.description ?? '',
        asset: row.asset ?? 'BTC',
        assetType: String(row.asset ?? 'BTC').toLowerCase(),
        timeframe: row.timeframe ?? '1h',
        mode: row.mode ?? 'nocode',
        type: row.strategy_type ?? 'trend',
        typeLabel: 'DB 전략',
        riskLevel: row.risk_level ?? 'mid',
        status: row.status ?? 'draft',
        tags: Array.isArray(row.tags) ? row.tags : [],
        code: row.code ?? '',
        conditions: row.conditions ?? [],
        risk_config: row.risk_config ?? {},
        reviewNote: row.review_note ?? '',
        createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
        updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
        isDbStrategy: true,
        creator: 'me',
        stopType: risk.stopType ?? 'fixed_pct',
        stopValue: risk.stopValue ?? '',
        takeProfitPct: risk.takeProfitPct ?? '',
        posSize: risk.posSize ?? '',
        maxOpenPos: risk.maxOpenPos ?? '1',
      }
    })
  }, [rows])

  /* draft 제외한 전체 검수 대상 */
  const reviewable = useMemo(
    () => [...userStrategies].filter((s) => s.status !== 'draft').sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [userStrategies],
  )

  const filtered = useMemo(
    () => tab === 'all' ? reviewable : reviewable.filter((s) => s.status === tab),
    [reviewable, tab],
  )

  /* selectedId 기반으로 항상 최신 데이터 참조 */
  const detail = useMemo(
    () => selectedId ? reviewable.find((s) => s.id === selectedId) ?? null : null,
    [selectedId, reviewable],
  )

  const counts = useMemo(() => {
    const c = {}
    STATUS_TABS.forEach(({ id }) => {
      c[id] = id === 'all' ? reviewable.length : reviewable.filter((s) => s.status === id).length
    })
    return c
  }, [reviewable])

  function handleAction(id, action, note) {
    onReviewAction?.(id, action, note)
    /* 승인/반려 후 상세 패널은 유지 (상태 변경 확인 가능) */
  }

  return (
    <PageShell wide>
      <PageHeader
        title="전략 검수"
        description="제출된 사용자 전략을 검토하고 승인 또는 반려합니다."
        action={
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-amber-500" />
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Admin Mode</span>
          </div>
        }
      />

      {loading && (
        <div className="mb-3 px-3 py-2 border border-slate-200 bg-slate-50/70 dark:bg-slate-900 dark:border-slate-800 rounded-[2px]">
          <p className="text-[11px] text-slate-500">검수 목록 로딩 중...</p>
        </div>
      )}
      {!loading && error && (
        <div className="mb-3 px-3 py-2 border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40 rounded-[2px]">
          <p className="text-[11px] text-amber-700 dark:text-amber-400">{error}</p>
        </div>
      )}

      {/* 상태 탭 */}
      <div className="flex items-center gap-0 mb-4 border-b border-slate-200 dark:border-gray-800">
        {STATUS_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {label}
            {counts[id] > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 tabular-nums">
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={cn('grid gap-3', detail ? 'grid-cols-[1fr_340px]' : 'grid-cols-1')}>

        {/* 전략 테이블 */}
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 flex items-center justify-center">
              <p className="text-[12px] text-slate-400">해당 상태의 전략이 없습니다.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/30">
                  {['전략명', '자산', '타임프레임', '상태', '제출일', '수정일', '액션'].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const statusCfg  = REVIEW_STATUS[s.status] ?? REVIEW_STATUS.submitted
                  const isSelected = selectedId === s.id
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedId(isSelected ? null : s.id)}
                      className={cn(
                        'border-b border-slate-50 dark:border-gray-800/50 cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/20'
                          : 'hover:bg-slate-50/40 dark:hover:bg-gray-800/20',
                      )}
                    >
                      <td className="px-3.5 py-2.5">
                        <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                          {s.name}
                        </span>
                        {s.typeLabel && (
                          <span className="ml-1.5 text-[9px] text-slate-400">{s.typeLabel}</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] font-mono text-slate-500">{s.asset ?? '—'}</td>
                      <td className="px-3.5 py-2.5 text-[11px] text-slate-500">{s.timeframe ?? '—'}</td>
                      <td className="px-3.5 py-2.5">
                        <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
                      </td>
                      <td className="px-3.5 py-2.5 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {fmtDate(s.createdAt)}
                      </td>
                      <td className="px-3.5 py-2.5 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {fmtDate(s.updatedAt)}
                      </td>
                      <td className="px-3.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {s.status === 'submitted' && (
                            <Button variant="ghost" size="sm"
                              onClick={() => onReviewAction?.(s.id, 'under_review')}
                            >
                              검토 시작
                            </Button>
                          )}
                          {(s.status === 'submitted' || s.status === 'under_review') && (
                            <button
                              onClick={() => onReviewAction?.(s.id, 'approve')}
                              className="h-6 px-2 text-[10px] font-semibold rounded-[1px] bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                            >
                              승인
                            </button>
                          )}
                          <Button variant="ghost" size="sm"
                            onClick={() => setSelectedId(isSelected ? null : s.id)}
                          >
                            {isSelected ? '닫기' : '상세'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* 상세 패널 */}
        {detail && (
          <DetailPanel
            key={detail.id + detail.status}
            strategy={detail}
            onAction={handleAction}
            onClose={() => setSelectedId(null)}
          />
        )}

      </div>
    </PageShell>
  )
}

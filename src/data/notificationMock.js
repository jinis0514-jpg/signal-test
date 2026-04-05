/**
 * 알림 패널 UI 구성용 mock (실시간 시그널 연결 전)
 * id는 bb-mock- 접두로 읽음 처리 시 Supabase 호출 생략
 */

import { NOTIFICATION_TYPES } from '../lib/notificationService'

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString()

export const MOCK_NOTIFICATIONS = [
  {
    id: 'bb-mock-sig-long',
    type: NOTIFICATION_TYPES.ENTRY,
    title: 'LONG 진입',
    message: 'BTC 추세 추종 · 42,350 USDT',
    is_read: false,
    created_at: ago(2),
    meta: {
      uiKind: 'long_entry',
      nav: { page: 'signal', strategyId: 'btc-trend' },
    },
  },
  {
    id: 'bb-mock-sig-short',
    type: NOTIFICATION_TYPES.ENTRY,
    title: 'SHORT 진입',
    message: 'ETH 박스권 · 2,285 USDT',
    is_read: false,
    created_at: ago(18),
    meta: {
      uiKind: 'short_entry',
      nav: { page: 'signal', strategyId: 'btc-trend' },
    },
  },
  {
    id: 'bb-mock-sig-exit',
    type: NOTIFICATION_TYPES.EXIT,
    title: '청산',
    message: 'BTC 추세 추종 · 수익 실현 @ 43,100',
    is_read: true,
    created_at: ago(55),
    meta: {
      uiKind: 'exit',
      nav: { page: 'signal', strategyId: 'btc-trend' },
    },
  },
  {
    id: 'bb-mock-strategy',
    type: NOTIFICATION_TYPES.STRATEGY_UPDATE,
    title: '전략 상태 변경',
    message: '「박스권 돌파」가 검수 대기열에서 검토 중으로 바뀌었습니다.',
    is_read: false,
    created_at: ago(120),
    meta: {
      uiKind: 'strategy_status',
      nav: { page: 'mypage', section: 'strategies' },
    },
  },
  {
    id: 'bb-mock-sub',
    type: NOTIFICATION_TYPES.SYSTEM,
    title: '구독 상태 변경',
    message: 'Pro 플랜이 활성화되었습니다. 시그널 알림이 켜졌습니다.',
    is_read: false,
    created_at: ago(360),
    meta: {
      uiKind: 'subscription',
      nav: { page: 'mypage', section: 'subscription' },
    },
  },
]

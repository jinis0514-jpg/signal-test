# 데이터 저장 구조 정책

## 저장 경계 원칙

## 1) DB에 저장할 것

- 사용자/권한/구독 상태
  - `profiles`, `subscriptions`, `user_trials`
- 전략 메타 및 검수 상태
  - `strategies`, `strategy_reviews`, `strategy_versions`
- 운영용 알림/읽음 상태
  - `notifications`
- 전략 성과 요약/거래 로그 요약
  - `performance`(jsonb), `engine_trades`(요약 위주)

### 금지/주의

- [ ] 거래소 원시 캔들 전체를 장기 누적 저장 금지
- [ ] 초고빈도 틱/체결 raw 데이터 DB 누적 금지

## 2) Storage에 저장할 것

- 전략 설명 PDF 원본/프리뷰
- 이미지/첨부파일(향후 필요 시)

### 정책

- [ ] 파일 경로: `{userId}/{strategyId}/{filename}` 규칙
- [ ] 파일 메타는 DB에 최소 저장(경로, mime, size, checksum)
- [ ] 공개 파일은 민감정보 포함 금지

## 3) 외부 API로만 가져올 것

- 시세/캔들/거래량 원시 데이터
- 지수/환율/뉴스 등 실시간 참고 데이터

### 캐시 전략

- 빠른 숫자: 메모리 캐시(수초)
- 무거운 집계: 서버/엣지 캐시(수십초~수분)
- 장애 시 마지막 정상값 유지 + stale 표시

## 4) 저장 모델 권장 (출시 전)

- `strategy_performance_snapshots` (일/주 단위 집계)
  - `strategy_id`, `as_of`, `roi`, `mdd`, `win_rate`, `trade_count`
- `strategy_trade_events` (상세 로그가 필요할 때만)
  - 상세 보관 기간 정책 필요(TTL/아카이빙)

## 5) 체크리스트

- [ ] "원시 데이터 vs 운영 데이터"가 테이블 단위로 분리됐는가
- [ ] 조회가 많은 화면은 요약 테이블/스냅샷을 사용 중인가
- [ ] 데이터 보존 기간(예: 90일/180일) 정책이 정의됐는가

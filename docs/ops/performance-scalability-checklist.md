# 성능/확장성 점검 체크리스트

## 1) 업데이트 주기 계층

- 빠름(0.5~1s 체감): 상단 티커/핵심 PnL 숫자
- 중간(1~3s): 활성 전략 상태/요약 카드
- 느림(3~10s): 마켓 집계/검증 집계/정렬 재계산

### 현재 코드 기준

- Home: fast 숫자(1s), slow 집계(5s) 분리 적용
- Signal: 가격/PnL(1s), 캔들(2.5s) 분리 적용
- Market: BTC 보조값(5s), 전략 로드는 이벤트 기반

## 2) 리렌더/UX

- [ ] 최초 로딩 이후 skeleton 재표시 금지
- [ ] 기존 값 유지 + 숫자만 변경
- [ ] `React.memo` 대상 컴포넌트 분리(티커/행 단위)

## 3) 무거운 쿼리 점검

- [ ] `strategies` 목록: 필요한 컬럼만 select
- [ ] `notifications`는 `(user_id, created_at desc)` 인덱스 사용 확인
- [ ] 기간 필터/정렬 쿼리는 explain analyze로 비용 확인

## 4) 전략 검증 계산 위치

- 현재: 상당수 클라이언트 계산
- 권장:
  - [ ] 대규모 검증/배치 계산은 서버 작업 큐로 이동
  - [ ] 프론트는 요약/최근 스냅샷 우선 사용

## 5) 인덱스 권장

- `strategies(creator_id, updated_at desc)`
- `strategies(status, updated_at desc)`
- `subscriptions(user_id)` unique 이미 존재
- `strategy_reviews(strategy_id, created_at desc)`
- `strategy_versions(strategy_id, version_no)` unique 이미 존재

## 6) 병목 의심 포인트

- [ ] 전략 목록에서 JSONB 대용량 필드(`engine_trades`) 과다 전송
- [ ] 클라이언트에서 전체 리스트 정렬/필터 반복
- [ ] 동일 심볼 반복 fetch

## 7) 점검 결과 기록 템플릿

- 화면:
- 증상:
- 재현 조건:
- 호출 수(분당):
- 평균 응답시간:
- 개선안:

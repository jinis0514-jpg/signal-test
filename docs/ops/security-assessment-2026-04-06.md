# 보안 점검 결과 (2026-04-06)

범위: 권한 우회, 결제 우회, 데이터 노출, 업로드/입력 취약점, API 과호출, 코드 실행 안전성

## 요약 (우선순위)

### P0 (출시 전 반드시 차단)

1. 결제/플랜 반영이 클라이언트 경로로 가능
   - 근거: `src/lib/subscriptionService.js`의 `startPaidPlan`, `startTrial`, `upsertMySubscription`가 프론트에서 `subscriptions`를 직접 update/insert
   - 위험: 프론트 조작으로 플랜 상승(결제 우회) 시도 가능
   - 조치:
     - `subscriptions` 테이블의 `insert/update`를 일반 사용자에게 차단
     - 서버(Edge Function/백엔드) + 결제 웹훅만 변경 허용
     - 웹훅 idempotency key 필수

2. `subscriptions` RLS가 본인 update 허용
   - 근거: `supabase/schema.sql`의 `subscriptions_update_own`
   - 위험: 결제 상태를 사용자 본인이 조작할 가능성
   - 조치:
     - 사용자 직접 `update` 정책 제거
     - 읽기 전용 + 서버 role 전용 변경 경로

3. 전략 공개 필드(is_public/status)에 대한 상태 전환 통제 미흡
   - 근거: `supabase/schema.sql`의 `strategies_update_own`는 creator면 광범위 update 허용
   - 위험: 검수/공개 워크플로우 우회 가능성
   - 조치:
     - 사용자 update 허용 컬럼 제한(예: draft 작성 필드만)
     - `status`, `is_public`, `review_note`는 admin/서버만 변경

### P1 (출시 직후 사고 가능성 높음)

4. Storage 버킷 공개 범위 과다
   - 근거: `supabase/schema.sql`의 `strategy-pdfs` 버킷 `public=true`, `select` 공개
   - 위험: URL만 알면 비인가 열람 가능(민감 정보 노출)
   - 조치:
     - private 버킷 전환 + signed URL 강제
     - 문서/정책상 공개 허용 항목만 별도 버킷

5. `method-pdfs` 버킷 정책 정의 누락
   - 근거: `src/lib/methodPdfStorage.js`는 `method-pdfs` 사용, SQL에는 `strategy-pdfs`만 정의
   - 위험: 환경별 default 정책 의존(오동작/권한 누락/관리 사각지대)
   - 조치:
     - `method-pdfs` 버킷 생성 + insert/delete/select 정책 명시
     - 파일 접근 모델 일관화

6. support ticket 모델 명칭 불일치
   - 근거: 현재 `support_messages` 테이블 존재, 요청 모델 `support_tickets` 없음
   - 위험: 운영/리포트 파이프라인 혼선
   - 조치:
     - 테이블명 표준 확정(`support_tickets` 권장)
     - 뷰/alias 또는 마이그레이션으로 일관화

### P2 (중기 개선)

7. 입력값 sanitization 정책이 서버 단에서 강제되지 않음
   - 근거: 프론트 정규화(`normalizeStrategyPayload`) 중심, HTML allow/deny 서버 규칙 부재
   - 위험: 운영자/백오피스 뷰에서 XSS 유입 가능성
   - 조치:
     - 서버 저장 전 sanitize/validate
     - 출력 시 escape 기본 + HTML 렌더 금지

8. API rate-limit/쿼터 강제 부재
   - 근거: 클라이언트 polling 구조는 있으나 서버 레벨 제한 정책 문서/코드 부재
   - 위험: 과호출/봇 트래픽 시 비용 급등 및 장애
   - 조치:
     - Edge/API 게이트웨이 rate-limit
     - key/user/ip 단위 quota
     - 무거운 endpoint 캐시 계층 추가

## 항목별 점검 결과

## 1) Supabase RLS 정책

- `profiles`, `strategies`, `subscriptions`, `notifications` RLS 활성화 확인
- `support_messages` RLS 활성화 확인 (`supabase/support_messages.sql`)
- 누락/주의:
  - `strategy_versions`, `strategy_reviews`에 명시적 정책 확인 필요(테이블은 RLS 활성)
  - `feedback`/`support_tickets` 명칭 정책 불일치 (현재는 `support_messages`)

## 2) 플랜/권한 서버 검증

- 현재는 클라이언트 서비스에서 플랜 상태를 갱신 가능
- 서버 단 강제 검증/웹훅 반영으로 변경 필요
- 전략 등록 개수/구독 개수는 UI 제한은 있으나 서버 하드 가드 필요

## 3) 결제 상태 검증

- 현재 결제는 mock 단계 (`checkoutIntent` + `subscriptionService`)
- 웹훅 기반 확정/재시도/중복 방지 구현 필요

## 4) 파일 업로드 보안

- MIME/확장자/용량 검사 있음 (`strategyPdfStorage`, `methodPdfStorage`)
- 랜덤 파일명(`uuid`) 적용됨
- 공개 범위가 넓음(전략 PDF public) → private+signed URL 권장

## 5) 입력값 sanitization

- `dangerouslySetInnerHTML` 사용 흔적 없음
- 하지만 저장 단계 sanitize 서버 강제 없음

## 6) 실시간 알림 권한

- 로그인/구독/전략별 설정 체크 존재
  - `src/lib/signalNotifyEligibility.js`
- 세션 내 중복 알림 방지 존재
  - `src/lib/signalNotificationDedupe.js`
- 추가 권장:
  - 서버 측 dedupe 키 테이블(다중 디바이스/재시작 대응)

## 7) API 과호출 방지

- 폴링 계층 분리는 일부 적용됨
- 서버 측 rate-limit, 캐시, 무거운 집계 보호가 필요

## 8) 전략 코드 실행부 안전성

- `eval`, `new Function` 검색 결과 없음
- 현재는 엔진 규칙 기반 실행으로 보이며 동적 코드 실행 취약점은 낮음
- 다만 향후 사용자 코드 직접 실행 기능 도입 시 sandbox/timeout 필수

## 즉시 실행 액션 (체크리스트)

- [ ] `subscriptions_update_own` 제거
- [ ] 결제/플랜 변경 서버 전용 함수로 이관
- [ ] `strategies` 민감 컬럼 업데이트 권한 분리
- [ ] `strategy-pdfs` 공개 정책 재검토(private+signed URL)
- [ ] `method-pdfs` 버킷 정책 SQL 추가
- [ ] 서버 입력 sanitize/validate 공통 레이어 추가
- [ ] API rate-limit/캐시 정책 적용

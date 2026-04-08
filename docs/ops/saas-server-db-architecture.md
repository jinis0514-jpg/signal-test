# SaaS 서버/DB 중심 구조 정리

이 문서는 결제/플랜/권한을 프론트 상태가 아닌 서버/DB 기준으로 운영하기 위한 기준안입니다.

## 목표

- 결제 성공 판단은 프론트가 아닌 웹훅(서버)에서만 수행
- 플랜 상태는 `user_plans` 단일 테이블에서만 판정
- UI는 DB 상태를 읽어 반영만 수행 (쓰기 권한 최소화)
- RLS로 사용자 간 데이터 접근 우회 차단

## 핵심 테이블

- `profiles`: 사용자 기본 정보, 역할(`role`)
- `strategies`: 전략 메타/상태(`status`, `is_public`)
- `strategy_performance`: 전략 성과 요약 저장
- `strategy_trades`: 전략 트레이드 로그 저장
- `strategy_subscriptions`: 사용자-전략 구독 관계
- `notifications`: 알림 설정/로그
- `feedback`: 사용자 피드백
- `support_tickets`: 문의/상담 티켓
- `user_plans`: 사용자 현재 플랜 상태(SSOT)
- `payments`: 결제 원장(성공/실패/환불 이력)

참고: 기존 `subscriptions`가 결제용으로 사용 중이라면 레거시로 유지하고, 새 구독 관계는 `strategy_subscriptions`로 분리합니다.

## 플랜 정책

- `free`
- `standard`: 전략 구독 2개
- `pro`: 전략 등록 5개
- `premium`: 전략 등록 10개 + 우선 노출 플래그 가능

DB 함수로 제한을 강제합니다.

- `get_effective_plan(user_id)`
- `get_registration_limit(plan)`
- `get_subscription_limit(plan)`
- 트리거:
  - 전략 등록 제한: `trg_enforce_strategy_registration_limit`
  - 전략 구독 제한: `trg_enforce_strategy_subscription_limit`

## 결제 플로우 (권장)

1. 프론트는 결제창 호출만 수행
2. 결제 결과는 결제사 웹훅 -> 서버로 수신
3. 서버에서 무결성 검증(서명/금액/중복)
4. 서버가 `payments` upsert/insert
5. 성공 시 서버가 `user_plans` 갱신
6. 프론트는 `user_plans`/`payments` 조회만 수행

핵심 원칙: 프론트에서 플랜 상태를 직접 업데이트하지 않음

## RLS 원칙

- 기본: 모든 테이블 RLS 활성화
- 사용자 데이터: 본인 `select/insert`만 허용
- 관리자 데이터: `profiles.role = 'admin'` 조건으로 제한된 전체 조회
- 플랜/결제 변경(`user_plans`, `payments`)은 사용자 쓰기 정책 부여 금지

## 데이터 저장 원칙

- 캔들 원본 시계열은 DB 저장 금지
- 저장 대상은 전략 결과(요약) + 트레이드 로그 중심
- 원본 마켓 데이터는 외부 API에서 조회/조합

## 단계별 전환 절차

1. `supabase/saas_v2_foundation.sql` 적용
2. 서버 웹훅에서 `payments`, `user_plans`만 갱신하도록 연결
3. 프론트 `subscription` 쓰기 로직 제거 후 읽기 전용 전환
4. 운영 검증 후 레거시 `subscriptions` 업데이트 정책 제거
5. 구독/등록/유료데이터 접근을 RPC 또는 서버 API로 일원화

## 운영 체크리스트

- [ ] 동일 결제 이벤트 중복 수신 시 `payments` 중복 기록 방지
- [ ] 실패/취소/환불 시 `user_plans` 상태 정상 롤백
- [ ] 사용자 A가 사용자 B의 플랜/결제/문의 조회 불가
- [ ] unapproved 전략은 타 사용자 조회 불가
- [ ] 플랜 우회(프론트 값 조작)로 등록/구독 제한 우회 불가


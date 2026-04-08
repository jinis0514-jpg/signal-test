# 운영 안정성 점검 가이드

출시 전 내부 점검용 문서 모음입니다.

- `security-checklist.md`: RLS/권한/키 노출/업로드/입력검증
- `data-storage-policy.md`: DB vs Storage vs 외부 API 저장 경계
- `performance-scalability-checklist.md`: 폴링/쿼리/검증 연산/인덱스 점검
- `payment-stability-checklist.md`: 결제 성공/실패/중복/웹훅/환불 처리
- `incident-log-points.md`: 장애 발생 시 확인할 로그 포인트

## 운영 원칙

1. 프론트는 `anon key`만 사용, 결제/플랜 확정은 서버/웹훅 단일 경로로 처리
2. RLS는 기본 거부(default deny) + 최소 권한 정책
3. 대량 원시 시세는 DB 적재 금지, 요약/스냅샷 중심 저장
4. 실시간 체감 데이터와 무거운 집계를 업데이트 계층으로 분리

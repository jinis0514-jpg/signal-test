# 보안 점검 체크리스트

## 1) Supabase RLS 정책 점검

### 현재 확인 사항 (코드/스키마 기준)

- `profiles`, `strategies`, `subscriptions`, `notifications`에 RLS 활성화됨
- 본인 데이터 접근 정책 존재 (`auth.uid() = id` 또는 `creator_id = auth.uid()`)
- 익명(`anon`)은 승인 전략(`approved`, `published`) 읽기만 허용
- 프론트는 `VITE_SUPABASE_ANON_KEY`만 사용 (`service_role` 프론트 노출 없음)

### 출시 전 필수 확인

- [ ] `strategy_versions`, `strategy_reviews`, `user_trials` 정책을 운영 의도에 맞게 명시
- [ ] 관리자 전용 조회/변경은 admin role 정책으로만 허용
- [ ] `subscriptions` 사용자 직접 `update` 허용 범위 재검토
  - 권장: 결제 상태/플랜 변경은 서버(웹훅)만 가능
- [ ] `strategies`의 `is_public`, `status` 전환은 검수 권한으로만 가능하게 분리
- [ ] 타 사용자 row `update/delete`가 불가능한지 SQL 테스트 케이스로 검증

## 2) 파일 업로드(Storage) 정책 점검

### 현재 확인 사항

- `strategy-pdfs` 버킷 존재
- 업로드/삭제는 본인 폴더(`{userId}/...`)만 허용
- 버킷이 public이라 `select`는 공개

### 출시 전 필수 확인

- [ ] PDF 공개 범위를 전략 공개 정책과 맞출지 결정
  - 공개 유지: 민감정보 포함 금지
  - 비공개 전환: signed URL + 만료시간 적용
- [ ] 허용 MIME/파일 크기 초과 차단 검증
- [ ] 업로드 경로 정규화(경로 조작 방지) 검증

## 3) 키/시크릿 노출 점검

- [ ] `.env`, 빌드 산출물에 service role key 없음 확인
- [ ] 결제 시크릿/웹훅 시크릿은 서버 환경변수로만 보관
- [ ] 프론트 로그/에러에 토큰/민감정보 출력 금지

## 4) 입력값 Sanitization / Validation

### 현재 확인 사항

- 전략 페이로드는 `normalizeStrategyPayload`로 1차 정규화
- DB 레벨에 일부 제약(check constraint) 존재

### 출시 전 필수 확인

- [ ] 서버 레이어에서 길이/형식/enum 강제 검증
- [ ] 텍스트 필드 XSS 방어(렌더 시 escape, HTML 삽입 금지)
- [ ] 검색/정렬 파라미터 allow-list 적용
- [ ] 파일명/URL 필드 정규화 및 악성 URL 차단

## 5) 점검 SQL (예시)

```sql
-- 1) 내 계정으로 다른 user_id row update 시도 (실패해야 정상)
update public.subscriptions
set plan = 'subscribed'
where user_id <> auth.uid();

-- 2) 다른 creator 전략 삭제 시도 (실패해야 정상)
delete from public.strategies
where creator_id <> auth.uid();
```

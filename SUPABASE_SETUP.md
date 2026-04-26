# Pink Zone Supabase DB 저장 적용 방법

## 1. Supabase SQL 실행

Supabase Dashboard → SQL Editor → New query로 이동한 뒤 아래 파일 내용을 실행하세요.

```text
supabase/schema.sql
```

생성되는 테이블은 3개입니다.

- `sisters`: 언니정보
- `reviews`: 언니후기
- `extra_orders`: 추가오더

모든 테이블은 `user_id` 기준으로 저장되며 RLS 정책이 적용되어 로그인한 본인 데이터만 조회/수정/삭제됩니다.

## 2. 환경변수 확인

로컬 `.env.local` 또는 Vercel 환경변수에 아래 값이 있어야 합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=본인_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=본인_supabase_anon_key
```

`service_role key`는 프론트에 넣지 마세요.

## 3. 수정된 핵심 내용

`app/dashboard/page.tsx`에서 기존 `localStorage` 저장 방식을 제거하고 Supabase DB 저장 방식으로 변경했습니다.

- 로그인 후 `sisters`, `reviews`, `extra_orders`를 DB에서 불러옴
- 언니정보 등록/수정/삭제 → Supabase DB 반영
- 후기 등록/수정/삭제 → Supabase DB 반영
- 추가오더 등록/수정/삭제 → Supabase DB 반영
- 헤더에 `백업 다운로드` 버튼 추가

## 4. 테스트 순서

1. Supabase SQL Editor에서 `supabase/schema.sql` 실행
2. 로컬에서 `npm run dev` 실행
3. 회원가입 또는 로그인
4. 언니정보 1개 저장
5. 로그아웃 후 재로그인
6. 저장한 데이터가 남아있는지 확인
7. 다른 브라우저 또는 다른 PC에서 같은 계정으로 로그인
8. 같은 데이터가 보이면 정상
9. 다른 계정으로 로그인했을 때 기존 데이터가 안 보이면 RLS 정상

## 5. 주의사항

이 패치본은 `.env.local`, `.next`, `node_modules`, `.git`을 제외하고 만들었습니다.
기존 프로젝트에 덮어씌운 뒤 본인 환경변수는 직접 유지하세요.

# 자산파트 주간보고 웹사이트

팀원 작성 → 팀장 취합 및 편집 → 파트장 확인 흐름의 주간보고 시스템 MVP입니다.

## 기술 스택

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **AI**: Gemini API (서버 Route Handler 전용)
- **주차 기준**: 일요일 00:00 KST

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local.example`을 복사하여 `.env.local`을 생성합니다.

```bash
cp .env.local.example .env.local
```

필수 값:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase 클라이언트 설정 |
| `GEMINI_API_KEY` | Gemini API 키 (서버 전용) |
| `GEMINI_MODEL` | 기본값: `gemini-3.1-flash-lite` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | AI API 토큰 검증용 (JSON 한 줄) |

### 3. Firebase Console 설정

1. [Firebase Console](https://console.firebase.google.com/) → `part-report` 프로젝트
2. **Authentication** → 이메일/비밀번호 로그인 활성화
3. **Firestore Database** 생성 (production mode)
4. **Storage** 활성화

### 4. 관리자 계정 생성 (최초 1회)

Firebase Console에서 수동으로 첫 관리자를 만듭니다.

1. Authentication → 사용자 추가 (이메일/비밀번호)
2. 생성된 **UID** 복사
3. Firestore → `users` 컬렉션 → 문서 ID = UID:

```json
{
  "name": "관리자",
  "email": "admin@example.com",
  "role": "admin",
  "teamId": null,
  "isActive": true,
  "mustChangePassword": false,
  "createdAt": "<타임스탬프>",
  "updatedAt": "<타임스탬프>"
}
```

4. 앱 로그인 → **관리자 → 팀 관리**에서 "기본 4팀 생성" 클릭

### 5. 사용자 계정 생성 (관리자)

회원가입 기능은 없습니다. 관리자가 계정을 생성합니다.

1. 관리자로 로그인 → **관리자 → 사용자 관리**
2. **계정 생성** 클릭
3. 이름, 이메일, 임시 비밀번호, 권한, 팀 입력
4. 생성된 임시 비밀번호를 사용자에게 전달
5. 사용자 최초 로그인 시 **비밀번호 변경 화면**이 표시됩니다

> 계정 생성 API는 `FIREBASE_SERVICE_ACCOUNT_KEY` 환경변수가 필요합니다.

### 6. Security Rules 배포

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage,firestore:indexes
```

### 7. Service Account (관리자 API / AI API용)

Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성

`.env.local`에 JSON 전체를 한 줄로:

```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### 8. 개발 서버 실행

```bash
npm run dev
```

> **참고**: 프로젝트 경로에 한글이 포함된 경우 Turbopack 빌드 오류가 발생할 수 있습니다.
> `npm run build`는 webpack 모드로 설정되어 있습니다.

http://localhost:3000 에서 확인

## Firestore 컬렉션 구조

| 컬렉션 | 설명 |
|--------|------|
| `users` | 사용자 프로필 및 권한 (role: admin/part_leader/team_leader/member) |
| `teams` | 팀 정보 (4개 팀) |
| `weeklyReports` | 팀원 개인 주간보고 |
| `teamReports` | 팀장 취합 보고 |
| `partReports` | 파트장 통합 보고 |
| `actionItems` | 요청사항 추적 |
| `comments` | 코멘트 |

### weekKey 형식

`YYYY-MM-DD` — 해당 주 일요일 날짜 (KST)

예: 2026-06-08(월) → `2026-06-07`

## 권한 구조

| 역할 | 접근 범위 |
|------|-----------|
| member | 본인 보고 CRUD |
| team_leader | 소속 팀 보고 조회/취합 |
| part_leader | 전체 팀 보고 조회/통합 |
| admin | 모든 데이터 + 사용자/팀 관리 |

## 주요 화면

- `/login` — 로그인
- `/dashboard` — 권한별 대시보드
- `/reports/write` — 주간보고 작성
- `/reports/team/[weekKey]` — 팀장 취합
- `/reports/part/[weekKey]` — 파트장 통합
- `/history` — 검색/히스토리
- `/action-items` — 요청사항 추적
- `/admin/users`, `/admin/teams` — 관리자

## AI 요약

- `POST /api/ai/summary` — Gemini API 호출
- API Key는 서버 환경변수만 사용 (클라이언트 노출 금지)
- AI 결과는 미리보기 후 사용자 확인 → 저장

## 배포 (Firebase App Hosting)

```bash
firebase init hosting
# Framework: Next.js 선택
firebase deploy
```

또는 Vercel:

```bash
npx vercel
```

환경변수를 Vercel/Firebase 대시보드에 동일하게 설정하세요.

## MVP 제한 사항

- PDF export 미지원 (Markdown 다운로드만)
- 전문 full-text 검색 미지원 (클라이언트 필터)
- Custom Claims 미사용 (Firestore role 기반)
- 이메일/Slack 알림 없음

## 초기 팀 데이터

| ID | 이름 |
|----|------|
| asset-ops | 자산운영팀 |
| esh | ESH팀 |
| food-culture | 푸드컬쳐팀 |
| procurement | 구매기획팀 |

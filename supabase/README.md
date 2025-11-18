# Supabase Edge Functions

이 폴더에는 ZeroFall 푸시 알림을 위한 Supabase Edge Functions가 포함되어 있습니다.

## 함수 목록

### 1. `send-push`
개별 푸시 알림을 발송합니다.

**요청:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "알림 제목",
  "body": "알림 내용",
  "data": { "customData": "value" }
}
```

### 2. `broadcast-push`
모든 admin 사용자에게 푸시 알림을 발송합니다. Supabase의 `zerofall_admin` 테이블에서 모든 `push_token`을 조회하여 발송합니다.

**요청:**
```json
{
  "title": "전체 공지 제목",
  "body": "전체 공지 내용",
  "data": { "customData": "value" }
}
```

### 3. `test-push`
테스트 푸시 알림을 발송합니다.

**요청:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

## 배포 방법

### 1. Supabase CLI 설치
```bash
npm install -g supabase
```

### 2. Supabase 프로젝트 연결
```bash
supabase login
supabase link --project-ref your-project-ref
```

### 3. Edge Functions 배포
```bash
# 개별 함수 배포
supabase functions deploy send-push
supabase functions deploy broadcast-push
supabase functions deploy test-push

# 또는 모든 함수 한번에 배포
supabase functions deploy
```

### 4. 환경 변수 설정
Supabase 대시보드에서 다음 환경 변수를 설정하세요:
- `SUPABASE_URL`: 자동 설정됨
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (broadcast-push에서 사용)

## 로컬 테스트

```bash
# Supabase 로컬 개발 환경 시작
supabase start

# Edge Function 로컬 실행
supabase functions serve send-push
```

## 참고

- Edge Functions는 Deno 런타임을 사용합니다
- CORS는 자동으로 처리됩니다
- 모든 함수는 Expo Push API (`https://exp.host/--/api/v2/push/send`)를 사용합니다


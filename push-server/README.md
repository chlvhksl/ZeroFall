# ZeroFall 푸시 서버

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (.env 파일 생성)
# SUPABASE_URL=https://your-project-id.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# 또는
# EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
# SUPABASE_ANON_KEY=your-anon-key

# 서버 실행
npm start

# 개발 모드 (nodemon)
npm run dev
```

## 환경 변수 설정

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```env
# Supabase 설정 (둘 중 하나 선택)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 또는
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# 서버 포트 (선택사항)
PORT=3001
```

**참고:**

- `SUPABASE_SERVICE_ROLE_KEY`를 사용하면 RLS(Row Level Security)를 우회할 수 있습니다 (권장)
- `SUPABASE_ANON_KEY`를 사용하면 RLS 정책이 적용됩니다

## API 엔드포인트

### 1. 서버 상태 확인

```
GET /api/health
```

### 2. 푸시 알림 발송

```
POST /api/send-push
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "알림 제목",
  "body": "알림 내용",
  "data": {
    "customData": "value"
  }
}
```

### 3. 전체 공지 푸시 알림 발송 (모든 admin에게)

```
POST /api/broadcast-push
Content-Type: application/json

{
  "title": "전체 공지 제목",
  "body": "전체 공지 내용",
  "data": {
    "customData": "value"
  }
}
```

**동작 방식:**

- Supabase의 `zerofall_admin` 테이블에서 모든 `push_token` 조회
- null이 아닌 모든 토큰에 푸시 알림 발송
- Supabase 연결 실패 시 메모리 저장소 사용 (fallback)

### 4. 테스트 푸시 알림 발송

```
POST /api/test-push
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

## 사용 방법

1. 앱에서 푸시 토큰을 받아옵니다
2. 서버에 토큰을 전송합니다
3. 서버에서 푸시 알림을 발송합니다

## 주의사항

- iOS 푸시 알림은 Apple Developer 계정이 필요합니다
- Android 푸시 알림은 Google FCM을 사용합니다
- 실제 배포 시에는 Expo 프로젝트 ID 설정이 필요합니다
- 전체 공지 기능은 Supabase의 `zerofall_admin` 테이블에서 푸시 토큰을 조회합니다
- Supabase 환경 변수가 설정되지 않으면 메모리 저장소를 사용합니다 (fallback)

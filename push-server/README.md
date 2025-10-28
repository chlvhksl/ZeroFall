# ZeroFall 푸시 서버

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 서버 실행
npm start

# 개발 모드 (nodemon)
npm run dev
```

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

### 3. 테스트 푸시 알림 발송

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

# FCM 서비스 계정 키 추가 가이드

## 📋 전체 과정

### 1단계: Firebase 프로젝트 생성/선택

1. **Firebase Console 접속**
   - https://console.firebase.google.com 접속
   - Google 계정으로 로그인

2. **프로젝트 생성 또는 선택**
   - 기존 프로젝트가 있으면 선택
   - 없으면 "프로젝트 추가" 클릭하여 새 프로젝트 생성
   - 프로젝트 이름 입력 (예: "ZeroFall")

### 2단계: Android 앱 등록

1. **프로젝트 대시보드에서 Android 앱 추가**
   - 프로젝트 홈 화면에서 Android 아이콘 클릭
   - 또는 "프로젝트 설정" → "내 앱" → "Android 앱 추가"

2. **앱 정보 입력**
   - **Android 패키지 이름**: `com.zerofall` (app.json의 android.package와 동일)
   - **앱 닉네임**: ZeroFall (선택사항)
   - **디버그 서명 인증서 SHA-1**: 선택사항 (나중에 추가 가능)

3. **앱 등록 완료**
   - "앱 등록" 클릭

### 3단계: 서비스 계정 키 생성

1. **프로젝트 설정 열기**
   - Firebase Console 왼쪽 상단 톱니바퀴 아이콘 클릭
   - "프로젝트 설정" 선택

2. **서비스 계정 탭으로 이동**
   - 상단 메뉴에서 "서비스 계정" 탭 클릭

3. **서비스 계정 키 생성**
   - "Firebase Admin SDK" 섹션 확인
   - "새 비공개 키 생성" 버튼 클릭
   - 경고 메시지 확인 후 "키 생성" 클릭
   - **JSON 파일이 자동으로 다운로드됨** (예: `zerofall-firebase-adminsdk-xxxxx.json`)

### 4단계: Expo 대시보드에 업로드

1. **Expo 대시보드 접속**
   - https://expo.dev 접속
   - 로그인

2. **프로젝트 선택**
   - 프로젝트 목록에서 "ZeroFall" 선택

3. **Credentials 페이지로 이동**
   - 좌측 메뉴에서 "Settings" 클릭
   - "Credentials" 섹션으로 스크롤

4. **Android Credentials 찾기**
   - "com.zerofall" 섹션 확인
   - "Service Credentials" 섹션 찾기

5. **FCM 서비스 계정 키 추가**
   - "Add a Service Account Key" 버튼 클릭
   - 다운로드한 JSON 파일 선택
   - 업로드 완료

## ✅ 확인 방법

1. **Expo 대시보드에서 확인**
   - "Service Credentials" 섹션에 FCM 키가 표시되는지 확인

2. **다음 EAS 빌드에서 확인**
   - FCM 서비스 계정 키가 있으면 EAS 빌드 시 자동으로 FCM 설정됨
   - 빌드 로그에서 FCM 관련 메시지 확인 가능

3. **앱에서 토큰 발급 테스트**
   - EAS 빌드로 앱 설치
   - 로그인 시도
   - 푸시 토큰 발급 성공 여부 확인

## ⚠️ 주의사항

- **JSON 파일 보안**: 다운로드한 JSON 파일은 안전하게 보관하세요
- **서비스 계정 권한**: Firebase Admin SDK 권한이 필요합니다
- **프로젝트 ID 확인**: Firebase 프로젝트 ID와 Expo 프로젝트 ID는 다를 수 있습니다

## 🔗 참고 링크

- Firebase Console: https://console.firebase.google.com
- Expo 대시보드: https://expo.dev
- Expo FCM 문서: https://docs.expo.dev/push-notifications/push-notifications-setup/


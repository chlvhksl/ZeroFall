# iOS 실제 기기에서 실행하기

## 방법 1: Expo Go 앱 사용 (가장 간단, 빠른 테스트) ✅ **무료, 개발자 계정 불필요**

### 전제 조건

- iPhone과 Mac이 같은 Wi-Fi 네트워크에 연결되어 있어야 합니다
- iPhone에 Expo Go 앱 설치 필요 (App Store에서 무료 다운로드)
- **Apple Developer 계정 불필요** ✅

### 실행 방법

1. **iPhone에 Expo Go 앱 설치**

   - App Store에서 "Expo Go" 검색 후 설치

2. **개발 서버 시작**

   ```bash
   npm start
   # 또는
   npx expo start
   ```

3. **iPhone에서 연결**

   - 방법 A: QR 코드 스캔

     - Expo Go 앱을 열고 "Scan QR code" 선택
     - 터미널에 표시된 QR 코드를 스캔

   - 방법 B: 직접 URL 입력
     - 터미널에 표시된 URL을 Expo Go 앱에 직접 입력
     - 예: `exp://192.168.1.100:8081`

4. **개발**
   - 코드를 수정하면 자동으로 리로드됩니다
   - iPhone에서 즉시 변경사항을 확인할 수 있습니다

### 제한사항

- ⚠️ Expo Go는 일부 네이티브 모듈을 지원하지 않을 수 있습니다
- ⚠️ `expo-notifications`의 일부 기능이 제한될 수 있습니다
- ⚠️ 커스텀 네이티브 코드는 실행할 수 없습니다

---

## 방법 2: EAS Build로 Development Build 생성 (권장, 모든 기능 지원)

### 전제 조건

- Expo 계정 필요 (app.json에 이미 projectId 설정됨) - **무료**
- ⚠️ **Apple Developer 계정 필요 ($99/년)** - 실제 iPhone에 설치하려면 필수
- EAS CLI 설치 필요

### 개발자 계정 없이 가능한 경우

- **iOS 시뮬레이터**: 개발자 계정 없이 빌드 가능 (무료)
- **실제 iPhone**: 개발자 계정 필요 ($99/년)

### 설정 방법

1. **EAS CLI 설치**

   ```bash
   npm install -g eas-cli
   ```

2. **Expo 계정 로그인**

   ```bash
   eas login
   ```

3. **expo-dev-client 설치** (Development Build 사용을 위해)

   ```bash
   npx expo install expo-dev-client
   ```

4. **Development Build 생성**

   ```bash
   eas build --profile development --platform ios
   ```

5. **빌드 완료 후**

   - 빌드가 완료되면 이메일 또는 터미널에서 다운로드 링크를 받습니다
   - iPhone에 빌드된 앱 설치
     - 방법 A: TestFlight 사용 (권장)
       ```bash
       eas build --profile development --platform ios --auto-submit
       ```
     - 방법 B: 직접 설치
       - 빌드 완료 후 다운로드 링크에서 .ipa 파일 다운로드
       - Apple Configurator 2 또는 다른 도구를 사용하여 설치

6. **개발 서버 연결**
   ```bash
   npm start
   ```
   - Development Build 앱을 열면 자동으로 개발 서버에 연결됩니다

### 장점

- ✅ 모든 네이티브 기능 지원
- ✅ 커스텀 네이티브 코드 사용 가능
- ✅ 실제 앱과 동일한 환경
- ✅ 푸시 알림 등 모든 기능 정상 작동

---

## 방법 3: 로컬 빌드 (prebuild 필요)

⚠️ **주의**: 이 방법은 로컬에 iOS 폴더를 생성합니다. Expo 클라우드 빌드를 사용하지 않으려는 경우에만 사용하세요.

```bash
# iOS 폴더 생성 (prebuild)
npx expo prebuild --platform ios

# CocoaPods 설치
cd ios
pod install
cd ..

# 실제 기기에서 실행
npx expo run:ios --device
```

---

## 추천 방법

- **빠른 테스트 (무료)**: 방법 1 (Expo Go) - ✅ **개발자 계정 불필요**
- **전체 기능 테스트**: 방법 2 (EAS Build) - ⚠️ **개발자 계정 필요 ($99/년)**
- **로컬 개발**: 방법 3 (prebuild 사용) - ⚠️ **개발자 계정 필요 ($99/년)**

## 비용 요약

| 방법                  | 개발자 계정 | 비용   | 네이티브 기능 |
| --------------------- | ----------- | ------ | ------------- |
| Expo Go               | ❌ 불필요   | 무료   | 일부 제한     |
| EAS Build (Simulator) | ❌ 불필요   | 무료   | 전체 지원     |
| EAS Build (실제 기기) | ✅ 필요     | $99/년 | 전체 지원     |
| 로컬 빌드 (실제 기기) | ✅ 필요     | $99/년 | 전체 지원     |

---

## 문제 해결

### Expo Go에서 연결이 안 될 때

1. iPhone과 Mac이 같은 Wi-Fi에 연결되어 있는지 확인
2. 방화벽 설정 확인
3. 터미널에서 "t" 키를 눌러 터널 모드 활성화
   ```bash
   npx expo start --tunnel
   ```

### Development Build에서 연결이 안 될 때

1. 개발 서버가 실행 중인지 확인
2. iPhone과 Mac이 같은 네트워크에 있는지 확인
3. Development Build 앱이 최신인지 확인

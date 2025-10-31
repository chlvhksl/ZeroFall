# HMR 오류 해결 방법

## 현재 상황
- `http_proxy_server` 오류는 해결됨 (루트에 stub 파일 존재)
- HMR (Hot Module Reload) 오류가 계속 발생

## 해결 방법

### 방법 1: iOS 완전 재빌드 (권장)

```bash
# 1. 모든 캐시 삭제
rm -rf .expo .metro node_modules/.cache ios/build ios/DerivedData

# 2. iOS 빌드 완전 정리
cd ios
xcodebuild clean
rm -rf build DerivedData
cd ..

# 3. Metro 서버 시작
npx expo start --clear

# 4. 새로운 터미널에서 iOS 재빌드
npx expo run:ios
```

### 방법 2: HMR 비활성화 (임시 해결)

앱에서 HMR을 비활성화하고 전체 리로드만 사용:

1. iOS 시뮬레이터/기기에서 앱 실행
2. Metro 터미널에서 `r` 키를 눌러 전체 리로드
3. 또는 앱에서 Reload 버튼 클릭

### 방법 3: 개발 모드 변경

`app.json`에 추가:

```json
{
  "expo": {
    "developer": {
      "tool": "expo-cli"
    }
  }
}
```

## 원인
HMR 오류는 보통 다음 중 하나 때문입니다:
1. iOS 빌드 캐시 문제
2. Metro 서버와 클라이언트 간 통신 문제
3. React Native 버전 호환성 문제

## 참고
- `http_proxy_server` 문제는 해결됨 (루트 stub 파일)
- Metro 설정은 최소화되어 있음
- 문제는 HMR 시스템 자체일 가능성 높음


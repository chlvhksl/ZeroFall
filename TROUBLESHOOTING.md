# 🔧 http_proxy_server 오류 해결 가이드

## 문제 원인

React Native Metro 번들러가 프로젝트의 모든 파일을 스캔하면서 `arduino/http_proxy_server.js` 파일을 발견하고, 이를 React Native 모듈로 해석하려고 시도합니다.

`arduino/http_proxy_server.js`는 Node.js 서버 파일이므로 React Native 번들에 포함되면 안 됩니다.

## 적용된 해결 방법

1. **Metro 설정 강화** (`metro.config.js`)
   - `blockList`에 `arduino` 폴더 및 `http_proxy` 관련 파일 추가
   - `watchFolders`에서 `arduino` 폴더 제외
   - 절대 경로와 상대 경로 모두 블록 처리

2. **.metroignore 파일 생성**
   - Metro가 무시할 파일/폴더 명시

3. **.gitignore 업데이트**
   - `arduino/` 폴더 추가 (선택사항)

4. **arduino/.expo 폴더 삭제**
   - 캐시된 Expo 설정 제거

## 해결 절차

### 1단계: Metro 서버 완전 종료
```bash
# 터미널에서 Ctrl+C로 종료
# 또는
pkill -f "expo start"
pkill -f "metro"
```

### 2단계: 모든 캐시 삭제
```bash
# 방법 1: 스크립트 사용
./metro-reset.sh

# 방법 2: 수동 실행
rm -rf .expo node_modules/.cache .metro tmp arduino/.expo
```

### 3단계: Metro 서버 재시작
```bash
npx expo start --clear
```

### 4단계: 앱에서 Reload
- 앱 화면에서 **"Reload (⌘R)"** 버튼 클릭

## 여전히 오류가 발생하는 경우

### 추가 확인 사항

1. **루트 디렉토리에 http_proxy_server.js 파일이 있는지 확인**
   ```bash
   ls -la | grep http_proxy
   ```

2. **node_modules에 캐시가 남아있는지 확인**
   ```bash
   rm -rf node_modules/.cache
   ```

3. **.expo 폴더가 완전히 삭제되었는지 확인**
   ```bash
   rm -rf .expo .expo-shared
   ```

4. **Metro 프로세스가 완전히 종료되었는지 확인**
   ```bash
   ps aux | grep metro
   ps aux | grep expo
   ```

### 최후의 수단

만약 여전히 문제가 발생한다면:

1. **arduino 폴더를 프로젝트 밖으로 이동**
   ```bash
   mv arduino ~/arduino-zerofall
   # 그리고 프록시 서버 실행 시 경로 변경
   cd ~/arduino-zerofall && npm start
   ```

2. **루트에 빈 http_proxy_server.js 파일 생성** (임시 해결책)
   ```javascript
   // http_proxy_server.js (프로젝트 루트)
   // Metro가 이 파일을 찾을 수 있도록 빈 모듈 export
   module.exports = {};
   ```

3. **Metro 설정에서 sourceExts에서 .js 제외** (비권장 - 다른 .js 파일도 영향받음)

## 확인 방법

설정이 제대로 적용되었는지 확인:

```bash
# Metro가 arduino 폴더를 블록하는지 확인
cat metro.config.js | grep -A 5 blockList

# .metroignore 파일 확인
cat .metroignore
```

## 참고

- `arduino` 폴더는 Node.js 서버 전용이므로 React Native 앱과는 별개입니다
- 프록시 서버는 별도 터미널에서 실행해야 합니다
- `arduino` 폴더의 파일들은 Arduino IDE나 arduino-cli로만 사용합니다


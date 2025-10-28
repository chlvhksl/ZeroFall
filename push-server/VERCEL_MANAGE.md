# Vercel 프로젝트 관리 명령어

## 📋 프로젝트 확인 및 관리

### 1. 현재 프로젝트 확인

```bash
cd push-server
vercel ls
```

### 2. 프로젝트 상세 정보

```bash
vercel inspect
```

### 3. 환경변수 확인

```bash
vercel env ls
```

### 4. 로그 확인

```bash
vercel logs
```

### 5. 프로젝트 설정 확인

```bash
vercel project ls
```

## 🔧 프로젝트 설정

### 프로젝트 이름 변경

```bash
vercel --name new-project-name
```

### 도메인 설정

```bash
vercel domains add your-custom-domain.com
```

### 환경변수 설정

```bash
vercel env add NODE_ENV production
vercel env add EXPO_PROJECT_ID your-project-id
```

## 📱 앱에서 사용할 URL 확인

### 배포 후 URL 확인 방법:

1. `vercel ls` 명령어로 URL 확인
2. Vercel 대시보드에서 프로젝트 클릭
3. Settings → Domains에서 도메인 확인

### 앱 코드에서 URL 업데이트:

```typescript
// lib/notifications.ts에서 실제 URL로 변경
const serverUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://your-actual-vercel-url.vercel.app' // 실제 URL로 교체
    : 'http://localhost:3001';
```

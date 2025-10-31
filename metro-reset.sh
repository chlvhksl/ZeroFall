#!/bin/bash
echo "🧹 Metro 캐시 완전 초기화 중..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf tmp
rm -rf arduino/.expo
echo "✅ 캐시 삭제 완료!"
echo ""
echo "이제 다음 명령어로 시작하세요:"
echo "npx expo start --clear"

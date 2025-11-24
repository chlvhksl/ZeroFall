import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Alert, StatusBar } from 'react-native';
import { initializeI18n } from '../lib/i18n-safe';
import { setupNotificationListeners } from '../lib/notifications';
import { LocalDeviceProvider } from '../src/context/LocalDeviceContext';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [fontError, setFontError] = React.useState<Error | null>(null);
  const [i18nReady, setI18nReady] = React.useState(false);

  // 1단계: 폰트 파일을 읽어서 메모리에 로드합니다.
  // ⭐️ [최종 수정] 경로를 '../assets/fonts/'로 변경합니다. (app 폴더에서 한 단계 위로 이동)
  const [fontsLoaded] = useFonts({
    // 한국어/영어 폰트
    'NanumSquare-Regular': require('../assets/fonts/NanumSquareR.otf'), 
    'NanumSquare-Bold': require('../assets/fonts/NanumSquareB.otf'),
    'NanumSquare-ExtraBold': require('../assets/fonts/NanumSquareEB.otf'),
    // 일본어 폰트
    'NotoSansCJKjp-R': require('../assets/fonts/jp/NotoSansCJKjp-R.otf'),
    'NotoSansCJKjp-B': require('../assets/fonts/jp/NotoSansCJKjp-B.otf'),
    'NotoSansCJKjp-EB': require('../assets/fonts/jp/NotoSansCJKjp-EB.otf'),
  });

  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    // 폰트 로드 중 에러가 발생하면 처리합니다.
    if (fontError) {
        // 이 Alert이 뜨면 파일 경로 또는 이름이 틀렸다는 명확한 증거입니다.
        Alert.alert('폰트 로드 오류', `폰트 파일을 찾을 수 없습니다. ZeroFall/assets/fonts/ 폴더의 파일명(NanumSquareR.otf, NanumSquareB.otf)을 확인해 주세요.\n오류: ${fontError.message}`);
        return; 
    }

    // 순차적 초기화: 폰트 → i18n → 알림
    const initializeApp = async () => {
      try {
        // 1단계: 폰트 로드 완료 대기
        if (!fontsLoaded) {
          return;
        }

        // 2단계: 네이티브 모듈이 준비될 때까지 짧은 지연
        await new Promise(resolve => setTimeout(resolve, 100));

        // 3단계: i18n 초기화
        try {
          await initializeI18n();
          setI18nReady(true);
        } catch (error) {
          console.error('i18n 초기화 실패 (앱은 계속 실행):', error);
          setI18nReady(true); // 에러가 나도 앱은 계속 실행
        }

        // 4단계: 추가 지연 (안정성 확보)
        await new Promise(resolve => setTimeout(resolve, 50));

        // 5단계: 알림 리스너 초기화
        try {
          setupNotificationListeners();
        } catch (error) {
          console.error('알림 리스너 초기화 실패 (앱은 계속 실행):', error);
        }

        // 6단계: 모든 초기화 완료
        SplashScreen.hideAsync();
        setIsReady(true);
      } catch (error) {
        console.error('앱 초기화 중 오류 발생:', error);
        // 에러가 발생해도 앱은 실행되도록
        SplashScreen.hideAsync();
        setIsReady(true);
      }
    };

    initializeApp();
  }, [fontsLoaded, fontError]);

  if (!isReady) {
    return null;
  }

  return (
    <LocalDeviceProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#EDF6EF"
        translucent={false}
        hidden={false}
      />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </LocalDeviceProvider>
  );
}

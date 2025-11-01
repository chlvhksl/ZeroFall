import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { LocalDeviceProvider } from '../src/context/LocalDeviceContext';
import { useFonts } from 'expo-font'; 
import * as SplashScreen from 'expo-splash-screen';
import { Alert } from 'react-native'; 

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [fontError, setFontError] = React.useState<Error | null>(null);

  // 2. 폰트 파일을 읽어서 메모리에 로드합니다.
  // ⭐️ [최종 수정] 경로를 '../assets/fonts/'로 변경합니다. (app 폴더에서 한 단계 위로 이동)
  const [fontsLoaded] = useFonts({
    'NanumSquare-Regular': require('../assets/fonts/NanumSquareR.otf'), 
    'NanumSquare-Bold': require('../assets/fonts/NanumSquareB.otf'),
    'NanumSquare-ExtraBold': require('../assets/fonts/NanumSquareEB.otf'),
  });

  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    // 폰트 로드 중 에러가 발생하면 처리합니다.
    if (fontError) {
        // 이 Alert이 뜨면 파일 경로 또는 이름이 틀렸다는 명확한 증거입니다.
        Alert.alert('폰트 로드 오류', `폰트 파일을 찾을 수 없습니다. ZeroFall/assets/fonts/ 폴더의 파일명(NanumSquareR.otf, NanumSquareB.otf)을 확인해 주세요.\n오류: ${fontError.message}`);
        return; 
    }

    // 폰트 로드가 완료되면 이 코드가 실행됩니다.
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      setIsReady(true);
    }
  }, [fontsLoaded, fontError]);

  if (!isReady) {
    return null;
  }

  return (
    <LocalDeviceProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </LocalDeviceProvider>
  );
}

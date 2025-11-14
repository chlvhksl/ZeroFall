import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { supabase } from '../lib/supabase';

const APP_VERSION_KEY = '@zerofall_app_version';
// 버전 + 빌드 번호를 함께 체크 (빌드할 때마다 변경됨)
const CURRENT_APP_VERSION = `${Constants.expoConfig?.version || '1.0.0'}-${
  Constants.expoConfig?.ios?.buildNumber ||
  Constants.expoConfig?.android?.versionCode ||
  '1'
}`;

export default function Index() {
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      // 앱 버전 확인 - 버전 또는 빌드 번호가 변경되면 세션 초기화
      const savedVersion = await AsyncStorage.getItem(APP_VERSION_KEY);
      if (savedVersion !== CURRENT_APP_VERSION) {
        console.log('앱 버전/빌드 변경 감지 - 세션 초기화', {
          saved: savedVersion,
          current: CURRENT_APP_VERSION,
        });
        await supabase.auth.signOut();
        await AsyncStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
        router.replace('/signin');
        return;
      }

      // 로컬 세션 확인
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // 서버에서 실제 유효한 세션인지 확인
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          console.log('세션이 유효하지 않음 - 로그아웃 처리');
          await supabase.auth.signOut();
          router.replace('/signin');
          return;
        }

        // 세션 만료 확인
        const expiresAt = session.expires_at;
        if (expiresAt && expiresAt * 1000 < Date.now()) {
          console.log('세션 만료 - 로그아웃 처리');
          await supabase.auth.signOut();
          router.replace('/signin');
          return;
        }

        router.replace('/main');
      } else {
        router.replace('/signin');
      }
    } catch (error) {
      console.error('인증 확인 에러:', error);
      // 에러 발생 시 안전하게 로그아웃 처리
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('로그아웃 에러:', signOutError);
      }
      router.replace('/signin');
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 로딩 화면
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

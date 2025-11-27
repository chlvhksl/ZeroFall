import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  getSelectedSite,
  hasSelectedSite,
  validateSiteAccess,
} from '../lib/siteManagement';

const APP_VERSION_KEY = '@zerofall_app_version';
// 버전 + 빌드 번호를 함께 체크 (빌드할 때마다 변경됨)
const CURRENT_APP_VERSION = `${Constants.expoConfig?.version || '1.0.0'}-${
  Constants.expoConfig?.ios?.buildNumber ||
  Constants.expoConfig?.android?.versionCode ||
  '1'
}`;

export default function Index() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);

  const checkAuth = useCallback(async () => {
    // 중복 라우팅 방지
    if (isNavigating) {
      console.log('⚠️ [Index] 이미 라우팅 중 - 중복 호출 방지');
      return;
    }

    setIsNavigating(true);

    try {
      console.log('🔍 [Index] 인증 확인 시작');
      
      // 앱 버전 확인 - 버전 또는 빌드 번호가 변경되면 세션 초기화
      const savedVersion = await AsyncStorage.getItem(APP_VERSION_KEY);

      // 재설치 감지: savedVersion이 null이면 앱이 재설치된 것
      if (savedVersion === null || savedVersion !== CURRENT_APP_VERSION) {
        console.log('📱 [Index] 앱 버전/빌드 변경 또는 재설치 감지 - 세션 초기화', {
          saved: savedVersion,
          current: CURRENT_APP_VERSION,
          isReinstall: savedVersion === null,
        });

        // 기존 세션이 있다면 명시적으로 로그아웃
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.signOut();
        }

        // 버전 정보 저장
        await AsyncStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
        console.log('➡️ [Index] 라우팅: /signin (버전 변경)');
        router.replace('/signin');
        return;
      }

      // 로그인 유지 설정 확인: 기본값은 true (키가 없으면 기존 동작 유지)
      const rememberPref = await AsyncStorage.getItem('@remember_me');
      if (rememberPref === 'false') {
        console.log('🚫 [Index] 로그인 유지 해제됨 - 세션 초기화');
        // 사용자가 '로그인 유지'를 해제한 경우 - 세션을 유지하지 않음
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.signOut();
        }
        console.log('➡️ [Index] 라우팅: /signin (로그인 유지 해제)');
        router.replace('/signin');
        return;
      }

      // 로컬 세션 확인
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        console.log('✅ [Index] 세션 발견 - 유효성 확인 중');
        
        // 서버에서 실제 유효한 세션인지 확인
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          console.log('❌ [Index] 세션이 유효하지 않음 - 로그아웃 처리');
          await supabase.auth.signOut();
          console.log('➡️ [Index] 라우팅: /signin (세션 무효)');
          router.replace('/signin');
          return;
        }

        // 세션 만료 확인
        const expiresAt = session.expires_at;
        if (expiresAt && expiresAt * 1000 < Date.now()) {
          console.log('⏰ [Index] 세션 만료 - 로그아웃 처리');
          await supabase.auth.signOut();
          console.log('➡️ [Index] 라우팅: /signin (세션 만료)');
          router.replace('/signin');
          return;
        }

        // 현장 선택 여부 확인
        const hasSite = await hasSelectedSite();
        
        if (!hasSite) {
          // 현장이 선택되지 않았으면 현장 선택 화면으로 이동
          console.log('⚠️ [Index] 현장이 선택되지 않음 - 현장 선택 화면으로 이동');
          console.log('➡️ [Index] 라우팅: /site-select (현장 없음)');
          router.replace('/site-select');
        } else {
          // 선택한 현장이 있으면 접근 권한 확인
          const selectedSite = await getSelectedSite();
          
          if (selectedSite) {
            const hasAccess = await validateSiteAccess(selectedSite.id);
            
            if (hasAccess) {
              // 접근 권한이 있으면 메인으로 이동
              console.log('✅ [Index] 세션 유효 + 현장 선택됨 + 접근 권한 있음');
              console.log('➡️ [Index] 라우팅: /main');
              router.replace('/main');
            } else {
              // 접근 권한이 없으면 현장 선택 화면으로 이동
              console.log('⚠️ [Index] 현장 접근 권한 없음 - 현장 선택 화면으로 이동');
              console.log('➡️ [Index] 라우팅: /site-select (접근 권한 없음)');
              router.replace('/site-select');
            }
          } else {
            // 선택한 현장 정보가 없으면 현장 선택 화면으로 이동
            console.log('⚠️ [Index] 선택한 현장 정보 없음 - 현장 선택 화면으로 이동');
            console.log('➡️ [Index] 라우팅: /site-select (현장 정보 없음)');
            router.replace('/site-select');
          }
        }
      } else {
        console.log('❌ [Index] 세션 없음 - 로그인 화면으로 이동');
        console.log('➡️ [Index] 라우팅: /signin (세션 없음)');
        router.replace('/signin');
      }
    } catch (error) {
      console.error('❌ [Index] 인증 확인 에러:', error);
      // 에러 발생 시 안전하게 로그아웃 처리
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('❌ [Index] 로그아웃 에러:', signOutError);
      }
      console.log('➡️ [Index] 라우팅: /signin (에러 발생)');
      router.replace('/signin');
    } finally {
      // 라우팅 완료 후 플래그 리셋은 하지 않음
      // 컴포넌트가 언마운트되면 자동으로 리셋됨
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

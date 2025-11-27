import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PushTokenManager } from '../../lib/push-token-manager';
import { supabase } from '../../lib/supabase';
import { hasSelectedSite, getSelectedSite, validateSiteAccess } from '../../lib/siteManagement';
import { useFontByLanguage } from '../../lib/fontUtils-safe';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const fonts = useFontByLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // 언어 변경 감지 - useTranslation의 t 함수가 언어 변경을 자동으로 감지하여 리렌더링합니다

  // 1. 기존 로그인 기능
  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('signin.invalidCredentials'));
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    // ⭐️ [수정된 부분]: 로그인 실패 시 통일된 메시지 출력
    if (error) {
      // Supabase 에러가 발생하면, 구체적인 에러 메시지 대신 일반적인 실패 메시지를 사용자에게 보여줍니다.
      // 이렇게 해야 계정이 존재하는지 유추하는 것을 막아 보안에 유리합니다.
      Alert.alert(
        t('signin.loginFailed'),
        t('signin.invalidEmailOrPassword'),
      );
    } else {
      // 로그인할 때마다 푸시 토큰 확인 및 발급
      // 권한 요청을 먼저 완료한 후 메인 화면으로 이동
      try {
        // 로그인 유지 설정 저장
        try {
          await AsyncStorage.setItem(
            '@remember_me',
            rememberMe ? 'true' : 'false',
          );
        } catch (e) {
          console.log('remember_me 저장 실패:', e);
        }
        console.log('🔍 통합 토큰 관리 시작:', email);

        // 🎯 통합 토큰 매니저 사용 (토큰 발급 + DB 저장 + 로컬 저장 모두 처리)
        const tokenResult = await PushTokenManager.manageTokenComplete(
          data.user.id,
        );

        if (tokenResult.success) {
          console.log(
            `✅ ${tokenResult.message}:`,
            tokenResult.token?.substring(0, 30) + '...',
          );

          if (tokenResult.action === 'updated') {
            Alert.alert(
              t('signin.pushNotificationSuccessTitle'),
              t('signin.pushNotificationSuccessMessage'),
            );
          }
        } else {
          console.error('❌ 토큰 관리 실패:', tokenResult.message);
          Alert.alert(
            t('signin.pushNotificationFailureTitle'),
            `${tokenResult.message}\n\n${t('signin.pushNotificationFailureMessage')}`,
          );
        }

        // 🎉 토큰 관리 완료 - 무조건 현장 선택 화면으로 이동
        console.log('🚀 로그인 완료 - 현장 선택 화면으로 이동');
        console.log('➡️ [SignInScreen] 라우팅: /site-select (무조건 현장 선택)');
        router.replace('/site-select');
      } catch (error) {
        console.error('❌ 로그인 후 처리 실패:', error);
        Alert.alert(
          t('signin.postLoginErrorTitle'),
          t('signin.postLoginErrorMessage'),
        );
      }
    }
  };

  // 비밀번호 찾기 처리
  const handleFindCredential = () => {
    // 비밀번호 찾기 화면으로 이동
    console.log('비밀번호 찾기 버튼 클릭됨');
    router.push('/forgot-password');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* 언어 선택 버튼 - 상단 우측 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => {
              console.log('➡️ [SignInScreen] 라우팅: /language-select (언어 선택)');
              router.push('/language-select');
            }}
          >
            <Ionicons name="language-outline" size={24} color="#5FCCC4" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 로그인 폼 컨테이너 - 중앙 정렬 */}
          <View style={styles.formContainer}>
            {/* 제목 - ⭐️ 굵은 폰트 적용 */}
            <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>{t('signin.title')}</Text>

            {/* 아이디 입력 필드 - ⭐️ 일반 폰트 적용 */}
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: email ? '#5FCCC4' : '#D0D0D0',
                  fontFamily: fonts.regular,
                },
              ]}
              placeholder={t('signin.emailPlaceholder')}
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* 비밀번호 입력 필드 - ⭐️ 일반 폰트 적용 */}
            <View
              style={[
                styles.passwordContainer,
                { borderColor: password ? '#5FCCC4' : '#D0D0D0' },
              ]}
            >
              <TextInput
                style={[
                  styles.passwordInput,
                  { fontFamily: showPassword ? fonts.regular : undefined },
                ]}
                placeholder={t('signin.passwordPlaceholder')}
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
              />
              {/* 비밀번호 보기/숨기기 토글 기능 유지 */}
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={22}
                  color="#5FCCC4"
                />
              </TouchableOpacity>
            </View>

            {/* 로그인 유지 체크박스 */}
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={rememberMe ? 'checkbox-outline' : 'square-outline'}
                size={22}
                color="#5FCCC4"
              />
              <Text style={[styles.rememberText, { fontFamily: fonts.regular }]}>{t('signin.rememberMe')}</Text>
            </TouchableOpacity>

            {/* 로그인 버튼 - ⭐️ 굵은 폰트 적용 */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={[styles.loginButtonText, { fontFamily: fonts.bold }]}>
                {loading ? t('signin.processing') : t('signin.loginButton')}
              </Text>
            </TouchableOpacity>

            {/* 하단 회원가입 및 찾기 링크 */}
            <View style={styles.footer}>
              <View style={styles.signUpLinkContainer}>
                {/* ⭐️ 일반 폰트 적용 */}
                <Text style={[styles.footerText, { fontFamily: fonts.regular }]}>{t('signin.noAccount')}</Text>
                <TouchableOpacity onPress={() => router.push('/signup')}>
                  {/* ⭐️ 굵은 폰트 적용 */}
                  <Text style={[styles.signUpText, { fontFamily: fonts.bold }]}>{t('signin.signUpLink')}</Text>
                </TouchableOpacity>
              </View>

              {/* 비밀번호 찾기 버튼 */}
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={handleFindCredential}
              >
                <Text style={[styles.forgotPasswordText, { fontFamily: fonts.regular }]}>
                  {t('signin.forgotPassword')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  languageButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 40,
    textAlign: 'center',
  },

  // --- 아이디/비밀번호 입력 스타일 ---
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    color: '#000',
    marginBottom: 12,
    width: '100%',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000',
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },

  // --- 로그인 유지 체크박스 ---
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  rememberText: {
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
  },

  // --- 로그인 버튼 스타일 ---
  loginButton: {
    backgroundColor: '#78C4B4',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // --- 하단 링크 및 찾기 버튼 스타일 ---
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  signUpLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  signUpText: {
    color: '#78C4B4',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 5,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  forgotPasswordText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});

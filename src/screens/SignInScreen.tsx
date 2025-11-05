import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { registerForPushNotificationsAsync, sendLocalNotification } from '../../lib/notifications';

// ⭐️ 사용할 폰트 이름 정의 (app/_layout.tsx에서 로드된 이름과 일치해야 함)
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';




export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. 기존 로그인 기능
  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '아이디와 비밀번호를 모두 입력하세요.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    // ⭐️ [수정된 부분]: 로그인 실패 시 통일된 메시지 출력
    if (error) {
      // Supabase 에러가 발생하면, 구체적인 에러 메시지 대신 일반적인 실패 메시지를 사용자에게 보여줍니다.
      // 이렇게 해야 계정이 존재하는지 유추하는 것을 막아 보안에 유리합니다.
      Alert.alert(
          '로그인 실패', 
          '아이디 또는 비밀번호가 잘못 입력되었습니다.' // 사용자 요청 메시지
      );
    } else {
      Alert.alert('로그인 성공', '로그인 되었습니다!');
      router.replace('/main');
      // 푸시 알림 권한 요청
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) {
          console.log('푸시 토큰 발급 완료:', pushToken);
          
          // 데이터베이스에 푸시 토큰 저장
          // Supabase Auth의 user_metadata에 저장하는 것이 일반적이지만, 
          // 여기서는 기존 코드 흐름을 따라 zerofall_admin 테이블에 저장합니다.
          const { error: updateError } = await supabase
            .from('zerofall_admin')
            .update({ push_token: pushToken })
            .eq('admin_mail', email);
          
          if (updateError) {
            console.log('푸시 토큰 저장 실패:', updateError.message);
          } else {
            console.log('푸시 토큰 저장 성공');
          }
          
          // 로그인 성공 알림 발송
          await sendLocalNotification(
            '🎉 로그인 성공!',
            `${email}님, ZeroFall에 오신 것을 환영합니다!`
          );
        }
      } catch (err) {
        console.log('푸시 알림 권한 요청 실패:', err);
      }
      
      // 로그인 성공 후 메인 화면으로 이동 로직
      // router.replace('/'); 
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
        >
          {/* 로그인 폼 컨테이너 - 중앙 정렬 */}
          <View style={styles.formContainer}>
            {/* 제목 - ⭐️ 굵은 폰트 적용 */}
            <Text style={styles.title}>ZeroFall에 로그인</Text>

            {/* 아이디 입력 필드 - ⭐️ 일반 폰트 적용 */}
            <TextInput
              style={[styles.input, { borderColor: email ? '#5FCCC4' : '#D0D0D0', fontFamily: FONT_REGULAR }]}
              placeholder="아이디"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* 비밀번호 입력 필드 - ⭐️ 일반 폰트 적용 */}
            <View style={[styles.passwordContainer, { borderColor: password ? '#5FCCC4' : '#D0D0D0' }]}>
              <TextInput
                style={[styles.passwordInput, { fontFamily: FONT_REGULAR }]}
                placeholder="비밀번호"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
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

            {/* 로그인 버튼 - ⭐️ 굵은 폰트 적용 */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? '처리 중...' : '로그인'}
              </Text>
            </TouchableOpacity>

            {/* 하단 회원가입 및 찾기 링크 */}
            <View style={styles.footer}>
              <View style={styles.signUpLinkContainer}>
                {/* ⭐️ 일반 폰트 적용 */}
                <Text style={styles.footerText}>계정이 없으신가요?</Text>
                <Link href="/signup" asChild>
                  <TouchableOpacity>
                    {/* ⭐️ 굵은 폰트 적용 */}
                    <Text style={styles.signUpText}>회원가입하기</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              
              {/* 비밀번호 찾기 버튼 */}
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={handleFindCredential}
              >
                <Text style={styles.forgotPasswordText}>비밀번호를 잊으셨나요?</Text>
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
    fontFamily: FONT_EXTRABOLD, 
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
    fontFamily: FONT_BOLD, 
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
    fontFamily: FONT_REGULAR, 
  },
  signUpText: {
    color: '#78C4B4',
    fontSize: 14,
    fontWeight: '700', 
    marginLeft: 5,
    fontFamily: FONT_BOLD, 
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
    fontFamily: FONT_REGULAR,
    textDecorationLine: 'underline',
  },
});

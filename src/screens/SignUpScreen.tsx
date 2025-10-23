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

// ⭐️ 사용할 폰트 이름 정의 (app/_layout.tsx에서 로드된 이름과 일치해야 함)
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // 이메일 유효성 검사 함수 (간단한 형식 체크)
  const isValidEmail = (email: string) => {
    // 간단한 이메일 정규식 (더 복잡한 정규식 필요 시 수정 가능)
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  // 1. 회원가입 기능
  const handleSignUp = async () => {
    // 1. 클라이언트 측 유효성 검사
    if (!email || !password || !confirmPassword) {
      Alert.alert('입력 오류', '모든 필드를 입력해야 합니다.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('이메일 형식 오류', '유효한 이메일 주소를 입력해 주세요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('비밀번호 오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (!agreeTerms) {
      Alert.alert('약관 동의', '이용약관 및 개인정보 처리방침에 동의해야 합니다.');
      return;
    }

    // 2. Supabase 회원가입 요청
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    // 3. 결과 처리
    if (error) {
      Alert.alert('회원가입 실패', error.message);
    } else {
      Alert.alert(
        '회원가입 성공',
        '인증 이메일이 발송되었습니다. 이메일을 확인하여 계정을 활성화해 주세요.'
      );
      // 회원가입 성공 후 로그인 페이지로 이동
      router.replace('/signin');
    }
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
          {/* 뒤로가기 버튼 */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          {/* 제목 - ⭐️ 굵은 폰트 적용 */}
          <Text style={styles.title}>ZeroFall 회원가입</Text>

          {/* 이메일 입력 필드 - ⭐️ 일반 폰트 적용 */}
          <Text style={styles.inputLabel}>이메일 주소</Text>
          <TextInput
            style={[
              styles.input,
              { 
                borderColor: isValidEmail(email) && email.length > 0 ? '#78C4B4' : (email.length > 0 && !isValidEmail(email) ? '#FF4A4A' : '#D0D0D0'), 
                fontFamily: FONT_REGULAR 
              }
            ]}
            placeholder="example@email.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {email.length > 0 && !isValidEmail(email) && (
            <Text style={styles.errorMessage}>유효한 이메일 주소를 입력해 주세요.</Text>
          )}

          {/* 비밀번호 입력 필드 - ⭐️ 일반 폰트 적용 */}
          <Text style={styles.inputLabel}>비밀번호 (6자 이상)</Text>
          <View 
            style={[
              styles.passwordContainer, 
              { 
                borderColor: password.length >= 6 ? '#78C4B4' : (password.length > 0 && password.length < 6 ? '#FF4A4A' : '#D0D0D0') 
              }
            ]}
          >
            <TextInput
              style={[styles.passwordInput, { fontFamily: FONT_REGULAR }]}
              placeholder="비밀번호"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            {/* 비밀번호 보기/숨기기 토글 */}
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={22}
                color="#78C4B4"
              />
            </TouchableOpacity>
          </View>
          {password.length > 0 && password.length < 6 && (
            <Text style={styles.errorMessage}>비밀번호는 최소 6자 이상이어야 합니다.</Text>
          )}

          {/* 비밀번호 확인 입력 필드 - ⭐️ 일반 폰트 적용 */}
          <Text style={styles.inputLabel}>비밀번호 확인</Text>
          <View 
            style={[
              styles.passwordContainer, 
              { 
                borderColor: confirmPassword.length > 0 && password === confirmPassword ? '#78C4B4' : (confirmPassword.length > 0 && password !== confirmPassword ? '#FF4A4A' : '#D0D0D0'),
                marginBottom: 10,
              }
            ]}
          >
            <TextInput
              style={[styles.passwordInput, { fontFamily: FONT_REGULAR }]}
              placeholder="비밀번호 확인"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            {/* 비밀번호 보기/숨기기 토글 */}
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye' : 'eye-off'}
                size={22}
                color="#78C4B4"
              />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={styles.errorMessage}>비밀번호가 일치하지 않습니다.</Text>
          )}

          {/* 약관 동의 체크박스 - ⭐️ 일반 폰트 적용 */}
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => setAgreeTerms(!agreeTerms)}
          >
            <Ionicons
              name={agreeTerms ? 'checkbox-outline' : 'square-outline'}
              size={24}
              color={agreeTerms ? '#78C4B4' : '#999'}
            />
            <Text style={styles.checkboxText}>
              이용약관 및 개인정보 처리방침에 동의합니다. (필수)
            </Text>
          </TouchableOpacity>


          {/* 회원가입 버튼 - ⭐️ 굵은 폰트 적용 */}
          <TouchableOpacity
            style={[
              styles.signUpButton, 
              (loading || !agreeTerms || !isValidEmail(email) || password.length < 6 || password !== confirmPassword) && styles.signUpButtonDisabled
            ]}
            onPress={handleSignUp}
            disabled={loading || !agreeTerms || !isValidEmail(email) || password.length < 6 || password !== confirmPassword}
          >
            <Text style={styles.signUpButtonText}>
              {loading ? '처리 중...' : '회원가입'}
            </Text>
          </TouchableOpacity>

          {/* 하단 로그인 링크 - ⭐️ 일반/굵은 폰트 적용 */}
          <View style={styles.footer}>
            <View style={styles.signInLinkContainer}>
              <Text style={styles.footerText}>이미 계정이 있으신가요?</Text>
              <Link href="/signin" asChild>
                <TouchableOpacity>
                  <Text style={styles.signInText}>로그인하기</Text>
                </TouchableOpacity>
              </Link>
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
    backgroundColor: '#F7F7F7',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold', 
    color: '#000',
    marginBottom: 40, // 로그인보다 간격 넓게 설정
    alignSelf: 'flex-start',
    fontFamily: FONT_BOLD, // ⭐️ 제목 폰트
  },
  
  // --- 입력 필드 스타일 ---
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    fontFamily: FONT_REGULAR,
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    color: '#000',
    marginBottom: 10,
    width: '100%',
    // 폰트 적용은 인라인 스타일로 처리
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
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
  errorMessage: {
    alignSelf: 'flex-start',
    color: '#FF4A4A',
    fontSize: 13,
    marginBottom: 15,
    marginTop: -5,
    fontFamily: FONT_REGULAR,
    width: '100%',
  },

  // --- 약관 동의 체크박스 ---
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: '100%',
    paddingVertical: 15,
    marginBottom: 20,
  },
  checkboxText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#555',
    fontFamily: FONT_REGULAR, // ⭐️ 일반 폰트
  },
  
  // --- 회원가입 버튼 스타일 ---
  signUpButton: {
    backgroundColor: '#78C4B4', 
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginTop: 10, // 체크박스와 버튼 사이 간격 조정
    marginBottom: 30,
    shadowOpacity: 0,
    elevation: 0, 
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700', 
    fontFamily: FONT_BOLD, // ⭐️ 굵은 폰트
  },
  
  // --- 하단 로그인 링크 스타일 ---
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  signInLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    fontFamily: FONT_REGULAR, // ⭐️ 일반 폰트
  },
  signInText: {
    color: '#78C4B4',
    fontSize: 14,
    fontWeight: '700', 
    marginLeft: 5,
    fontFamily: FONT_BOLD, // ⭐️ 굵은 폰트
  },
});

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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

// ⭐️ 사용할 폰트 이름 정의
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code' | 'newPassword'>('email');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 1단계: 비밀번호 재설정 이메일 전송
  const handleSendResetEmail = async () => {
    if (!email) {
      Alert.alert('입력 오류', '이메일을 입력해주세요.');
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('입력 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setLoading(true);
    
    // Supabase 비밀번호 재설정 이메일 전송 (OTP 방식)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: undefined, // 딥링크 없이 OTP만 전송
    });

    setLoading(false);

    if (error) {
      Alert.alert(
        '전송 실패', 
        '이메일 전송에 실패했습니다. 가입된 이메일인지 확인해주세요.'
      );
      console.log('비밀번호 재설정 이메일 전송 실패:', error.message);
    } else {
      Alert.alert(
        '전송 완료',
        '인증 코드를 이메일로 전송했습니다.\n이메일을 확인하고 6자리 코드를 입력해주세요.'
      );
      setStep('code');
    }
  };

  // 2단계: 인증 코드 확인 및 비밀번호 변경
  const handleVerifyAndResetPassword = async () => {
    if (!verificationCode || !newPassword || !confirmPassword) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('입력 오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    // Supabase의 verifyOtp와 updateUser를 사용
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: verificationCode,
      type: 'recovery',
    });

    if (verifyError) {
      setLoading(false);
      Alert.alert(
        '인증 실패',
        '인증 코드가 올바르지 않거나 만료되었습니다.'
      );
      console.log('OTP 인증 실패:', verifyError.message);
      return;
    }

    // 인증 성공 후 비밀번호 업데이트
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setLoading(false);
      Alert.alert(
        '변경 실패',
        '비밀번호 변경에 실패했습니다. 다시 시도해주세요.'
      );
      console.log('비밀번호 업데이트 실패:', updateError.message);
      return;
    }

    // zerofall_admin 테이블의 admin_pwd도 함께 업데이트
    const { error: tableUpdateError } = await supabase
      .from('zerofall_admin')
      .update({ admin_pwd: newPassword })
      .eq('admin_mail', email);

    setLoading(false);

    if (tableUpdateError) {
      console.log('zerofall_admin 테이블 업데이트 실패:', tableUpdateError.message);
      // Auth 비밀번호는 변경되었으므로 계속 진행
    }

    Alert.alert(
      '변경 완료',
      '비밀번호가 성공적으로 변경되었습니다.\n새 비밀번호로 로그인해주세요.',
      [
        {
          text: '확인',
          onPress: () => router.replace('/signin'),
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 뒤로가기 버튼 */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (step === 'code') {
                setStep('email');
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>

          {/* 제목 */}
          <Text style={styles.title}>
            {step === 'email' ? '비밀번호 찾기' : '비밀번호 재설정'}
          </Text>
          
          {/* 1단계: 이메일 입력 */}
          {step === 'email' && (
            <>
              {/* 안내 문구 */}
              <Text style={styles.description}>
                가입하신 이메일 주소를 입력하시면{'\n'}
                인증 코드를 보내드립니다.
              </Text>

              {/* 이메일 입력 필드 */}
              <TextInput
                style={[
                  styles.input,
                  { borderColor: email ? '#5FCCC4' : '#D0D0D0' }
                ]}
                placeholder="이메일"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />

              {/* 인증 코드 전송 버튼 */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSendResetEmail}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? '전송 중...' : '인증 코드 전송'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* 2단계: 인증 코드 + 새 비밀번호 입력 */}
          {step === 'code' && (
            <>
              {/* 안내 문구 */}
              <Text style={styles.description}>
                {email}로 전송된{'\n'}
                6자리 인증 코드를 입력하고{'\n'}
                새 비밀번호를 설정해주세요.
              </Text>

              {/* 인증 코드 입력 필드 */}
              <TextInput
                style={[
                  styles.input,
                  { borderColor: verificationCode ? '#5FCCC4' : '#D0D0D0' }
                ]}
                placeholder="인증 코드 (6자리)"
                placeholderTextColor="#999"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              {/* 새 비밀번호 입력 */}
              <View style={[
                styles.passwordContainer,
                { borderColor: newPassword ? '#5FCCC4' : '#D0D0D0' }
              ]}>
                <TextInput
                  style={[styles.passwordInput, { fontFamily: showNewPassword ? FONT_REGULAR : undefined }]}
                  placeholder="새 비밀번호 (6자 이상)"
                  placeholderTextColor="#999"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye' : 'eye-off'}
                    size={22}
                    color="#5FCCC4"
                  />
                </TouchableOpacity>
              </View>

              {/* 비밀번호 확인 입력 */}
              <View style={[
                styles.passwordContainer,
                { borderColor: confirmPassword ? '#5FCCC4' : '#D0D0D0' }
              ]}>
                <TextInput
                  style={[styles.passwordInput, { fontFamily: showConfirmPassword ? FONT_REGULAR : undefined }]}
                  placeholder="비밀번호 확인"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye' : 'eye-off'}
                    size={22}
                    color="#5FCCC4"
                  />
                </TouchableOpacity>
              </View>

              {/* 비밀번호 변경 버튼 */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleVerifyAndResetPassword}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? '변경 중...' : '비밀번호 변경'}
                </Text>
              </TouchableOpacity>

              {/* 인증 코드 재전송 */}
              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => {
                  setStep('email');
                  setVerificationCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.resendButtonText}>인증 코드 다시 받기</Text>
              </TouchableOpacity>
            </>
          )}

          {/* 로그인 화면으로 돌아가기 */}
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToLoginText}>로그인 화면으로 돌아가기</Text>
          </TouchableOpacity>

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
    padding: 24,
    paddingTop: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    padding: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    lineHeight: 24,
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
  submitButton: {
    backgroundColor: '#78C4B4',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  resendButtonText: {
    color: '#999',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  backToLoginButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backToLoginText: {
    color: '#78C4B4',
    fontSize: 14,
    fontWeight: '700',
  },
});

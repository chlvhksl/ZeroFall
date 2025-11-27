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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFontByLanguage } from '../../lib/fontUtils-safe';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fonts = useFontByLanguage();
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
      Alert.alert(t('common.error'), t('forgotPassword.emailRequired'));
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t('common.error'), t('forgotPassword.invalidEmail'));
      return;
    }

    setLoading(true);
    
    // Supabase 비밀번호 재설정 이메일 전송 (OTP 방식)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: undefined, // 딥링크 없이 OTP만 전송
    });

    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), t('forgotPassword.sendError'));
      console.log('비밀번호 재설정 이메일 전송 실패:', error.message);
    } else {
      Alert.alert(t('common.success'), t('forgotPassword.sendSuccess'));
      setStep('code');
    }
  };

  // 2단계: 인증 코드 확인 및 비밀번호 변경
  const handleVerifyAndResetPassword = async () => {
    if (!verificationCode || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('forgotPassword.allFieldsRequired'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('forgotPassword.passwordMismatch'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('forgotPassword.passwordTooShort'));
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
      Alert.alert(t('common.error'), t('forgotPassword.verifyError'));
      console.log('OTP 인증 실패:', verifyError.message);
      return;
    }

    // 인증 성공 후 비밀번호 업데이트
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setLoading(false);
      Alert.alert(t('common.error'), t('forgotPassword.changeError'));
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
      t('common.success'),
      t('forgotPassword.changeSuccess'),
      [
        {
          text: t('common.confirm'),
          onPress: () => {
            console.log('➡️ [ForgotPasswordScreen] 라우팅: /signin (비밀번호 변경 완료)');
            router.replace('/signin');
          },
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
          <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>
            {step === 'email' ? t('forgotPassword.title') : t('forgotPassword.resetPassword')}
          </Text>
          
          {/* 1단계: 이메일 입력 */}
          {step === 'email' && (
            <>
              {/* 안내 문구 */}
              <Text style={[styles.description, { fontFamily: fonts.regular }]}>
                {t('forgotPassword.subtitle')}
              </Text>

              {/* 이메일 입력 필드 */}
              <TextInput
                style={[
                  styles.input,
                  { borderColor: email ? '#5FCCC4' : '#D0D0D0' }
                ]}
                placeholder={t('forgotPassword.email')}
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
                <Text style={[styles.submitButtonText, { fontFamily: fonts.bold }]}>
                  {loading ? t('common.loading') : t('forgotPassword.sendCode')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* 2단계: 인증 코드 + 새 비밀번호 입력 */}
          {step === 'code' && (
            <>
              {/* 안내 문구 */}
              <Text style={[styles.description, { fontFamily: fonts.regular }]}>
                {t('forgotPassword.codeSentMessage', { email })}
              </Text>

              {/* 인증 코드 입력 필드 */}
              <TextInput
                style={[
                  styles.input,
                  { borderColor: verificationCode ? '#5FCCC4' : '#D0D0D0', fontFamily: fonts.regular }
                ]}
                placeholder={t('forgotPassword.codePlaceholder')}
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
                  style={[styles.passwordInput, { fontFamily: showNewPassword ? fonts.regular : undefined }]}
                  placeholder={t('forgotPassword.newPasswordPlaceholder')}
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
                  style={[styles.passwordInput, { fontFamily: showConfirmPassword ? fonts.regular : undefined }]}
                  placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
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
                <Text style={[styles.submitButtonText, { fontFamily: fonts.bold }]}>
                  {loading ? t('common.loading') : t('forgotPassword.changePassword')}
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
                <Text style={[styles.resendButtonText, { fontFamily: fonts.regular }]}>{t('forgotPassword.resendCode')}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* 로그인 화면으로 돌아가기 */}
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToLoginText}>{t('forgotPassword.backToSignIn')}</Text>
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

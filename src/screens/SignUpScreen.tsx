import React, { useState } from 'react';
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
import { useTranslation } from 'react-i18next';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase'; // Supabase 임포트

// 사용할 폰트 이름 정의
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

// ⭐️ 이 파일이 Expo Router에서 '/signup' 경로로 인식됩니다.
export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. 회원가입 기능 (실제 Supabase 연동)
  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('signup.passwordMismatch'));
      return;
    }

    setLoading(true);

    // Supabase 회원가입 요청
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          last_name: lastName,
          first_name: firstName,
          affiliation: affiliation,
        },
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert(t('signup.signUpError'), error.message);
    } else {
      if (data?.user) {
        const { error: adminError } = await supabase
          .from('zerofall_admin')
          .insert({
            admin_id: data.user.id,
            admin_name: lastName + firstName,
            admin_aff: affiliation,
            admin_mail: email,
            push_token: null,
          });
        if (adminError) {
          Alert.alert(t('signup.signUpError'), adminError.message);
        } else {
          Alert.alert(t('common.success'), t('signup.signUpSuccess'));
          console.log('➡️ [SignUpScreen] 라우팅: /signin (회원가입 성공)');
          router.replace('/signin');
        }
      }
      // 회원가입 성공 후에는 replace를 사용하여 로그인 화면으로 이동 (뒤로가기 방지)
      console.log('➡️ [SignUpScreen] 라우팅: /signin (회원가입 완료)');
      router.replace('/signin');
    }
  };

  const goToSignIn = () => {
    console.log('➡️ [SignUpScreen] 라우팅: /signin (로그인 화면으로)');
    router.replace('/signin');
  };

  const isFormValid =
    lastName.length > 0 &&
    firstName.length > 0 &&
    affiliation.length > 0 &&
    email.length > 0 &&
    password.length >= 6 &&
    password === confirmPassword &&
    !loading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 뒤로 가기 버튼 (Header) - SignInScreen에서 push로 넘어왔다면, 여기에 Back 버튼이 자동으로 생깁니다. */}
          {/* 수동 뒤로가기 버튼: Expo Router의 헤더가 숨겨진 경우를 대비 */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{t('signup.title')}</Text>
          <Text style={styles.subtitle}>
            {t('signup.subtitle')}
          </Text>

          {/* 성 */}
          <Text style={styles.inputLabel}>{t('signup.lastName')}</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: lastName.length > 0 ? '#78C4B4' : '#D0D0D0',
                fontFamily: FONT_REGULAR,
              },
            ]}
            placeholder={t('signup.lastName')}
            placeholderTextColor="#999"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          {/* 이름 */}
          <Text style={styles.inputLabel}>{t('signup.firstName')}</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: firstName.length > 0 ? '#78C4B4' : '#D0D0D0',
                fontFamily: FONT_REGULAR,
              },
            ]}
            placeholder={t('signup.firstName')}
            placeholderTextColor="#999"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          {/* 소속 */}
          <Text style={styles.inputLabel}>{t('signup.affiliation')}</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: affiliation.length > 0 ? '#78C4B4' : '#D0D0D0',
                fontFamily: FONT_REGULAR,
              },
            ]}
            placeholder={t('signup.affiliationPlaceholder')}
            placeholderTextColor="#999"
            value={affiliation}
            onChangeText={setAffiliation}
            autoCapitalize="none"
          />

          {/* 이메일 주소 */}
          <Text style={styles.inputLabel}>{t('signup.email')}</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: email.length > 0 ? '#78C4B4' : '#D0D0D0',
                fontFamily: FONT_REGULAR,
              },
            ]}
            placeholder="example@email.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* 비밀번호 */}
          <Text style={styles.inputLabel}>{t('signup.password')} {t('signup.passwordMinLength')}</Text>
          <View
            style={[
              styles.passwordContainer,
              {
                borderColor:
                  password.length >= 6
                    ? '#78C4B4'
                    : password.length > 0 && password.length < 6
                    ? '#FF4A4A'
                    : '#D0D0D0',
              },
            ]}
          >
            <TextInput
              style={[
                styles.passwordInput,
                { fontFamily: showPassword ? FONT_REGULAR : undefined },
              ]}
              placeholder={t('signup.password')}
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
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

          {/* 비밀번호 확인 */}
          <Text style={styles.inputLabel}>{t('signup.confirmPassword')}</Text>
          <View
            style={[
              styles.passwordContainer,
              {
                borderColor:
                  password.length > 0 && password === confirmPassword
                    ? '#78C4B4'
                    : confirmPassword.length > 0 && password !== confirmPassword
                    ? '#FF4A4A'
                    : '#D0D0D0',
              },
            ]}
          >
            <TextInput
              style={[
                styles.passwordInput,
                { fontFamily: showConfirmPassword ? FONT_REGULAR : undefined },
              ]}
              placeholder={t('signup.confirmPassword')}
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
                color="#78C4B4"
              />
            </TouchableOpacity>
          </View>

          {/* 회원가입 버튼 */}
          <TouchableOpacity
            style={[
              styles.signUpButton,
              !isFormValid && styles.signUpButtonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={!isFormValid}
          >
            <Text style={styles.signUpButtonText}>
              {loading ? t('common.loading') : t('signup.signUp')}
            </Text>
          </TouchableOpacity>

          {/* 하단 로그인 링크 */}
          <View style={styles.footer}>
            <View style={styles.signInLinkContainer}>
              <Text style={styles.footerText}>{t('signup.alreadyHaveAccount')}</Text>
              {/* ⭐️ [핵심] 로그인 페이지로 push하여 뒤로가기 버튼이 생기게 함 */}
              <TouchableOpacity onPress={goToSignIn}>
                <Text style={styles.signInText}>{t('signup.signInLink')}</Text>
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
    padding: 24,
    alignItems: 'center',
    paddingTop: 0,
  },
  header: {
    width: '100%',
    marginBottom: 30, // 제목과의 간격
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    alignSelf: 'flex-start',
    fontFamily: FONT_EXTRABOLD,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 30,
    alignSelf: 'flex-start',
    fontFamily: FONT_REGULAR,
  },
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
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    fontSize: 16,
    color: '#000',
    marginBottom: 20,
    width: '100%',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    marginBottom: 20,
    width: '100%',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  signUpButton: {
    backgroundColor: '#78C4B4',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
    shadowOpacity: 0.2,
    elevation: 3,
    marginBottom: 30,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONT_BOLD,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  signInLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    fontFamily: FONT_REGULAR,
    marginRight: 5,
  },
  signInText: {
    color: '#78C4B4',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONT_BOLD,
  },
});

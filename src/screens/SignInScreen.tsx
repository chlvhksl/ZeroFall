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
  Image,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

// ⭐️ 사용할 폰트 이름 정의 (app/_layout.tsx에서 로드된 이름과 일치해야 함)
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';


// 프로젝트의 assets 경로에서 로고 이미지 파일들을 불러옵니다.
// 경로와 파일명은 사용자님의 프로젝트 구조와 일치해야 합니다.
import GoogleLogoImage from '../../assets/google_logo.png'; 
import KakaoTalkLogoImage from '../../assets/kakaotalk_logo.png';
import NaverLogoImage from '../../assets/naver_logo.png';


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

    if (error) {
      Alert.alert('로그인 실패', error.message);
    } else {
      Alert.alert('로그인 성공', '로그인 되었습니다!');
      // 로그인 성공 후 메인 화면으로 이동 로직 추가 (필요시)
      // router.replace('/'); 
    }
  };

  // 2. 소셜 로그인 처리 (기능 추후 지원 Alert)
  const handleSocialSignIn = (platform: string) => {
    Alert.alert('지원 예정 기능', `${platform} 로그인 기능은 추후 지원됩니다.`);
  };
  
  // 3. 아이디/비밀번호 찾기 처리 (기능 추후 지원 Alert)
  const handleFindCredential = (type: 'ID' | 'Password') => {
    Alert.alert('지원 예정 기능', `${type === 'ID' ? '아이디' : '비밀번호'} 찾기 기능은 추후 지원됩니다.`);
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
          {/* ⭐️ [제거됨] 뒤로가기 버튼 제거 */}

          {/* 제목 - ⭐️ 굵은 폰트 적용 (marginTop으로 레이아웃 조정) */}
          <Text style={styles.title}>ZeroFall에 로그인</Text>
          
          {/* 간편 로그인 섹션 구분선 - ⭐️ 일반 폰트 적용 */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>간편로그인</Text>
            <View style={styles.dividerLine} />
          </View>
          
          {/* 소셜 로그인 버튼 그룹 */}
          <View style={styles.socialButtons}>
            
            {/* Apple 버튼 (로고는 Ionicons 사용) */}
            <TouchableOpacity 
              style={[styles.socialButtonBase, styles.appleButton]}
              onPress={() => handleSocialSignIn('Apple')}
            >
              <Ionicons name="logo-apple" size={20} color="#000" />
              {/* ⭐️ 굵은 폰트 적용 */}
              <Text style={[styles.socialButtonTextBase, styles.appleButtonText]}>Apple로 로그인</Text>
            </TouchableOpacity>

            {/* Google 버튼 */}
            <TouchableOpacity 
              style={[styles.socialButtonBase, styles.googleButton]}
              onPress={() => handleSocialSignIn('Google')}
            >
              {/* @ts-ignore */}
              <Image source={GoogleLogoImage} style={styles.socialLogoIcon} />
              {/* ⭐️ 굵은 폰트 적용 */}
              <Text style={[styles.socialButtonTextBase, styles.googleButtonText]}>Google로 로그인</Text>
            </TouchableOpacity>
            
            {/* 카카오톡 버튼 */}
            <TouchableOpacity 
              style={[styles.socialButtonBase, styles.kakaoButton]}
              onPress={() => handleSocialSignIn('카카오톡')}
            >
              {/* @ts-ignore */}
              <Image source={KakaoTalkLogoImage} style={styles.socialLogoIcon} />
              {/* ⭐️ 굵은 폰트 적용 */}
              <Text style={[styles.socialButtonTextBase, styles.kakaoButtonText]}>카카오톡으로 로그인</Text>
            </TouchableOpacity>

            {/* 네이버 버튼 */}
            <TouchableOpacity 
              style={[styles.socialButtonBase, styles.naverButton]}
              onPress={() => handleSocialSignIn('네이버')}
            >
              {/* @ts-ignore */}
              <Image source={NaverLogoImage} style={styles.socialLogoIcon} />
              {/* ⭐️ 굵은 폰트 적용 */}
              <Text style={[styles.socialButtonTextBase, styles.naverButtonText]}>네이버로 로그인</Text>
            </TouchableOpacity>
          </View>

          {/* 아이디 로그인 구분선 - ⭐️ 일반 폰트 적용 */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는 아이디로 로그인</Text>
            <View style={styles.dividerLine} />
          </View>

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
            
            {/* 아이디/비밀번호 찾기 버튼 - ⭐️ 일반 폰트 적용 */}
            <View style={styles.findButtonsContainer}>
              <TouchableOpacity 
                style={styles.findButton}
                onPress={() => handleFindCredential('ID')}
              >
                <Text style={styles.findButtonText}>아이디 찾기</Text>
              </TouchableOpacity>
              <View style={styles.findDivider} /> 
              <TouchableOpacity 
                style={styles.findButton}
                onPress={() => handleFindCredential('Password')}
              >
                <Text style={styles.findButtonText}>비밀번호 찾기</Text>
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
    backgroundColor: '#F7F7F7',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
    // ⭐️ [수정] 뒤로가기 버튼 제거로 인한 상단 패딩 조정
    paddingTop: 30, 
  },
  // ⭐️ [제거됨] backButton 스타일 제거
  
  title: {
    fontSize: 32,
    fontWeight: 'bold', 
    color: '#000',
    marginBottom: 30,
    alignSelf: 'flex-start',
    fontFamily: FONT_BOLD, 
  },

  // --- 구분선 스타일 ---
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 14,
    color: '#757575',
    fontFamily: FONT_REGULAR, 
  },
  
  // --- 소셜 로그인 버튼 스타일 ---
  socialButtons: {
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  
  socialLogoIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },

  socialButtonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    width: '100%',
  },
  socialButtonTextBase: {
    fontSize: 16,
    fontWeight: '500', 
    flex: 1,
    textAlign: 'center',
    marginLeft: -20, 
    fontFamily: FONT_BOLD, 
  },

  // Apple 버튼
  appleButton: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
  },
  appleButtonText: {
    color: '#000',
  },
  
  // Google 버튼
  googleButton: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
  },
  googleButtonText: {
    color: '#000',
  },

  // 카카오톡 버튼
  kakaoButton: {
    backgroundColor: '#FEE500',
    borderColor: '#FEE500',
  },
  kakaoButtonText: {
    color: '#000',
  },
  
  // 네이버 버튼
  naverButton: {
    backgroundColor: '#03C75A',
    borderColor: '#03C75A',
  },
  naverButtonText: {
    color: '#fff',
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
    marginBottom: 10,
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
  
  // 아이디/비밀번호 찾기 버튼 컨테이너
  findButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  findButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  findButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '400', 
    fontFamily: FONT_REGULAR, 
  },
  // 버튼 사이 구분선
  findDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E0E0E0',
    marginHorizontal: 15,
    alignSelf: 'center',
  }
});

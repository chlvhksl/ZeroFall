/**
 * 현장 추가 화면
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { createSite } from '../../lib/siteManagement';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

export default function AddSiteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [companyName, setCompanyName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleCreateSite = async () => {
    if (!companyName.trim()) {
      Alert.alert('입력 오류', '기업명을 입력해주세요.');
      return;
    }

    if (!siteName.trim()) {
      Alert.alert('입력 오류', '현장명을 입력해주세요.');
      return;
    }

    if (companyName.trim().length < 1) {
      Alert.alert('입력 오류', '기업명은 최소 1자 이상이어야 합니다.');
      return;
    }

    if (siteName.trim().length < 1) {
      Alert.alert('입력 오류', '현장명은 최소 1자 이상이어야 합니다.');
      return;
    }

    if (!password.trim()) {
      Alert.alert('입력 오류', '비밀번호를 입력해주세요.');
      return;
    }

    if (password.trim().length < 4) {
      Alert.alert('입력 오류', '비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const newSite = await createSite(
        companyName.trim(),
        siteName.trim(),
        password.trim(),
        description.trim() || undefined,
      );
      
      Alert.alert(
        '현장 추가 완료',
        `"${newSite.name}" 현장이 추가되었습니다.\n이제 이 현장의 관리자 권한을 갖게 됩니다.`,
        [
          {
            text: '확인',
            onPress: () => {
              // 현장 선택 화면으로 돌아가고 목록 새로고침
              router.replace('/site-select');
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('❌ [AddSiteScreen] 현장 추가 실패:', error);
      Alert.alert('오류', error.message || '현장 추가 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>현장 추가</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 안내 문구 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 새로운 현장을 추가하면 자동으로 해당 현장의 관리자 권한을 받게 됩니다.
          </Text>
        </View>

        {/* 기업명 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>기업명 *</Text>
          <TextInput
            style={styles.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="예: 현대, 효성 등"
            placeholderTextColor="#999"
            maxLength={30}
            autoFocus
          />
          <Text style={styles.helperText}>
            {companyName.length}/30자
          </Text>
        </View>

        {/* 현장명 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>현장명 *</Text>
          <TextInput
            style={styles.input}
            value={siteName}
            onChangeText={setSiteName}
            placeholder="예: 평택, 북경남 등"
            placeholderTextColor="#999"
            maxLength={30}
          />
          <Text style={styles.helperText}>
            {siteName.length}/30자
          </Text>
        </View>

        {/* 비밀번호 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>비밀번호 *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="현장 접근 비밀번호 (최소 4자)"
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
              maxLength={50}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color="#666"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            {password.length}/50자 (최소 4자)
          </Text>
        </View>

        {/* 비밀번호 확인 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>비밀번호 확인 *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="비밀번호를 다시 입력하세요"
              placeholderTextColor="#999"
              secureTextEntry={!showConfirmPassword}
              maxLength={50}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color="#666"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 현장 설명 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>현장 설명 (선택사항)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="현장에 대한 설명을 입력하세요"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>
            {description.length}/200자
          </Text>
        </View>

        {/* 추가 버튼 */}
        <TouchableOpacity
          style={[
            styles.createButton,
            (!companyName.trim() || !siteName.trim() || !password.trim() || !confirmPassword.trim() || loading) && styles.createButtonDisabled,
          ]}
          onPress={handleCreateSite}
          disabled={!companyName.trim() || !siteName.trim() || !password.trim() || !confirmPassword.trim() || loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? '추가 중...' : '현장 추가'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_EXTRABOLD,
  },
  placeholder: {
    width: 40,
  },
  infoBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontFamily: FONT_REGULAR,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
    fontSize: 16,
    color: '#000',
    fontFamily: FONT_REGULAR,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#000',
    fontFamily: FONT_REGULAR,
  },
  eyeButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    fontFamily: FONT_REGULAR,
    marginTop: 4,
    textAlign: 'right',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#CCC',
    borderColor: '#999',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    fontFamily: FONT_BOLD,
  },
});


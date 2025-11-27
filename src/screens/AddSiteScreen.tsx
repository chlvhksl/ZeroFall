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
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { createSite } from '../../lib/siteManagement';

import { useFontByLanguage } from '../../lib/fontUtils-safe';

export default function AddSiteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fonts = useFontByLanguage();
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
      Alert.alert(t('common.error'), t('addSite.companyNameRequired'));
      return;
    }

    if (!siteName.trim()) {
      Alert.alert(t('common.error'), t('addSite.siteNameRequired'));
      return;
    }

    if (companyName.trim().length < 1) {
      Alert.alert(t('common.error'), t('addSite.companyNameMinLength'));
      return;
    }

    if (siteName.trim().length < 1) {
      Alert.alert(t('common.error'), t('addSite.siteNameMinLength'));
      return;
    }

    if (!password.trim()) {
      Alert.alert(t('common.error'), t('addSite.passwordRequired'));
      return;
    }

    if (password.trim().length < 4) {
      Alert.alert(t('common.error'), t('addSite.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('addSite.passwordMismatch'));
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
      
      // 현장 이름 확인 (디버깅용)
      console.log('✅ [AddSiteScreen] 현장 생성 완료:', newSite);
      const siteDisplayName = newSite?.name || `${companyName.trim()}-${siteName.trim()}`;
      console.log('📝 [AddSiteScreen] 표시할 현장 이름:', siteDisplayName);
      
      Alert.alert(
        t('addSite.createSuccess'),
        t('addSite.createSuccessMessage', { name: siteDisplayName }),
        [
          {
            text: t('common.confirm'),
            onPress: () => {
              // 현장 선택 화면으로 돌아가고 목록 새로고침
              console.log('➡️ [AddSiteScreen] 라우팅: /site-select (현장 추가 완료)');
              router.replace('/site-select');
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('❌ [AddSiteScreen] 현장 추가 실패:', error);
      Alert.alert(t('common.error'), error.message || t('addSite.createError'));
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
          <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>{t('addSite.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 안내 문구 */}
        <View style={styles.infoBox}>
          <Text style={[styles.infoText, { fontFamily: fonts.regular }]}>
            {t('addSite.infoText')}
          </Text>
        </View>

        {/* 기업명 입력 */}
        <View style={styles.inputSection}>
          <Text style={[styles.label, { fontFamily: fonts.bold }]}>{t('addSite.companyName')} *</Text>
          <TextInput
            style={[styles.input, { fontFamily: fonts.regular }]}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder={t('addSite.companyNamePlaceholder')}
            placeholderTextColor="#999"
            maxLength={30}
            autoFocus
          />
          <Text style={[styles.helperText, { fontFamily: fonts.regular }]}>
            {t('addSite.characterCounter', { current: companyName.length, max: 30 })}
          </Text>
        </View>

        {/* 현장명 입력 */}
        <View style={styles.inputSection}>
          <Text style={[styles.label, { fontFamily: fonts.bold }]}>{t('addSite.siteName')} *</Text>
          <TextInput
            style={[styles.input, { fontFamily: fonts.regular }]}
            value={siteName}
            onChangeText={setSiteName}
            placeholder={t('addSite.siteNamePlaceholder')}
            placeholderTextColor="#999"
            maxLength={30}
          />
          <Text style={[styles.helperText, { fontFamily: fonts.regular }]}>
            {t('addSite.characterCounter', { current: siteName.length, max: 30 })}
          </Text>
        </View>

        {/* 비밀번호 입력 */}
        <View style={styles.inputSection}>
          <Text style={[styles.label, { fontFamily: fonts.bold }]}>{t('addSite.password')} *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { fontFamily: showPassword ? fonts.regular : undefined }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('addSite.passwordPlaceholder')}
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
          <Text style={[styles.helperText, { fontFamily: fonts.regular }]}>
            {t('addSite.passwordCharacterCounter', { current: password.length, max: 50, min: 4 })}
          </Text>
        </View>

        {/* 비밀번호 확인 입력 */}
        <View style={styles.inputSection}>
          <Text style={[styles.label, { fontFamily: fonts.bold }]}>{t('addSite.confirmPassword')} *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.passwordInput, { fontFamily: showConfirmPassword ? fonts.regular : undefined }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('addSite.confirmPasswordPlaceholder')}
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
          <Text style={[styles.label, { fontFamily: fonts.bold }]}>{t('addSite.description')} {t('addSite.optional')}</Text>
          <TextInput
            style={[styles.input, styles.textArea, { fontFamily: fonts.regular }]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('addSite.descriptionPlaceholder')}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={[styles.helperText, { fontFamily: fonts.regular }]}>
            {t('addSite.characterCounter', { current: description.length, max: 200 })}
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
          <Text style={[styles.createButtonText, { fontFamily: fonts.bold }]}>
            {loading ? t('common.loading') : t('addSite.create')}
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
        lineHeight: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
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
      },
});


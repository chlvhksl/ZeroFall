/**
 * 비밀번호 변경 화면
 *
 * 기능:
 * - 현재 비밀번호 확인
 * - 새 비밀번호 입력
 * - 비밀번호 확인
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

import { useFontByLanguage } from '../../lib/fontUtils-safe';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fonts = useFontByLanguage();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    // 입력 검증
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('changePassword.allFieldsRequired'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('changePassword.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('changePassword.passwordMismatch'));
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(t('common.error'), t('changePassword.samePassword'));
      return;
    }

    setLoading(true);

    try {
      // 현재 비밀번호 확인을 위해 재로그인 시도
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        Alert.alert(t('common.error'), t('changePassword.loginInfoNotFound'));
        setLoading(false);
        return;
      }

      // 현재 비밀번호로 재로그인 시도
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        Alert.alert(t('common.error'), t('changePassword.currentPasswordIncorrect'));
        setLoading(false);
        return;
      }

      // 비밀번호 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // zerofall_admin 테이블의 admin_pwd도 함께 업데이트
      const { error: tableUpdateError } = await supabase
        .from('zerofall_admin')
        .update({ admin_pwd: newPassword })
        .eq('admin_id', user.id);

      if (tableUpdateError) {
        console.log('zerofall_admin 테이블 업데이트 실패:', tableUpdateError);
        // Auth 비밀번호는 변경되었으므로 계속 진행
      }

      Alert.alert(t('common.success'), t('changePassword.changeSuccess'), [
        {
          text: t('common.confirm'),
          onPress: () => {
            // 입력 필드 초기화
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error('비밀번호 변경 실패:', error);
      Alert.alert(t('common.error'), t('changePassword.changeError'));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6 &&
    newPassword === confirmPassword;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>{t('changePassword.title')}</Text>
            <View style={styles.placeholder} />
          </View>

          {/* 현재 비밀번호 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('changePassword.currentPassword')}</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor:
                      currentPassword.length > 0 ? '#78C4B4' : '#D0D0D0',
                    fontFamily: showCurrentPassword ? fonts.regular : undefined,
                  },
                ]}
                placeholder={t('changePassword.currentPasswordPlaceholder')}
                placeholderTextColor="#999"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Ionicons
                  name={showCurrentPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 새 비밀번호 */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontFamily: fonts.regular }]}>{t('changePassword.newPassword')}</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: newPassword.length > 0 ? '#78C4B4' : '#D0D0D0',
                    fontFamily: showNewPassword ? fonts.regular : undefined,
                  },
                ]}
                placeholder={t('changePassword.newPasswordPlaceholder')}
                placeholderTextColor="#999"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 비밀번호 확인 */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontFamily: fonts.regular }]}>{t('changePassword.confirmPassword')}</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor:
                      confirmPassword.length > 0 ? '#78C4B4' : '#D0D0D0',
                    fontFamily: showConfirmPassword ? fonts.regular : undefined,
                  },
                ]}
                placeholder={t('changePassword.confirmPasswordPlaceholder')}
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 &&
              newPassword !== confirmPassword && (
                <Text style={styles.errorText}>
                  {t('changePassword.passwordMismatch')}
                </Text>
              )}
          </View>

          {/* 변경 버튼 */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isFormValid || loading) && styles.submitButtonDisabled,
            ]}
            onPress={handleChangePassword}
            disabled={!isFormValid || loading}
          >
            <Text
              style={[
                styles.submitButtonText,
                { fontFamily: fonts.bold },
                (!isFormValid || loading) && styles.submitButtonTextDisabled,
              ]}
            >
              {loading ? t('common.changing') : t('changePassword.change')}
            </Text>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
      },
  placeholder: {
    width: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#000',
        marginBottom: 8,
  },
  passwordContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 50,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
        marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#78C4B4',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#D0D0D0',
    borderColor: '#999',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
      },
  submitButtonTextDisabled: {
    color: '#666',
  },
});



/**
 * 개인정보 수정 화면
 *
 * 기능:
 * - 이름 (성, 이름) 수정
 * - 소속 수정
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

import { useFontByLanguage } from '../../lib/fontUtils-safe';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fonts = useFontByLanguage();
  const insets = useSafeAreaInsets();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.user_metadata) {
        const { last_name, first_name, affiliation: aff } = user.user_metadata;
        setLastName(last_name || '');
        setFirstName(first_name || '');
        setAffiliation(aff || '');
      }
    } catch (error) {
      console.error('프로필 로드 실패:', error);
      Alert.alert(t('common.error'), t('editProfile.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // 입력 검증
    if (!lastName.trim() || !firstName.trim()) {
      Alert.alert(t('common.error'), t('editProfile.nameRequired'));
      return;
    }

    if (!affiliation.trim()) {
      Alert.alert(t('common.error'), t('editProfile.affiliationRequired'));
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(t('common.error'), t('editProfile.loginRequired'));
        setSaving(false);
        return;
      }

      // Auth user_metadata 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          affiliation: affiliation.trim(),
        },
      });

      if (updateError) {
        throw updateError;
      }

      // zerofall_admin 테이블 업데이트
      const fullName = `${lastName.trim()}${firstName.trim()}`;
      const { error: adminError } = await supabase
        .from('zerofall_admin')
        .update({
          admin_name: fullName,
          admin_aff: affiliation.trim(),
        })
        .eq('admin_id', user.id);

      if (adminError) {
        console.error('zerofall_admin 업데이트 실패:', adminError);
        // Auth는 업데이트되었으므로 계속 진행
      }

      Alert.alert(t('common.success'), t('editProfile.saveSuccess'), [
        {
          text: t('common.confirm'),
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error('프로필 저장 실패:', error);
      Alert.alert(t('common.error'), t('editProfile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const isFormValid =
    lastName.trim().length > 0 &&
    firstName.trim().length > 0 &&
    affiliation.trim().length > 0;

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
            <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>{t('editProfile.title')}</Text>
            <View style={styles.placeholder} />
          </View>

          {/* 성 */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontFamily: fonts.regular }]}>{t('editProfile.lastName')}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: lastName.length > 0 ? '#78C4B4' : '#D0D0D0',
                  fontFamily: fonts.regular,
                },
              ]}
              placeholder={t('editProfile.lastNamePlaceholder')}
              placeholderTextColor="#999"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="none"
            />
          </View>

          {/* 이름 */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontFamily: fonts.regular }]}>{t('editProfile.firstName')}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: firstName.length > 0 ? '#78C4B4' : '#D0D0D0',
                  fontFamily: fonts.regular,
                },
              ]}
              placeholder={t('editProfile.firstNamePlaceholder')}
              placeholderTextColor="#999"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="none"
            />
          </View>

          {/* 소속 */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { fontFamily: fonts.regular }]}>{t('editProfile.affiliation')}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: affiliation.length > 0 ? '#78C4B4' : '#D0D0D0',
                  fontFamily: fonts.regular,
                },
              ]}
              placeholder={t('editProfile.affiliationPlaceholder')}
              placeholderTextColor="#999"
              value={affiliation}
              onChangeText={setAffiliation}
              autoCapitalize="none"
            />
          </View>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isFormValid || saving) && styles.submitButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!isFormValid || saving}
          >
            <Text
              style={[
                styles.submitButtonText,
                (!isFormValid || saving) && styles.submitButtonTextDisabled,
              ]}
            >
              {saving ? t('common.loading') : t('editProfile.save')}
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
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
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





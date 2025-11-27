/**
 * 환경설정 화면
 *
 * 기능:
 * - 계정 정보 (이름, 소속, 이메일, 비밀번호 변경)
 * - 데이터 관리 (알림 내역 삭제, 캐시 삭제, 현장 변경)
 * - 앱 정보 (버전, 빌드 번호)
 * - 보안 및 개인정보 (계정 삭제)
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useFontByLanguage } from '../../lib/fontUtils-safe';
import { getCurrentLanguage } from '../../lib/i18n-safe';
import { supabase } from '../../lib/supabase';

interface AccountInfo {
  name: string;
  affiliation: string;
  email: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const fonts = useFontByLanguage();
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    name: '',
    affiliation: '',
    email: '',
  });
  const [currentLanguage, setCurrentLanguage] = useState<string>(getCurrentLanguage());

  // 화면 포커스 시 계정 정보 다시 로드
  useFocusEffect(
    useCallback(() => {
      fetchAccountInfo();
      setCurrentLanguage(getCurrentLanguage());
    }, []),
  );

  // 언어 변경 감지
  React.useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const fetchAccountInfo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { last_name, first_name, affiliation } = user.user_metadata || {};
        const fullName = `${last_name || ''}${first_name || ''}`.trim();

        setAccountInfo({
          name: fullName || t('settings.name'),
          affiliation: affiliation || t('settings.affiliation'),
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('계정 정보 조회 실패:', error);
    }
  };

  const handleChangePassword = () => {
    console.log('➡️ [SettingsScreen] 라우팅: /change-password');
    router.push('/change-password');
  };

  const handleEditProfile = () => {
    console.log('➡️ [SettingsScreen] 라우팅: /edit-profile');
    router.push('/edit-profile');
  };

  const handleDeleteNotificationHistory = () => {
    Alert.alert(
      t('settings.deleteNotificationHistory'),
      t('settings.deleteNotificationConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              if (user) {
                const { error } = await supabase
                  .from('notification_history')
                  .delete()
                  .eq('admin_id', user.id);

                if (error) {
                  Alert.alert(t('common.error'), t('settings.deleteNotificationError'));
                } else {
                  Alert.alert(t('common.success'), t('settings.deleteNotificationSuccess'));
                }
              }
            } catch (error) {
              console.error('알림 내역 삭제 실패:', error);
              Alert.alert(t('common.error'), t('settings.deleteNotificationError'));
            }
          },
        },
      ],
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      t('settings.clearCache'),
      t('settings.clearCacheConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              // AsyncStorage에서 캐시 관련 키 삭제
              await AsyncStorage.multiRemove([
                '@push_token',
                '@push_token_timestamp',
                '@selected_site_id',
                '@verified_sites',
              ]);

              Alert.alert(t('common.success'), t('settings.clearCacheSuccess'));
            } catch (error) {
              console.error('캐시 삭제 실패:', error);
              Alert.alert(t('common.error'), t('settings.clearCacheError'));
            }
          },
        },
      ],
    );
  };

  const handleChangeSite = () => {
    console.log('➡️ [SettingsScreen] 라우팅: /site-select (현장 변경)');
    router.push('/site-select');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              if (!user) {
                Alert.alert(t('common.error'), t('settings.deleteAccountError'));
                return;
              }

              // Edge Function 호출하여 계정 삭제
              console.log('🔄 [SettingsScreen] 계정 삭제 Edge Function 호출 중...');
              
              const { data: result, error: functionError } = await supabase.functions.invoke(
                'delete-account',
                {
                  method: 'POST',
                  body: {},
                }
              );

              if (functionError) {
                console.error('❌ [SettingsScreen] 계정 삭제 실패:', functionError);
                Alert.alert(
                  t('common.error'),
                  functionError.message || t('settings.deleteAccountError')
                );
                return;
              }

              if (!result || !result.success) {
                console.error('❌ [SettingsScreen] 계정 삭제 실패:', result);
                Alert.alert(
                  t('common.error'),
                  result?.message || t('settings.deleteAccountError')
                );
                return;
              }

              console.log('✅ [SettingsScreen] 계정 삭제 성공:', result);

              // 계정 삭제 성공 - 로그아웃 처리
              await supabase.auth.signOut();

              Alert.alert(
                t('common.success'),
                t('settings.deleteAccountSuccess'),
                [
                  {
                    text: t('common.confirm'),
                    onPress: () => {
                      console.log('➡️ [SettingsScreen] 라우팅: /signin (계정 삭제 완료)');
                      router.replace('/signin');
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('계정 삭제 실패:', error);
              Alert.alert(t('common.error'), t('settings.deleteAccountError'));
            }
          },
        },
      ],
    );
  };

  const renderSection = (
    title: string,
    children: React.ReactNode,
  ) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>{title}</Text>
      {children}
    </View>
  );

  const renderItem = (
    label: string,
    value?: string,
    onPress?: () => void,
    showArrow: boolean = true,
  ) => (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, { fontFamily: fonts.regular }]}>{label}</Text>
        {value && <Text style={[styles.itemValue, { fontFamily: fonts.regular }]}>{value}</Text>}
      </View>
      {onPress && showArrow && (
        <Ionicons name="chevron-forward" size={20} color="#999" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top - 36},
        ]}>
        <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>{t('settings.title')}</Text>

        {/* 계정 정보 */}
        {renderSection(
          t('settings.accountInfo'),
          <>
            <TouchableOpacity
              style={styles.item}
              onPress={handleEditProfile}
              activeOpacity={0.7}>
              <View style={styles.itemContent}>
                <Text style={[styles.itemLabel, { fontFamily: fonts.regular }]}>{t('settings.name')}</Text>
                <Text style={[styles.itemValue, { fontFamily: fonts.regular }]}>{accountInfo.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.item}
              onPress={handleEditProfile}
              activeOpacity={0.7}>
              <View style={styles.itemContent}>
                <Text style={[styles.itemLabel, { fontFamily: fonts.regular }]}>{t('settings.affiliation')}</Text>
                <Text style={[styles.itemValue, { fontFamily: fonts.regular }]}>{accountInfo.affiliation}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            {renderItem(t('settings.email'), accountInfo.email, undefined, false)}
            {renderItem(t('settings.changePassword'), undefined, handleChangePassword)}
          </>,
        )}

        {/* 데이터 관리 */}
        {renderSection(
          t('settings.dataManagement'),
          <>
            {renderItem(
              t('settings.deleteNotificationHistory'),
              undefined,
              handleDeleteNotificationHistory,
            )}
            {renderItem(t('settings.clearCache'), undefined, handleClearCache)}
            {renderItem(t('settings.changeSite'), undefined, handleChangeSite)}
          </>,
        )}

            {/* 앱 정보 */}
            {renderSection(
              t('settings.appInfo'),
              <>
                {renderItem(
                  t('settings.language'),
                  currentLanguage === 'ko' ? '한국어' 
                    : currentLanguage === 'en' ? 'English' 
                    : currentLanguage === 'jp' ? '日本語'
                    : currentLanguage === 'zh-CN' ? '简体中文'
                    : currentLanguage === 'zh-TW' ? '繁體中文'
                    : currentLanguage === 'es' ? 'Español'
                    : currentLanguage === 'fr' ? 'Français'
                    : currentLanguage === 'de' ? 'Deutsch'
                    : currentLanguage === 'it' ? 'Italiano'
                    : currentLanguage === 'pt' ? 'Português'
                    : currentLanguage === 'ru' ? 'Русский'
                    : '한국어',
                  () => {
                    console.log('➡️ [SettingsScreen] 라우팅: /language-select (언어 변경)');
                    router.push('/language-select');
                  },
                )}
                {renderItem(t('settings.appUsageGuide'), undefined, () => {
                  console.log('➡️ [SettingsScreen] 라우팅: /guide (앱 사용 가이드)');
                  router.push('/guide');
                })}
            {renderItem(
              t('settings.appVersion'),
              Constants.expoConfig?.version || '1.0.0',
              undefined,
              false,
            )}
            {renderItem(
              t('settings.buildNumber'),
              Platform.OS === 'android'
                ? String(Constants.expoConfig?.android?.versionCode || 5)
                : String(Constants.expoConfig?.ios?.buildNumber || '1'),
              undefined,
              false,
            )}
          </>,
        )}

            {/* 보안 및 개인정보 */}
            {renderSection(
              t('settings.security'),
              <>
                {renderItem(t('settings.deleteAccount'), undefined, handleDeleteAccount)}
              </>,
            )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 14,
    color: '#999',
  },
  bottomSpacer: {
    height: 4,
  },
});


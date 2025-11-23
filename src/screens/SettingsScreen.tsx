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
import { supabase } from '../../lib/supabase';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

interface AccountInfo {
  name: string;
  affiliation: string;
  email: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    name: '',
    affiliation: '',
    email: '',
  });

  // 화면 포커스 시 계정 정보 다시 로드
  useFocusEffect(
    useCallback(() => {
      fetchAccountInfo();
    }, []),
  );

  const fetchAccountInfo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { last_name, first_name, affiliation } = user.user_metadata || {};
        const fullName = `${last_name || ''}${first_name || ''}`.trim();

        setAccountInfo({
          name: fullName || '이름 없음',
          affiliation: affiliation || '소속 없음',
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('계정 정보 조회 실패:', error);
    }
  };

  const handleChangePassword = () => {
    router.push('/change-password');
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handleDeleteNotificationHistory = () => {
    Alert.alert(
      '알림 내역 삭제',
      '모든 알림 내역을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
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
                  Alert.alert('오류', '알림 내역 삭제에 실패했습니다.');
                } else {
                  Alert.alert('완료', '알림 내역이 삭제되었습니다.');
                }
              }
            } catch (error) {
              console.error('알림 내역 삭제 실패:', error);
              Alert.alert('오류', '알림 내역 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      '캐시 삭제',
      '캐시 데이터를 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
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

              Alert.alert('완료', '캐시 데이터가 삭제되었습니다.');
            } catch (error) {
              console.error('캐시 삭제 실패:', error);
              Alert.alert('오류', '캐시 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  const handleChangeSite = () => {
    router.push('/site-select');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '정말 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              if (user) {
                // zerofall_admin 테이블에서 삭제
                await supabase
                  .from('zerofall_admin')
                  .delete()
                  .eq('admin_id', user.id);

                // 일반 사용자는 admin API를 사용할 수 없으므로
                // 로그아웃만 처리하고 실제 삭제는 관리자에게 요청
                const { error: signOutError } = await supabase.auth.signOut();
                if (signOutError) {
                  Alert.alert(
                    '오류',
                    '계정 삭제에 실패했습니다. 고객센터에 문의해주세요.',
                  );
                } else {
                  Alert.alert(
                    '알림',
                    '계정 삭제를 완료하려면 고객센터에 문의해주세요.',
                  );
                  router.replace('/signin');
                }
              }
            } catch (error) {
              console.error('계정 삭제 실패:', error);
              Alert.alert('오류', '계정 삭제에 실패했습니다.');
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
      <Text style={styles.sectionTitle}>{title}</Text>
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
        <Text style={styles.itemLabel}>{label}</Text>
        {value && <Text style={styles.itemValue}>{value}</Text>}
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
        <Text style={styles.title}>환경설정</Text>

        {/* 계정 정보 */}
        {renderSection(
          '계정 정보',
          <>
            <TouchableOpacity
              style={styles.item}
              onPress={handleEditProfile}
              activeOpacity={0.7}>
              <View style={styles.itemContent}>
                <Text style={styles.itemLabel}>이름</Text>
                <Text style={styles.itemValue}>{accountInfo.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.item}
              onPress={handleEditProfile}
              activeOpacity={0.7}>
              <View style={styles.itemContent}>
                <Text style={styles.itemLabel}>소속</Text>
                <Text style={styles.itemValue}>{accountInfo.affiliation}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            {renderItem('이메일', accountInfo.email, undefined, false)}
            {renderItem('비밀번호 변경', undefined, handleChangePassword)}
          </>,
        )}

        {/* 데이터 관리 */}
        {renderSection(
          '데이터 관리',
          <>
            {renderItem(
              '알림 내역 전체 삭제',
              undefined,
              handleDeleteNotificationHistory,
            )}
            {renderItem('캐시 데이터 삭제', undefined, handleClearCache)}
            {renderItem('현장 변경', undefined, handleChangeSite)}
          </>,
        )}

        {/* 앱 정보 */}
        {renderSection(
          '앱 정보',
          <>
            {renderItem(
              '앱 버전',
              Constants.expoConfig?.version || '1.0.0',
              undefined,
              false,
            )}
            {renderItem(
              '빌드 번호',
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
          '보안 및 개인정보',
          <>
            {renderItem('계정 삭제', undefined, handleDeleteAccount)}
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
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: FONT_EXTRABOLD,
    color: '#333',
    marginBottom: 32,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONT_BOLD,
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
    fontFamily: FONT_REGULAR,
    color: '#333',
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 14,
    fontFamily: FONT_REGULAR,
    color: '#999',
  },
  bottomSpacer: {
    height: 4,
  },
});


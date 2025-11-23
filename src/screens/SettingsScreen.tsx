/**
 * 환경설정 화면
 *
 * 기능:
 * - 계정 정보 표시 (이름, 소속, 이메일)
 * - 비밀번호 변경
 * - 데이터 관리 (알림 내역 삭제, 캐시 삭제)
 * - 앱 정보 (버전, 빌드 번호, 이용약관, 개인정보처리방침, 문의하기)
 * - 보안 및 개인정보 (계정 삭제)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getSelectedSite } from '../../lib/siteManagement';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

type AccountInfo = {
  name: string;
  affiliation: string;
  email: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    name: '',
    affiliation: '',
    email: '',
  });
  const [currentSite, setCurrentSite] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  // 화면이 포커스될 때마다 정보 다시 불러오기
  useFocusEffect(
    useCallback(() => {
      fetchAccountInfo();
      loadCurrentSite();
    }, []),
  );

  // 현재 선택한 현장 로드
  const loadCurrentSite = async () => {
    try {
      const site = await getSelectedSite();
      if (site) {
        setCurrentSite(site.name);
      } else {
        setCurrentSite(null);
      }
    } catch (error) {
      console.error('현재 현장 로드 실패:', error);
    }
  };

  const fetchAccountInfo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { last_name, first_name, affiliation } = user.user_metadata || {};
        const fullName = `${last_name || ''}${first_name || ''}`.trim() || '관리자';

        setAccountInfo({
          name: fullName,
          affiliation: affiliation || '소속',
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('계정 정보 가져오기 에러:', error);
      Alert.alert('오류', '계정 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 개인정보 수정 화면으로 이동
  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  // 비밀번호 변경 화면으로 이동
  const handleChangePassword = () => {
    router.push('/change-password');
  };

  // 현장 변경 화면으로 이동
  const handleChangeSite = () => {
    router.push('/site-select');
  };

  // 알림 내역 전체 삭제
  const handleDeleteNotificationHistory = () => {
    Alert.alert(
      '알림 내역 삭제',
      '모든 알림 내역을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
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
              if (!user) {
                Alert.alert('오류', '로그인이 필요합니다.');
                return;
              }

              const { error } = await supabase
                .from('notification_history')
                .delete()
                .neq('id', 0); // 모든 행 삭제

              if (error) {
                throw error;
              }

              Alert.alert('완료', '알림 내역이 모두 삭제되었습니다.');
            } catch (error: any) {
              console.error('알림 내역 삭제 실패:', error);
              Alert.alert('오류', '알림 내역 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  // 캐시 데이터 삭제
  const handleClearCache = () => {
    Alert.alert(
      '캐시 데이터 삭제',
      '모든 캐시 데이터를 삭제하시겠습니까?\n앱을 다시 시작해야 할 수 있습니다.',
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
              // 모든 AsyncStorage 키 가져오기
              const allKeys = await AsyncStorage.getAllKeys();
              
              // 앱 버전 키는 제외 (세션 유지)
              const keysToDelete = allKeys.filter(
                key => key !== '@zerofall_app_version'
              );

              await AsyncStorage.multiRemove(keysToDelete);

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


  // 계정 삭제
  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            // 2차 확인
            Alert.alert(
              '⚠️ 최종 확인',
              '정말로 계정을 삭제하시겠습니까?\n\n모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.',
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
                      if (!user) {
                        Alert.alert('오류', '로그인이 필요합니다.');
                        return;
                      }

                      // zerofall_admin 테이블에서 삭제
                      const { error: adminError } = await supabase
                        .from('zerofall_admin')
                        .delete()
                        .eq('admin_id', user.id);

                      if (adminError) {
                        console.error('zerofall_admin 삭제 실패:', adminError);
                      }

                      // Auth 계정 삭제 (Supabase Admin API 필요하므로 사용자에게 안내)
                      const email = 'support@zerofall.com';
                      const subject = 'ZeroFall 계정 삭제 요청';
                      const body = '';

                      Alert.alert(
                        '계정 삭제 요청',
                        '계정 삭제를 완료하려면 관리자에게 문의해주세요.\n\nsupport@zerofall.com',
                        [
                          {
                            text: '취소',
                            style: 'cancel',
                          },
                          {
                            text: '이메일 보내기',
                            onPress: () => {
                              Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => {
                                Alert.alert('오류', '이메일 앱을 열 수 없습니다.');
                              });
                            },
                          },
                        ],
                      );
                    } catch (error: any) {
                      console.error('계정 삭제 실패:', error);
                      Alert.alert('오류', '계정 삭제 중 오류가 발생했습니다.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  // 앱 버전 정보
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode ||
    '1';

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#78C4B4" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: 8 }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 1. 계정 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정 정보</Text>
        <View style={styles.infoCard}>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={handleEditProfile}
            activeOpacity={0.7}
          >
            <Text style={styles.infoLabel}>이름</Text>
            <View style={styles.infoValueContainer}>
              <Text style={styles.infoValue}>{accountInfo.name}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.infoRow}
            onPress={handleEditProfile}
            activeOpacity={0.7}
          >
            <Text style={styles.infoLabel}>소속</Text>
            <View style={styles.infoValueContainer}>
              <Text style={styles.infoValue}>{accountInfo.affiliation}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이메일</Text>
            <Text style={styles.infoValue}>{accountInfo.email}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleChangePassword}
        >
          <Text style={styles.actionButtonText}>비밀번호 변경</Text>
          <Ionicons name="chevron-forward" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* 2. 데이터 관리 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>데이터 관리</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleChangeSite}
        >
          <View style={styles.actionButtonContent}>
            <View>
              <Text style={styles.actionButtonText}>현장 변경</Text>
              {currentSite && (
                <Text style={styles.actionButtonSubtext}>
                  현재: {currentSite}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#000" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleDeleteNotificationHistory}
        >
          <Text style={styles.actionButtonText}>알림 내역 전체 삭제</Text>
          <Ionicons name="chevron-forward" size={20} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleClearCache}
        >
          <Text style={styles.actionButtonText}>캐시 데이터 삭제</Text>
          <Ionicons name="chevron-forward" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* 3. 앱 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>앱 버전</Text>
            <Text style={styles.infoValue}>{appVersion}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>빌드 번호</Text>
            <Text style={styles.infoValue}>{buildNumber}</Text>
          </View>
        </View>
      </View>

      {/* 4. 보안 및 개인정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>보안 및 개인정보</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleDeleteAccount}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>
            계정 삭제
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDF6EF',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_EXTRABOLD,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontFamily: FONT_REGULAR,
  },
  infoValue: {
    fontSize: 16,
    color: '#000',
    fontFamily: FONT_BOLD,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#D0D0D0',
    marginVertical: 4,
  },
  actionButton: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 8,
  },
  actionButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#000',
    fontFamily: FONT_BOLD,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: '#666',
    fontFamily: FONT_REGULAR,
    marginTop: 4,
  },
  dangerButton: {
    borderColor: '#ef4444',
  },
  dangerText: {
    color: '#ef4444',
  },
});


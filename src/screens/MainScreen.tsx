import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getSelectedSite } from '../../lib/siteManagement';
import HookMonitorLocal from './HookMonitorLocal';
import NotificationHistoryScreen from './NotificationHistoryScreen';
import SettingsScreen from './SettingsScreen';

// 이미지 import
import DashboardImage from '../../assets/dashboard.png';
import LogoutImage from '../../assets/logout.png';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

// 탭 타입 정의
type TabType = 'dashboard' | 'notification' | 'settings';

export default function MainScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [adminInfo, setAdminInfo] = useState({ affiliation: '', name: '' });
  const [currentSite, setCurrentSite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 관리자 정보 및 현재 현장 가져오기
  useEffect(() => {
    fetchAdminInfo();
    loadCurrentSite();
  }, []);

  // 화면 포커스 시 현재 현장 즉시 로드 (환경설정에서 현장 변경 시 즉시 반영)
  useFocusEffect(
    useCallback(() => {
      loadCurrentSite();
    }, [])
  );

  // 주기적으로 현재 현장 확인 (1분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      loadCurrentSite();
    }, 60000); // 60초 = 1분

    return () => clearInterval(interval);
  }, []);

  const fetchAdminInfo = async () => {
    try {
      // 현재 로그인된 사용자 정보 가져오기
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.user_metadata) {
        // Auth의 user_metadata에서 회원가입 시 저장한 정보 가져오기
        const { affiliation, last_name, first_name } = user.user_metadata;

        // 이름 조합: "성이름" 형태로
        const fullName =
          `${last_name || ''}${first_name || ''}`.trim() || '관리자';

        setAdminInfo({
          affiliation: affiliation || '소속',
          name: fullName,
        });
      }
    } catch (error) {
      console.error('관리자 정보 가져오기 에러:', error);
      Alert.alert('오류', '관리자 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

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

  // 로그아웃 처리
  const handleLogout = () => {
    Alert.alert(t('main.logout'), t('main.logoutConfirm'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert(t('common.error'), t('main.logoutError'));
            } else {
              console.log('➡️ [MainScreen] 라우팅: /signin (로그아웃)');
              router.replace('/signin');
            }
          } catch (error) {
            console.error('로그아웃 에러:', error);
            Alert.alert(t('common.error'), t('main.logoutError'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#78C4B4" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        {/* 로그아웃 버튼 */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Image source={LogoutImage} style={styles.logoutIcon} />
        </TouchableOpacity>
      </View>

      {/* 타이틀 및 관리자 정보 */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>ZeroFall</Text>
        <View style={styles.infoContainer}>
          {currentSite && (
            <TouchableOpacity
              style={styles.siteBadge}
              onPress={() => {
                console.log('➡️ [MainScreen] 라우팅: /site-select (현장 선택 버튼)');
                router.push('/site-select');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.siteBadgeText}>{t('main.site')}: {currentSite}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.adminInfo}>
            {adminInfo.affiliation}-{adminInfo.name}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />

      {/* 메인 컨텐츠 영역 */}
      <View style={styles.content}>
        {activeTab === 'dashboard' ? (
          <HookMonitorLocal />
        ) : activeTab === 'notification' ? (
          <NotificationHistoryScreen />
        ) : activeTab === 'settings' ? (
          <SettingsScreen />
        ) : null}
      </View>

      {/* 하단 탭 네비게이션 */}
      <View
        style={[
          styles.bottomTabContainer,
          { paddingBottom: insets.bottom + 10 },
        ]}
      >
        {/* 대시보드 탭 */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('dashboard')}
        >
          {activeTab === 'dashboard' && (
            <View style={styles.activeTabBackground} />
          )}
          <Image source={DashboardImage} style={styles.tabIcon} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'dashboard' && styles.activeTabText,
            ]}
          >
            {t('main.dashboard')}
          </Text>
        </TouchableOpacity>

        {/* 구분선 */}
        <View style={styles.tabDivider} />

        {/* 알림 내역 탭 */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('notification')}
        >
          {activeTab === 'notification' && (
            <View style={styles.activeTabBackground} />
          )}
          <Text style={styles.tabIconText}>🔔</Text>
          <Text
            style={[
              styles.tabText,
              activeTab === 'notification' && styles.activeTabText,
            ]}
          >
            {t('main.notificationHistory')}
          </Text>
        </TouchableOpacity>

        {/* 구분선 */}
        <View style={styles.tabDivider} />

        {/* 환경설정 탭 */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('settings')}
        >
          {activeTab === 'settings' && (
            <View style={styles.activeTabBackground} />
          )}
          <Text style={styles.tabIconText}>⚙️</Text>
          <Text
            style={[
              styles.tabText,
              activeTab === 'settings' && styles.activeTabText,
            ]}
          >
            {t('main.settings')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// (작업자 현황 화면은 제거되었습니다)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF', // 연한 민트색 배경
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDF6EF',
  },

  // 헤더 스타일
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logoutButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },

  // 타이틀 영역
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_EXTRABOLD,
  },
  infoContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  siteBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  siteBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
    fontFamily: FONT_BOLD,
  },
  adminInfo: {
    fontSize: 24,
    color: '#000',
    fontFamily: FONT_REGULAR,
  },
  divider: {
    height: 1,
    backgroundColor: '#000',
    marginHorizontal: 20,
  },

  // 메인 컨텐츠 영역
  content: {
    flex: 1,
    backgroundColor: '#FFF',
    marginHorizontal: 15,
    marginVertical: 15,
    borderWidth: 2,
    borderColor: '#000',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
    marginBottom: 10,
  },
  contentSubText: {
    fontSize: 14,
    color: '#666',
    fontFamily: FONT_REGULAR,
    textAlign: 'center',
    marginTop: 20,
  },
  buttonContainer: {
    marginTop: 30,
    gap: 15,
  },
  testButton: {
    backgroundColor: '#78C4B4',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
  },

  // 하단 탭 네비게이션
  bottomTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#D8D8C8', // 연한 올리브 배경
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingTop: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  activeTabBackground: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 8,
    right: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  tabIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
    marginBottom: 5,
    zIndex: 1,
  },
  tabIconText: {
    fontSize: 24,
    marginBottom: 5,
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    color: '#000',
    fontFamily: FONT_REGULAR,
    zIndex: 1,
  },
  activeTabText: {
    fontFamily: FONT_BOLD,
  },
  tabDivider: {
    width: 2,
    backgroundColor: '#000',
    marginVertical: 10,
  },
});

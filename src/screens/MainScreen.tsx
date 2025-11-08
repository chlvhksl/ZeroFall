import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  registerForPushNotificationsAsync,
  registerTokenToServer,
  requestBroadcastPush,
  requestTestPush,
  sendLocalNotification,
  testNotificationInSimulator,
} from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import HookMonitorLocal from './HookMonitorLocal';
import NotificationHistoryScreen from './NotificationHistoryScreen';

// 이미지 import
import DashboardImage from '../../assets/dashboard.png';
import LogoutImage from '../../assets/logout.png';
import RemotePushTestScreen from './RemotePushTestScreen';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

// 탭 타입 정의
type TabType = 'dashboard' | 'notification' | 'remote-push';

export default function MainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [adminInfo, setAdminInfo] = useState({ affiliation: '', name: '' });
  const [loading, setLoading] = useState(true);

  // 관리자 정보 가져오기
  useEffect(() => {
    fetchAdminInfo();
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

  // 로그아웃 처리
  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃을 하시겠습니까?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '네',
        onPress: async () => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('오류', '로그아웃 중 오류가 발생했습니다.');
            } else {
              router.replace('/signin');
            }
          } catch (error) {
            console.error('로그아웃 에러:', error);
            Alert.alert('오류', '로그아웃 중 오류가 발생했습니다.');
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
        <Text style={styles.adminInfo}>
          {adminInfo.affiliation}-{adminInfo.name}
        </Text>
      </View>
      <View style={styles.divider} />

      {/* 메인 컨텐츠 영역 */}
      <View style={styles.content}>
        {activeTab === 'dashboard' ? (
          <HookMonitorLocal />
        ) : activeTab === 'notification' ? (
          <NotificationHistoryScreen />
        ) : activeTab === 'remote-push' ? (
          <RemotePushTestScreen />
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
            대시보드
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
            알림 내역
          </Text>
        </TouchableOpacity>

        {/* 구분선 */}
        <View style={styles.tabDivider} />
                
        {/* 원격푸시테스트 탭 */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('remote-push')}
        >
          {activeTab === 'remote-push' && (
            <View style={styles.activeTabBackground} />
          )}
          <Text style={styles.tabIconText}>📣</Text>
          <Text
            style={[
              styles.tabText,
              activeTab === 'remote-push' && styles.activeTabText,
            ]}
          >
            원격 푸시
          </Text>
        </TouchableOpacity>        
      </View>
    </View>
  );
}

// 대시보드 컨텐츠 컴포넌트
function DashboardContent() {
  const handleNotificationTest = async () => {
    try {
      // 푸시 알림 권한 요청 및 토큰 발급
      const token = await registerForPushNotificationsAsync();
      console.log('푸시 토큰:', token);

      // 시뮬레이터에서는 로컬 알림 테스트
      await testNotificationInSimulator();

      Alert.alert('알림 테스트', '알림 테스트가 완료되었습니다!');
    } catch (error) {
      console.error('알림 테스트 에러:', error);
      Alert.alert('오류', '알림 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleLocalNotification = async () => {
    try {
      await sendLocalNotification(
        '로컬 알림 테스트',
        '이것은 로컬 알림입니다!',
      );
      Alert.alert('성공', '로컬 알림이 발송되었습니다!');
    } catch (error) {
      console.error('로컬 알림 에러:', error);
      Alert.alert('오류', '로컬 알림 발송 중 오류가 발생했습니다.');
    }
  };

  const handleServerTest = async () => {
    try {
      // 푸시 토큰 가져오기
      const token = await registerForPushNotificationsAsync();

      if (!token) {
        Alert.alert('오류', '푸시 토큰을 가져올 수 없습니다.');
        return;
      }

      // 서버에 토큰 등록
      const result = await registerTokenToServer(token);

      if (result?.success) {
        Alert.alert(
          '성공',
          `서버에 토큰이 등록되었습니다!\n총 등록된 토큰: ${result.totalTokens}개`,
        );
      } else {
        Alert.alert('오류', '서버 통신에 실패했습니다.');
      }
    } catch (error) {
      console.error('서버 테스트 에러:', error);
      Alert.alert('오류', '서버 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleBroadcastPush = async () => {
    try {
      const result = await requestBroadcastPush(
        '📢 전체 공지',
        '모든 사용자에게 전송되는 테스트 푸시 알림입니다!',
      );

      if (result?.success) {
        Alert.alert(
          '성공',
          `전체 푸시 발송 완료!\n총 ${result.totalTokens}명에게 발송\n성공: ${result.successCount}개\n실패: ${result.failCount}개`,
        );
      } else {
        Alert.alert(
          '오류',
          result?.message || '전체 푸시 발송에 실패했습니다.',
        );
      }
    } catch (error) {
      console.error('전체 푸시 에러:', error);
      Alert.alert('오류', '전체 푸시 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleServerPush = async () => {
    try {
      // 푸시 토큰 가져오기
      const token = await registerForPushNotificationsAsync();

      if (!token) {
        Alert.alert('오류', '푸시 토큰을 가져올 수 없습니다.');
        return;
      }

      // 서버에서 테스트 푸시 요청
      const result = await requestTestPush(token);

      if (result?.success) {
        Alert.alert('성공', '서버에서 푸시 알림을 발송했습니다!');
      } else {
        Alert.alert('오류', '서버 푸시 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('서버 푸시 에러:', error);
      Alert.alert('오류', '서버 푸시 테스트 중 오류가 발생했습니다.');
    }
  };

  return (
    <View style={styles.contentContainer}>
      <Text style={styles.contentText}>대시보드 화면</Text>

      {/* 알림 테스트 버튼들 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleNotificationTest}
        >
          <Text style={styles.buttonText}>📱 푸시 알림 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testButton}
          onPress={handleLocalNotification}
        >
          <Text style={styles.buttonText}>🔔 로컬 알림 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={handleServerTest}>
          <Text style={styles.buttonText}>🌐 토큰 등록</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={handleServerPush}>
          <Text style={styles.buttonText}>📡 개별 푸시</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testButton}
          onPress={handleBroadcastPush}
        >
          <Text style={styles.buttonText}>📢 전체 푸시</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.contentSubText}>
        시뮬레이터에서는 로컬 알림만 작동합니다{'\n'}
        서버 테스트는 실제 기기에서 가능합니다{'\n'}
        여러 기기에서 토큰 등록 후 전체 푸시 테스트 가능
      </Text>
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

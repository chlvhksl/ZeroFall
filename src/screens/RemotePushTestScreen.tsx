import {
  Alert,
  ScrollView,
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

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

export default function RemotePushTestScreen() {
  const insets = useSafeAreaInsets();

  // 푸시 알림 테스트 핸들러
  const handleNotificationTest = async () => {
    try {
      const tokenResult = await registerForPushNotificationsAsync();
      console.log('푸시 토큰 결과:', tokenResult);

      if (!tokenResult.success) {
        Alert.alert(
          '푸시 토큰 발급 실패',
          tokenResult.errorMessage || '푸시 알림 토큰 발급에 실패했습니다.',
        );
        return;
      }

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
      const tokenResult = await registerForPushNotificationsAsync();
      if (!tokenResult.success || !tokenResult.token) {
        Alert.alert(
          '푸시 토큰 발급 실패',
          tokenResult.errorMessage || '푸시 토큰을 가져올 수 없습니다.',
        );
        return;
      }
      const result = await registerTokenToServer(tokenResult.token);
      if (result?.success) {
        Alert.alert(
          '성공',
          `서버에 토큰이 등록되었습니다!`,
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
      const tokenResult = await registerForPushNotificationsAsync();
      if (!tokenResult.success || !tokenResult.token) {
        Alert.alert(
          '푸시 토큰 발급 실패',
          tokenResult.errorMessage || '푸시 토큰을 가져올 수 없습니다.',
        );
        return;
      }
      const result = await requestTestPush(tokenResult.token);
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
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 푸시 알림 테스트 섹션 */}
      <View style={styles.notificationSection}>
        <Text style={styles.sectionTitle}>🔔 푸시 알림 테스트</Text>
        <View style={styles.notificationButtonRow}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleNotificationTest}
          >
            <Text style={styles.notificationButtonText}>📱 푸시 테스트</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleLocalNotification}
          >
            <Text style={styles.notificationButtonText}>🔔 로컬 알림</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notificationButtonRow}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleServerTest}
          >
            <Text style={styles.notificationButtonText}>🌐 토큰 등록</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleServerPush}
          >
            <Text style={styles.notificationButtonText}>📡 서버 푸시</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.notificationButton, styles.fullWidthButton]}
          onPress={handleBroadcastPush}
        >
          <Text style={styles.notificationButtonText}>📢 전체 푸시</Text>
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
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_EXTRABOLD,
    marginBottom: 12,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: FONT_BOLD,
  },
  currentStatusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#000',
  },
  statusIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: FONT_EXTRABOLD,
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  sensorItem: {
    alignItems: 'center',
  },
  sensorLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: FONT_REGULAR,
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontFamily: FONT_REGULAR,
  },
  buttonSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockedButton: {
    backgroundColor: '#fee2e2',
  },
  singleButton: {
    backgroundColor: '#fef3c7',
  },
  doubleButton: {
    backgroundColor: '#d1fae5',
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
  },
  loader: {
    marginTop: 8,
  },
  notificationSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 20,
  },
  notificationButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  notificationButton: {
    flex: 1,
    backgroundColor: '#78C4B4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    opacity: 1,
  },
  fullWidthButton: {
    flex: 1,
  },
  notificationButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
  },
});

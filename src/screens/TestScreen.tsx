/**
 * Arduino 테스트 화면
 * 
 * 기능:
 * - 수동으로 상태 변경 (미체결, 단일체결, 이중체결)
 * - Supabase에 직접 데이터 삽입
 * - 실시간 데이터 확인
 * - 연결 상태 확인
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
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

interface HookStatus {
  id: string;
  device_id: string;
  left_sensor: boolean;
  right_sensor: boolean;
  status: '미체결' | '단일체결' | '이중체결';
  timestamp: string;
}

export default function TestScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [latestStatus, setLatestStatus] = useState<HookStatus | null>(null);

  useEffect(() => {
    // 최신 데이터 로드
    loadLatestStatus();

    // Realtime 구독
    const channel = supabase
      .channel('test_hook_status')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hook_status',
        },
        (payload) => {
          console.log('🔔 새 데이터 수신:', payload);
          const newStatus = payload.new as HookStatus;
          setLatestStatus(newStatus);
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadLatestStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('hook_status')
        .select('*')
        .eq('device_id', 'DEVICE_001')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setLatestStatus(data);
      }
    } catch (error) {
      console.error('최신 상태 로드 실패:', error);
    }
  };


  const sendTestStatus = async (
    leftSensor: boolean,
    rightSensor: boolean,
    status: '미체결' | '단일체결' | '이중체결'
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hook_status')
        .insert({
          device_id: 'DEVICE_001',
          left_sensor: leftSensor,
          right_sensor: rightSensor,
          status: status,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      Alert.alert('✅ 성공', `${status} 상태가 Supabase에 저장되었습니다!`);
      setLatestStatus(data);
    } catch (error: any) {
      console.error('상태 전송 실패:', error);
      Alert.alert('❌ 오류', error.message || '상태 전송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlocked = () => {
    sendTestStatus(false, false, '미체결');
  };

  const handleSingleLocked = () => {
    sendTestStatus(true, false, '단일체결');
  };

  const handleDoubleLocked = () => {
    sendTestStatus(true, true, '이중체결');
  };

  // 푸시 알림 테스트 핸들러
  const handleNotificationTest = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      console.log('푸시 토큰:', token);
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
        '이것은 로컬 알림입니다!'
      );
      Alert.alert('성공', '로컬 알림이 발송되었습니다!');
    } catch (error) {
      console.error('로컬 알림 에러:', error);
      Alert.alert('오류', '로컬 알림 발송 중 오류가 발생했습니다.');
    }
  };

  const handleServerTest = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        Alert.alert('오류', '푸시 토큰을 가져올 수 없습니다.');
        return;
      }
      const result = await registerTokenToServer(token);
      if (result?.success) {
        Alert.alert(
          '성공',
          `서버에 토큰이 등록되었습니다!\n총 등록된 토큰: ${result.totalTokens}개`
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
        '모든 사용자에게 전송되는 테스트 푸시 알림입니다!'
      );
      if (result?.success) {
        Alert.alert(
          '성공',
          `전체 푸시 발송 완료!\n총 ${result.totalTokens}명에게 발송\n성공: ${result.successCount}개\n실패: ${result.failCount}개`
        );
      } else {
        Alert.alert(
          '오류',
          result?.message || '전체 푸시 발송에 실패했습니다.'
        );
      }
    } catch (error) {
      console.error('전체 푸시 에러:', error);
      Alert.alert('오류', '전체 푸시 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleServerPush = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        Alert.alert('오류', '푸시 토큰을 가져올 수 없습니다.');
        return;
      }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case '이중체결':
        return '#22c55e';
      case '단일체결':
        return '#f59e0b';
      case '미체결':
        return '#ef4444';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case '이중체결':
        return '🔒';
      case '단일체결':
        return '⚠️';
      case '미체결':
        return '🚨';
      default:
        return '❓';
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
            disabled={loading}
          >
            <Text style={styles.notificationButtonText}>📱 푸시 테스트</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleLocalNotification}
            disabled={loading}
          >
            <Text style={styles.notificationButtonText}>🔔 로컬 알림</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notificationButtonRow}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleServerTest}
            disabled={loading}
          >
            <Text style={styles.notificationButtonText}>🌐 토큰 등록</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleServerPush}
            disabled={loading}
          >
            <Text style={styles.notificationButtonText}>📡 서버 푸시</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.notificationButton, styles.fullWidthButton]}
          onPress={handleBroadcastPush}
          disabled={loading}
        >
          <Text style={styles.notificationButtonText}>📢 전체 푸시</Text>
        </TouchableOpacity>
      </View>

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Arduino 테스트</Text>
        <View style={styles.connectionBadge}>
          <View
            style={[
              styles.dot,
              { backgroundColor: realtimeConnected ? '#22c55e' : '#ef4444' },
            ]}
          />
          <Text style={styles.connectionText}>
            {realtimeConnected ? 'Realtime 연결됨' : 'Realtime 연결 끊김'}
          </Text>
        </View>
      </View>

      {/* 현재 상태 */}
      {latestStatus && (
        <View style={styles.currentStatusCard}>
          <Text style={styles.cardTitle}>📊 현재 상태</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(latestStatus.status) },
            ]}
          >
            <Text style={styles.statusIcon}>
              {getStatusIcon(latestStatus.status)}
            </Text>
            <Text style={styles.statusText}>{latestStatus.status}</Text>
          </View>
          <View style={styles.sensorRow}>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>좌측</Text>
              <Text style={styles.sensorValue}>
                {latestStatus.left_sensor ? '✓' : '✗'}
              </Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>우측</Text>
              <Text style={styles.sensorValue}>
                {latestStatus.right_sensor ? '✓' : '✗'}
              </Text>
            </View>
          </View>
          <Text style={styles.timestamp}>
            {new Date(latestStatus.timestamp).toLocaleString('ko-KR')}
          </Text>
        </View>
      )}

      {/* 테스트 버튼 */}
      <View style={styles.buttonSection}>
        <Text style={styles.sectionTitle}>상태 변경 테스트</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.testButton, styles.unlockedButton]}
            onPress={handleUnlocked}
            disabled={loading}
          >
            <Text style={styles.buttonIcon}>🚨</Text>
            <Text style={styles.buttonText}>미체결</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.singleButton]}
            onPress={handleSingleLocked}
            disabled={loading}
          >
            <Text style={styles.buttonIcon}>⚠️</Text>
            <Text style={styles.buttonText}>단일체결</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.doubleButton]}
            onPress={handleDoubleLocked}
            disabled={loading}
          >
            <Text style={styles.buttonIcon}>🔒</Text>
            <Text style={styles.buttonText}>이중체결</Text>
          </TouchableOpacity>
        </View>
        {loading && (
          <ActivityIndicator
            size="small"
            color="#78C4B4"
            style={styles.loader}
          />
        )}
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


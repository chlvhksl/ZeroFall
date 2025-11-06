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
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useLocalDevice } from '../context/LocalDeviceContext';

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
  const { last: localLast, status: localConnStatus, lastReceivedAt } = useLocalDevice();

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

  const renderLocalStatus = () => {
    if (!localLast) return null;
    const derived = localLast.left_sensor && localLast.right_sensor
      ? '이중체결'
      : localLast.left_sensor || localLast.right_sensor
      ? '단일체결'
      : '미체결';
    return (
      <View style={styles.currentStatusCard}>
        <Text style={styles.cardTitle}>📡 로컬 장치 상태 ({localConnStatus === 'connected' ? '연결됨' : '연결끊김'})</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(derived) }]}>
          <Text style={styles.statusIcon}>{getStatusIcon(derived)}</Text>
          <Text style={styles.statusText}>{derived}</Text>
        </View>
        <View style={styles.sensorRow}>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>좌측</Text>
            <Text style={styles.sensorValue}>{localLast.left_sensor ? '✓' : '✗'}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>우측</Text>
            <Text style={styles.sensorValue}>{localLast.right_sensor ? '✓' : '✗'}</Text>
          </View>
        </View>
        <Text style={styles.timestamp}>{lastReceivedAt ? new Date(lastReceivedAt).toLocaleString('ko-KR') : '-'}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.contentContainer}
    >
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

      {/* 로컬 장치 상태 (LocalDeviceContext 연동) */}
      {renderLocalStatus()}

      {/* Supabase 현재 상태 카드는 숨김 */}

      

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


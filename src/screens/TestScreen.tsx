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
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useLocalDevice } from '../context/LocalDeviceContext';
import { formatKoreaTime } from '../../lib/utils';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

interface HookStatus {
  id?: number;
  device_id: string;
  left_sensor: boolean;
  right_sensor: boolean;
  status: '미체결' | '단일체결' | '이중체결';
  created_at?: string;
  updated_at?: string;
}

export default function TestScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [latestStatus, setLatestStatus] = useState<HookStatus | null>(null);
  const { last: localLast, status: localConnStatus, lastReceivedAt } = useLocalDevice();
  const TEST_DEVICE_ID = 'r4-01';

  // 공유 채널/리스너(탭 전환 후에도 연결 유지)
  // 모듈 스코프 싱글톤들
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__TEST_SHARED__ = (globalThis as any).__TEST_SHARED__ || {
    channel: null as any,
    last: null as HookStatus | null,
    listeners: [] as Array<(row: HookStatus) => void>,
    lastEventAt: 0 as number,
    pollId: null as ReturnType<typeof setInterval> | null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TEST_SHARED = (globalThis as any).__TEST_SHARED__ as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel: any;
    last: HookStatus | null;
    listeners: Array<(row: HookStatus) => void>;
    lastEventAt: number;
    pollId: ReturnType<typeof setInterval> | null;
  };

  const POLL_MS = 1000; // 1s
  const SILENCE_THRESHOLD_MS = 2000; // 2s 무이벤트 시 폴링 시작

  useEffect(() => {
    // 최신 스냅샷 즉시 반영 + 서버에서 한 번 더 최신값 로드
    if (TEST_SHARED.last) setLatestStatus(TEST_SHARED.last);
    loadLatestStatus();

    // 이미 채널이 있으면 리스너만 등록하고 연결 상태 ON
    if (TEST_SHARED.channel) {
      setRealtimeConnected(true);
      // 채널이 이미 있더라도 최신값 1회 로드(복귀 직후에도 카드 표시)
      loadLatestStatus();
      const listener = (row: HookStatus) => {
        TEST_SHARED.lastEventAt = Date.now();
        if (TEST_SHARED.pollId) { clearInterval(TEST_SHARED.pollId); TEST_SHARED.pollId = null; }
        setLatestStatus(row);
      };
      TEST_SHARED.listeners.push(listener);
      // 언마운트 시 리스너만 제거(채널은 유지)
      return () => {
        TEST_SHARED.listeners = TEST_SHARED.listeners.filter((l) => l !== listener);
      };
    }

    // 최초 생성 시 채널 생성 및 구독
    const channel = supabase
      .channel('test_gori_status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gori_status', filter: `device_id=eq.${TEST_DEVICE_ID}` },
        (payload) => {
          const newStatus = payload.new as HookStatus;
          TEST_SHARED.last = newStatus;
          TEST_SHARED.lastEventAt = Date.now();
          if (TEST_SHARED.pollId) { clearInterval(TEST_SHARED.pollId); TEST_SHARED.pollId = null; }
          setLatestStatus(newStatus);
          TEST_SHARED.listeners.forEach((fn) => { try { fn(newStatus); } catch {} });
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') TEST_SHARED.lastEventAt = Date.now();
      });
    TEST_SHARED.channel = channel;
    // 최초 구독 직후 최신값 1회 로드
    loadLatestStatus();

    // 언마운트 시 채널 제거하지 않음(연결 유지)
    return () => {};
  }, []);

  // 하이브리드: 무이벤트 시에만 1초 폴링 시작, 이벤트 오면 즉시 중단
  useEffect(() => {
    const watchdog = setInterval(() => {
      const silentFor = Date.now() - (TEST_SHARED.lastEventAt || 0);
      if (silentFor > SILENCE_THRESHOLD_MS && !TEST_SHARED.pollId) {
        TEST_SHARED.pollId = setInterval(() => { loadLatestStatus(); }, POLL_MS);
      }
    }, 500);
    return () => {
      clearInterval(watchdog);
      if (TEST_SHARED.pollId) { clearInterval(TEST_SHARED.pollId); TEST_SHARED.pollId = null; }
    };
  }, []);

  const loadLatestStatus = async () => {
    try {
      // updated_at 우선, 없으면 created_at 기준
      let { data, error } = await supabase
        .from('gori_status')
        .select('*')
        .eq('device_id', TEST_DEVICE_ID)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        const fallback = await supabase
          .from('gori_status')
          .select('*')
          .eq('device_id', TEST_DEVICE_ID)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = fallback.data as any;
        error = fallback.error as any;
      }

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const changed =
          !TEST_SHARED.last ||
          TEST_SHARED.last.left_sensor !== data.left_sensor ||
          TEST_SHARED.last.right_sensor !== data.right_sensor ||
          TEST_SHARED.last.status !== data.status ||
          TEST_SHARED.last.updated_at !== data.updated_at ||
          TEST_SHARED.last.created_at !== data.created_at;
        if (changed) {
          TEST_SHARED.last = data;
          TEST_SHARED.lastEventAt = Date.now();
          if (TEST_SHARED.pollId) { clearInterval(TEST_SHARED.pollId); TEST_SHARED.pollId = null; }
          setLatestStatus(data);
          TEST_SHARED.listeners.forEach((fn) => { try { fn(data); } catch {} });
        }
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
      const payload = {
        device_id: TEST_DEVICE_ID,
        left_sensor: leftSensor,
        right_sensor: rightSensor,
        status,
      };
      const { data, error } = await supabase
        .from('gori_status')
        .upsert(payload, { onConflict: 'device_id' })
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
        <Text style={styles.timestamp}>{formatKoreaTime(lastReceivedAt)}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: 8 }]}
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
            {realtimeConnected ? 'Realtime (연결됨)' : 'Realtime (연결 끊김)'}
          </Text>
        </View>
      </View>

      {/* 로컬 장치 상태 (LocalDeviceContext 연동) */}
      {renderLocalStatus()}

      {/* Supabase 원격 상태 */}
      <View style={styles.currentStatusCard}>
        {/* 상단 헤더: 장비명(좌) / 업데이트 시간(우) */}
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>장비명 : {TEST_DEVICE_ID}</Text>
          <Text style={styles.timestampInline}>
            {formatKoreaTime(latestStatus?.updated_at || latestStatus?.created_at)}
          </Text>
        </View>

        {latestStatus ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(latestStatus.status) }]}>
              <Text style={styles.statusIconSmall}>{getStatusIcon(latestStatus.status)}</Text>
              <Text style={styles.statusTextSmall}>{latestStatus.status}</Text>
            </View>
            <View style={styles.sideSensors}>
              <View style={styles.sensorItemInline}>
                <Text style={styles.sensorLabel}>좌측</Text>
                <Text style={styles.sensorValue}>{latestStatus.left_sensor ? '✓' : '✗'}</Text>
              </View>
              <View style={styles.sensorItemInline}>
                <Text style={styles.sensorLabel}>우측</Text>
                <Text style={styles.sensorValue}>{latestStatus.right_sensor ? '✓' : '✗'}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.timestamp}>데이터 없음 (아래 버튼으로 보내보세요)</Text>
        )}
      </View>

      {/* 테스트 전송 버튼 섹션 제거(아두이노가 실제로 전송하므로 비활성화) */}
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: FONT_BOLD,
  },
  timestampInline: {
    fontSize: 12,
    color: '#999',
    fontFamily: FONT_REGULAR,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
    minWidth: '45%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sideSensors: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flex: 1,
  },
  statusIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  statusIconSmall: {
    fontSize: 24,
    marginRight: 8,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: FONT_EXTRABOLD,
  },
  statusTextSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: FONT_EXTRABOLD,
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  sensorItemInline: {
    alignItems: 'center',
    minWidth: 60,
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


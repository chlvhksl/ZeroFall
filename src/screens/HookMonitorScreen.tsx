/**
 * 안전고리 모니터링 화면
 * 
 * 기능:
 * - Supabase Realtime으로 아두이노 센서 데이터 실시간 수신
 * - 미체결/단일체결/이중체결 상태별 다른 UI 표시
 * - 실시간 연결 상태 표시
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { formatKoreaTime } from '../../lib/utils';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

interface HookStatus {
  id: number;
  device_id: string;
  left_sensor: boolean;
  right_sensor: boolean;
  status: '미체결' | '단일체결' | '이중체결';
  timestamp: string;
}

export default function HookMonitorScreen() {
  const insets = useSafeAreaInsets();
  const [currentStatus, setCurrentStatus] = useState<HookStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 최초 데이터 로드
    loadLatestStatus();

    // Realtime 구독 시작
    const channel = supabase
      .channel('hook_status_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hook_status',
        },
        (payload) => {
          console.log('🔔 새로운 센서 데이터 수신:', payload);
          
          const newStatus = payload.new as HookStatus;
          setCurrentStatus(newStatus);
          setLoading(false);
        }
      )
      .subscribe((status) => {
        console.log('Realtime 연결 상태:', status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          setLoading(false);
        }
      });

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 최신 상태 불러오기
  const loadLatestStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('hook_status')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('데이터 로드 실패:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setCurrentStatus(data);
      }
      setLoading(false);
    } catch (err) {
      console.error('예외 발생:', err);
      setLoading(false);
    }
  };

  // 상태에 따른 색상 결정
  const getStatusColor = (): string => {
    if (!currentStatus) return '#999';
    
    switch (currentStatus.status) {
      case '이중체결':
        return '#22c55e'; // 녹색
      case '단일체결':
        return '#f59e0b'; // 주황색
      case '미체결':
        return '#ef4444'; // 빨강색
      default:
        return '#999';
    }
  };

  // 상태 아이콘 및 텍스트
  const getStatusDisplay = () => {
    if (!currentStatus) return { icon: '❓', text: '데이터 없음' };
    
    switch (currentStatus.status) {
      case '이중체결':
        return { icon: '🔒', text: '이중체결 완료' };
      case '단일체결':
        return { icon: '⚠️', text: '단일체결 경고' };
      case '미체결':
        return { icon: '🚨', text: '미체결 위험!' };
      default:
        return { icon: '❓', text: '알 수 없음' };
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#78C4B4" />
          <Text style={styles.loadingText}>데이터 로딩 중...</Text>
        </View>
      </View>
    );
  }

  const statusDisplay = getStatusDisplay();
  const statusColor = getStatusColor();

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 연결 상태 배지 */}
      <View style={styles.connectionBadge}>
        <View style={[styles.dot, { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }]} />
        <Text style={styles.connectionText}>
          {isConnected ? '실시간 연결됨' : '연결 끊김'}
        </Text>
      </View>

      {/* 메인 상태 카드 */}
      {currentStatus ? (
        <View style={styles.statusCard}>
          {/* 장비 ID */}
          <Text style={styles.deviceId}>장비: {currentStatus.device_id}</Text>
          
          {/* 상태 배지 */}
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusIcon}>{statusDisplay.icon}</Text>
            <Text style={styles.statusText}>{statusDisplay.text}</Text>
          </View>

          {/* 센서 상세 정보 */}
          <View style={styles.sensorRow}>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>좌측 센서</Text>
              <View style={[styles.sensorBadge, { backgroundColor: currentStatus.left_sensor ? '#22c55e' : '#ef4444' }]}>
                <Text style={styles.sensorValue}>
                  {currentStatus.left_sensor ? '✓ 체결' : '✗ 미체결'}
                </Text>
              </View>
            </View>

            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>우측 센서</Text>
              <View style={[styles.sensorBadge, { backgroundColor: currentStatus.right_sensor ? '#22c55e' : '#ef4444' }]}>
                <Text style={styles.sensorValue}>
                  {currentStatus.right_sensor ? '✓ 체결' : '✗ 미체결'}
                </Text>
              </View>
            </View>
          </View>

          {/* 업데이트 시간 */}
          <Text style={styles.timestamp}>
            업데이트: {formatKoreaTime(currentStatus.timestamp)}
          </Text>
        </View>
      ) : (
        <View style={styles.noDataCard}>
          <Text style={styles.noDataText}>📡 아두이노에서 데이터를 기다리는 중...</Text>
          <Text style={styles.noDataSubText}>
            아두이노가 연결되고 센서 값이 변경되면{'\n'}
            여기에 실시간으로 표시됩니다.
          </Text>
        </View>
      )}

      {/* 상태별 안내 메시지 */}
      {currentStatus && (
        <View style={styles.infoCard}>
          {currentStatus.status === '이중체결' && (
            <Text style={styles.infoText}>
              ✅ 안전고리가 완전히 체결되었습니다. 작업을 진행할 수 있습니다.
            </Text>
          )}
          {currentStatus.status === '단일체결' && (
            <Text style={[styles.infoText, { color: '#f59e0b' }]}>
              ⚠️ 한쪽만 체결되었습니다. 양쪽 모두 체결해주세요.
            </Text>
          )}
          {currentStatus.status === '미체결' && (
            <Text style={[styles.infoText, { color: '#ef4444' }]}>
              🚨 안전고리가 체결되지 않았습니다! 즉시 작업을 중단하고 체결하세요!
            </Text>
          )}
        </View>
      )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: FONT_REGULAR,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
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
  statusCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 20,
  },
  deviceId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    fontFamily: FONT_BOLD,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#000',
  },
  statusIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  statusText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: FONT_EXTRABOLD,
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  sensorItem: {
    flex: 1,
    alignItems: 'center',
  },
  sensorLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: FONT_REGULAR,
    marginBottom: 8,
  },
  sensorBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    width: '100%',
    alignItems: 'center',
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: FONT_BOLD,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    fontFamily: FONT_REGULAR,
  },
  noDataCard: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    marginBottom: 20,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: FONT_BOLD,
    marginBottom: 12,
    textAlign: 'center',
  },
  noDataSubText: {
    fontSize: 14,
    color: '#666',
    fontFamily: FONT_REGULAR,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    fontFamily: FONT_REGULAR,
    textAlign: 'center',
    lineHeight: 20,
  },
});



/**
 * 알림 내역 화면
 * 
 * 기능:
 * - 최근 상태 기록 조회
 * - Realtime으로 실시간 업데이트
 * - 장비별 상태 기록 표시
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

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

export default function NotificationHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [recentStatuses, setRecentStatuses] = useState<HookStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 최근 데이터 로드
    loadRecentStatuses();

    // Realtime 구독
    const channel = supabase
      .channel('notification_history')
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
          // 최신 데이터를 리스트 맨 앞에 추가
          setRecentStatuses((prev) => [newStatus, ...prev.slice(0, 9)]);
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRecentStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('hook_status')
        .select('*')
        .eq('device_id', 'DEVICE_001')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      if (data) {
        setRecentStatuses(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('최근 상태 로드 실패:', error);
      setLoading(false);
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

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>🔔 알림 내역</Text>
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

      {/* 상태 기록 목록 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#78C4B4" />
          <Text style={styles.loadingText}>데이터 로딩 중...</Text>
        </View>
      ) : recentStatuses.length > 0 ? (
        recentStatuses.map((status, index) => (
          <View key={status.id || index} style={styles.statusItem}>
            {/* 장비 이름 */}
            <Text style={styles.deviceName}>{status.device_id}</Text>
            <View style={styles.statusItemHeader}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor(status.status) },
                ]}
              />
              <Text style={styles.statusItemText}>{status.status}</Text>
              <Text style={styles.statusItemTime}>
                {new Date(status.timestamp).toLocaleTimeString('ko-KR')}
              </Text>
            </View>
            <Text style={styles.statusItemDetail}>
              좌측: {status.left_sensor ? '✓' : '✗'} | 우측:{' '}
              {status.right_sensor ? '✓' : '✗'}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>기록이 없습니다</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: FONT_REGULAR,
  },
  statusItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 12,
    color: '#999',
    fontFamily: FONT_REGULAR,
    marginBottom: 4,
  },
  statusItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: FONT_BOLD,
    flex: 1,
  },
  statusItemTime: {
    fontSize: 12,
    color: '#666',
    fontFamily: FONT_REGULAR,
  },
  statusItemDetail: {
    fontSize: 14,
    color: '#666',
    fontFamily: FONT_REGULAR,
    marginLeft: 16,
  },
  emptyContainer: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontFamily: FONT_REGULAR,
    textAlign: 'center',
  },
});


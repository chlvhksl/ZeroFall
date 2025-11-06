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
import { useLocalDevice } from '../context/LocalDeviceContext';
import { supabase } from '../../lib/supabase';
import { addNotificationHistoryListener } from '../../lib/notifications';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

type NotificationRow = {
  id: number;
  created_at: string;
  device_id: string | null;
  title: string | null;
  body: string | null;
  status: string | null;
};

export default function NotificationHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { status: localConnStatus } = useLocalDevice();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [rtConnected, setRtConnected] = useState(false);

  useEffect(() => {
    let channel: any | null = null;
    let offLocal: (() => void) | null = null;

    const fetchInitial = async () => {
      try {
        const { data, error } = await supabase
          .from<NotificationRow>('notification_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setItems(data || []);
      } catch (e) {
        console.error('알림 내역 조회 오류:', e);
      } finally {
        setLoading(false);
      }
    };

    channel = supabase
      .channel('notification_history_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_history' },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev].slice(0, 300));
        }
      )
      .subscribe((status) => setRtConnected(status === 'SUBSCRIBED'));

    fetchInitial();

    // 즉시 반영: 앱 내 수신 이벤트를 상단에 삽입(Realtime 올 때는 필터로 중복 숨김)
    offLocal = addNotificationHistoryListener((row: any) => {
      setItems((prev) => [
        {
          id: Math.floor(Math.random() * 1e9),
          created_at: row.created_at || new Date().toISOString(),
          device_id: row.device_id ?? null,
          title: row.title ?? '알림',
          body: row.body ?? null,
          status: row.status ?? null,
        },
        ...prev,
      ].slice(0, 300));
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (offLocal) offLocal();
    };
  }, []);

  const getStatusColor = (status?: string | null) => {
    if (status === '미체결') return '#ef4444';
    if (status === '단일체결') return '#f59e0b';
    return '#666';
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: 8 }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>🔔 알림 내역</Text>
      </View>

      {/* 원격(Supabase) 알림 내역 – Realtime 상태 배지는 숨김 */}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>알림을 불러오는 중…</Text>
        </View>
      ) : items.length > 0 ? (
        // 보이는 수준에서도 초단위 중복 제거
        items.filter((n) => !!n.device_id).filter((n, idx, arr) => {
          const prev = arr[idx - 1];
          if (!prev) return true;
          const sameTime = new Date(n.created_at).toISOString().slice(0, 19) === new Date(prev.created_at).toISOString().slice(0, 19);
          const sameTitle = n.title === prev.title && n.body === prev.body && (n.device_id || '') === (prev.device_id || '');
          return !(sameTime && sameTitle);
        }).map((n) => (
          <View key={n.id} style={styles.statusItem}>
            <Text style={styles.deviceName}>{n.device_id || '-'}</Text>
            <View style={styles.statusItemHeader}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(n.status) }]} />
              <Text style={styles.statusItemText}>{n.title || '알림'}</Text>
              <Text style={styles.statusItemTime}>{new Date(n.created_at).toLocaleString('ko-KR')}</Text>
            </View>
            {!!n.body && <Text style={styles.statusItemDetail}>{n.body}</Text>}
          </View>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>알림 내역이 없습니다</Text>
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


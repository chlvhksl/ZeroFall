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

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

export default function NotificationHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { alerts, status: localConnStatus, clearAlerts } = useLocalDevice();

  useEffect(() => {
    // Supabase 연동 제거: 로컬 장치 알림만 사용
  }, []);

  const getStatusColor = () => '#ef4444';

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
              { backgroundColor: localConnStatus === 'connected' ? '#22c55e' : '#ef4444' },
            ]}
          />
          <Text style={styles.connectionText}>
            {localConnStatus === 'connected' ? '로컬 연결됨' : '로컬 연결 끊김'}
          </Text>
        </View>
      </View>

      {/* 로컬 장치 알림(미체결만) */}
      {alerts.length > 0 ? (
        alerts.map((a, idx) => (
          <View key={idx} style={styles.statusItem}>
            <Text style={styles.deviceName}>{a.deviceId}</Text>
            <View style={styles.statusItemHeader}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={styles.statusItemText}>미체결</Text>
              <Text style={styles.statusItemTime}>{new Date(a.notifiedAt).toLocaleTimeString('ko-KR')}</Text>
            </View>
            <Text style={styles.statusItemDetail}>
              좌측: {a.left ? '✓' : '✗'} | 우측: {a.right ? '✓' : '✗'}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>미체결 알림이 없습니다</Text>
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


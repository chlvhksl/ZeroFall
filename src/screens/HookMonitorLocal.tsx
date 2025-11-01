import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendLocalNotification } from '../../lib/notifications';
import { useLocalDevice } from '../context/LocalDeviceContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type HookMsg = {
  device_id: string;
  left_sensor: boolean;
  right_sensor: boolean;
  ts: number;
};

const STORAGE_KEY = 'LOCAL_DEVICE_ADDRESS';

export default function HookMonitorLocal() {
  const insets = useSafeAreaInsets();
  const [ipPort, setIpPort] = useState('http://192.168.45.196:8080');
  const { status, last, connect, disconnect } = useLocalDevice();
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleMessage = (event: WebSocketMessageEvent) => {
    try {
      const data: HookMsg = JSON.parse(String(event.data));
      // 유지: 로컬 알림 테스트용 버튼 호출 시 사용
      const unhooked = !data.left_sensor && !data.right_sensor;

      if (unhooked) {
        if (!timerRef.current) {
          timerRef.current = setTimeout(async () => {
            timerRef.current = null;
            // 마지막 스냅샷 기준으로 여전히 미체결이면 로컬 알림
            if (last && !last.left_sensor && !last.right_sensor) {
              await sendLocalNotification(
                '미체결 경고',
                '미체결 상태가 5초 이상 지속되었습니다.',
              );
            }
          }, 5000);
        }
      } else {
        clearTimer();
      }
    } catch (e) {
      // 무시: 형식이 맞지 않는 메시지
    }
  };

  const onPressConnect = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, ipPort);
    } catch {}
    connect(ipPort);
  };

  const onPressDisconnect = () => disconnect();

  useEffect(() => {
    // 저장된 주소를 불러와 기본값을 덮어씀
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setIpPort(saved);
      } catch {}
    })();
    return () => {
      // 화면 전환 시 자동 해제하지 않음. 타이머/폴링만 정리.
      clearTimer();
      clearPolling();
    };
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <Text style={styles.title}>🔌 로컬 WebSocket 모니터</Text>

      <View style={styles.row}> 
        <Text style={styles.label}>아두이노 주소 (ws: IP:포트 또는 http://IP:포트)</Text>
        <TextInput
          value={ipPort}
          onChangeText={setIpPort}
          autoCapitalize="none"
          placeholder="예: 192.168.0.50:8080"
          style={styles.input}
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={onPressConnect}>
          <Text style={styles.btnText}>연결</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onPressDisconnect}>
          <Text style={styles.btnText}>해제</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>상태: {status}</Text>
        <Text style={styles.statusText}>최근: {last ? JSON.stringify(last) : '-'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#000',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  primary: {
    backgroundColor: '#78C4B4',
  },
  secondary: {
    backgroundColor: '#D8D8C8',
  },
  btnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  statusBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
  },
  statusText: {
    color: '#000',
    marginBottom: 6,
  },
});



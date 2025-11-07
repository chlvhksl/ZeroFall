import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendLocalNotification } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';

type GoriStatus = {
  id?: number;
  device_id: string;
  left_sensor?: boolean;
  right_sensor?: boolean;
  status?: string;
  created_at?: string; // 또는 timestamp
  timestamp?: string;
  [key: string]: any;
};

const STORAGE_KEY_DEVICE = 'DASHBOARD_DEVICE_ID';

// 화면 전환 시에도 연결 유지하기 위한 모듈 스코프 싱글톤
let sharedChannel: any | null = null;
let sharedDeviceId: string | null = null;
let sharedTimer: ReturnType<typeof setTimeout> | null = null;
let sharedLast: GoriStatus | null = null;
let sharedTimerDevice: string | null = null;
const lastUnhookedByDevice: Record<string, boolean> = {};
const alertFiredByDevice: Record<string, boolean> = {};
let sharedManualStopped = false; // 사용자가 해제 버튼을 눌렀는지
let sharedReconnectHandle: ReturnType<typeof setTimeout> | null = null;
const ALERT_FIRED_PREFIX = 'ALERT_FIRED_';

async function loadAlertFiredFlag(id: string) {
  try {
    const v = await AsyncStorage.getItem(ALERT_FIRED_PREFIX + id);
    alertFiredByDevice[id] = v === '1';
  } catch {}
}

async function saveAlertFiredFlag(id: string, fired: boolean) {
  alertFiredByDevice[id] = fired;
  try {
    if (fired) await AsyncStorage.setItem(ALERT_FIRED_PREFIX + id, '1');
    else await AsyncStorage.setItem(ALERT_FIRED_PREFIX + id, '0');
  } catch {}
}

export default function HookMonitorLocal() {
  const insets = useSafeAreaInsets();
  const [deviceId, setDeviceId] = useState('r4-F412FA6D7118');
  const [connection, setConnection] = useState<'disconnected' | 'subscribed'>('disconnected');
  const [last, setLast] = useState<GoriStatus | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const evaluateForAlert = (row: GoriStatus, id: string) => {
    const left = Boolean(row.left_sensor);
    const right = Boolean(row.right_sensor);
    const unhooked = !left && !right;
    const prevUnhooked = lastUnhookedByDevice[id] || false;
    const alertFired = alertFiredByDevice[id] || false;

    // 상태 전이 기록
    lastUnhookedByDevice[id] = unhooked;

    if (unhooked) {
      // 이미 같은 연속 구간에서 알림을 보냈다면 아무 것도 안 함
      if (alertFired) return;

      // 새롭게 미체결로 전이됐거나(또는 초기) 아직 알림 안 보냈다면 타이머 시작
      if (!timerRef.current && !sharedTimer) {
        sharedTimerDevice = id;
        timerRef.current = setTimeout(async () => {
          timerRef.current = null;
          sharedTimer = null;
          const latest = sharedLast ?? row;
          const l = Boolean(latest?.left_sensor);
          const r = Boolean(latest?.right_sensor);
          if (!l && !r && !alertFiredByDevice[id]) {
            const title = `🚨 ${id} 안전고리 미체결 경고!`;
            const body = '작업자의 안전고리가 5초 이상 분리되었습니다.';
            await sendLocalNotification(title, body, { device_id: id, status: '미체결' });
            await saveAlertFiredFlag(id, true); // 같은 연속 구간에서는 한 번만
          }
        }, 5000);
        sharedTimer = timerRef.current;
      }
    } else {
      // 안전 상태로 전환: 타이머/플래그 초기화
      clearTimer();
      sharedTimer = null;
      sharedTimerDevice = null;
      saveAlertFiredFlag(id, false);
    }
  };

  const startSubscribe = async (targetId?: string, manual: boolean = false) => {
    if (manual) {
      // 사용자가 명시적으로 시작을 눌렀다면 수동 해제 플래그 해제
      sharedManualStopped = false;
    } else if (sharedManualStopped) {
      // 자동 재연결/자동 시작일 때는 수동 해제 상태면 시작하지 않음
      return;
    }
    const id = targetId || deviceId;
    // 저장
    try { await AsyncStorage.setItem(STORAGE_KEY_DEVICE, id); } catch {}

    // 이전 알림 플래그 불러오기
    await loadAlertFiredFlag(id);

    // 최신 1건 로드
    await fetchLatest(id);

    // 기존 채널 유지 전략: 다른 장비를 구독 중이면 교체, 동일 장비면 재사용
    // 모든 기존 채널 정리(중복 리스너 방지)
    try {
      const channels = (supabase as any).getChannels?.() || [];
      channels.forEach((ch: any) => {
        try { supabase.removeChannel(ch); } catch {}
      });
    } catch {}
    sharedChannel = null;
    sharedDeviceId = null;

    const channel = supabase
      .channel(`gori-status-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gori_status', filter: `device_id=eq.${id}` },
        (payload) => {
          const row = (payload as any).new as GoriStatus;
          setLast(row);
          sharedLast = row;
          evaluateForAlert(row, id);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('subscribed');
        } else {
          setConnection('disconnected');
          // 재시도
          if (!sharedManualStopped) {
            if (sharedReconnectHandle) clearTimeout(sharedReconnectHandle);
            sharedReconnectHandle = setTimeout(() => {
              sharedReconnectHandle = null;
              startSubscribe(id, false);
            }, 1000);
          }
        }
      });

    channelRef.current = channel;
    sharedChannel = channel;
    sharedDeviceId = id;
  };

  const stopSubscribe = () => {
    sharedManualStopped = true; // 수동 해제 플래그
    if (sharedReconnectHandle) {
      clearTimeout(sharedReconnectHandle);
      sharedReconnectHandle = null;
    }
    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current); } catch {}
      channelRef.current = null;
    }
    sharedChannel = null;
    sharedDeviceId = null;
    setConnection('disconnected');
    clearTimer();
    sharedTimer = null;
  };

  const fetchLatest = async (targetId?: string): Promise<GoriStatus | null> => {
    const id = targetId || deviceId;
    // created_at 우선, 없으면 timestamp 기준
    const tryFields = ['created_at', 'timestamp'];
    for (const field of tryFields) {
      const { data, error } = await supabase
        .from('gori_status')
        .select('*')
        .eq('device_id', id)
        .order(field as any, { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setLast(data);
        sharedLast = data;
        evaluateForAlert(data, id);
        return data;
      }
    }
    return null;
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_DEVICE);
        const idToUse = (saved || sharedDeviceId || deviceId).trim();
        if (idToUse !== deviceId) setDeviceId(idToUse);
        if (sharedLast) setLast(sharedLast);
        sharedManualStopped = false; // 화면 진입 시 자동 시작 허용
        await startSubscribe(idToUse, false);
      } catch {}
    })();
    return () => {
      // 연결 유지: 해제하지 않음
    };
  }, []);

  return (
    <View style={[styles.container, { paddingTop: 8 }]}> 
      <Text style={styles.title}>☁️ Supabase 대시보드</Text>

      <View style={styles.row}> 
        <Text style={styles.label}>장비 ID</Text>
        <TextInput
          value={deviceId}
          onChangeText={(t) => { setDeviceId(t); try { AsyncStorage.setItem(STORAGE_KEY_DEVICE, t); } catch {} }}
          autoCapitalize="none"
          placeholder="예: UNO-R4-001"
          style={styles.input}
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => startSubscribe(undefined, true)}>
          <Text style={styles.btnText}>실시간 시작</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={stopSubscribe}>
          <Text style={styles.btnText}>해제</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>연결: {connection}</Text>
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



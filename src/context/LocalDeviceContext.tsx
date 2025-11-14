import React, { createContext, useContext, useRef, useState } from 'react';
import { sendRemotePush } from '../../lib/notifications';

type HookMsg = {
  device_id: string;
  left_sensor: boolean;
  right_sensor: boolean;
  ts: number;
};

type AlertItem = {
  deviceId: string;
  left: boolean;
  right: boolean;
  notifiedAt: number; // epoch ms
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

type LocalDeviceContextValue = {
  status: ConnectionStatus;
  address: string;
  last: HookMsg | null;
  lastReceivedAt: number | null;
  alerts: AlertItem[];
  clearAlerts: () => void;
  connect: (address: string) => void;
  disconnect: () => void;
};

const LocalDeviceContext = createContext<LocalDeviceContextValue | undefined>(undefined);

export function LocalDeviceProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [address, setAddress] = useState('');
  const [last, setLast] = useState<HookMsg | null>(null);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertIssuedRef = useRef<boolean>(false); // 에피소드당 1회만 알림
  const lastRef = useRef<HookMsg | null>(null);

  const clearPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleData = async (data: HookMsg) => {
    setLast(data);
    lastRef.current = data;
    setLastReceivedAt(Date.now());
    const unhookedNow = !data.left_sensor && !data.right_sensor;

    if (unhookedNow) {
      // 아직 알림을 보낸 적이 없고, 타이머가 없을 때만 타이머 시작
      if (!alertIssuedRef.current && !timerRef.current) {
        timerRef.current = setTimeout(async () => {
          timerRef.current = null;
          const latest = lastRef.current;
          const stillUnhooked = !!latest && !latest.left_sensor && !latest.right_sensor;
          if (stillUnhooked && !alertIssuedRef.current) {
            await sendRemotePush('미체결 경고', '미체결 상태가 5초 이상 지속되었습니다.');
            alertIssuedRef.current = true; // 에피소드 잠금
            setAlerts(prev => [
              {
                deviceId: latest?.device_id || 'DEVICE_001',
                left: latest?.left_sensor ?? false,
                right: latest?.right_sensor ?? false,
                notifiedAt: Date.now(),
              },
              ...prev,
            ]);
          }
        }, 5000);
      }
    } else {
      // 회복되면 타이머/에피소드 잠금 해제
      clearTimer();
      alertIssuedRef.current = false;
    }
  };

  const connect = (addr: string) => {
    disconnect();
    setStatus('connecting');
    setAddress(addr);

    // HTTP 폴링 모드
    if (/^https?:\/\//.test(addr)) {
      pollRef.current = setInterval(async () => {
        try {
          const url = addr.replace(/\/$/, '') + '/status.json';
          const res = await fetch(url);
          const json = (await res.json()) as HookMsg;
          await handleData(json);
          setStatus('connected');
        } catch (e) {
          setStatus('disconnected');
        }
      }, 700);
      return;
    }

    // WS 모드
    const endpoint = addr.startsWith('ws://') || addr.startsWith('wss://') ? addr : `ws://${addr}/ws`;
    try {
      const ws = new WebSocket(endpoint);
      wsRef.current = ws;
      ws.onopen = () => setStatus('connected');
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as HookMsg;
          handleData(data);
        } catch {}
      };
      ws.onerror = () => setStatus('disconnected');
      ws.onclose = () => setStatus('disconnected');
    } catch (e) {
      setStatus('disconnected');
    }
  };

  const disconnect = () => {
    clearPolling();
    clearTimer();
    alertIssuedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  };

  const clearAlerts = () => setAlerts([]);

  return (
    <LocalDeviceContext.Provider value={{ status, address, last, lastReceivedAt, alerts, clearAlerts, connect, disconnect }}>
      {children}
    </LocalDeviceContext.Provider>
  );
}

export function useLocalDevice() {
  const ctx = useContext(LocalDeviceContext);
  if (!ctx) throw new Error('useLocalDevice must be used within LocalDeviceProvider');
  return ctx;
}



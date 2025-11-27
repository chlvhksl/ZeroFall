import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n-safe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendRemotePush } from '../../lib/notifications';
import { clearSelectedSite, getCurrentSiteRole, getSelectedSite } from '../../lib/siteManagement';
import { useFontByLanguage } from '../../lib/fontUtils-safe';
import { supabase } from '../../lib/supabase';
import { formatKoreaTime } from '../../lib/utils';

type GoriStatus = {
  id?: number;
  device_id: string;
  left_sensor?: boolean;
  right_sensor?: boolean;
  status?: string;
  created_at?: string; // 또는 timestamp
  updated_at?: string;
  worker_name?: string | null;
  [key: string]: any;
};

const STORAGE_KEY_DEVICE = 'DASHBOARD_DEVICE_ID';
const STORAGE_KEY_WORKER = 'DASHBOARD_WORKER_NAME';
const STALE_MS = 30000; // 최근 이벤트가 30초 이내면 연결됨으로 간주(하트비트 15초 + 여유)

// 화면 전환 시에도 연결 유지하기 위한 모듈 스코프 싱글톤
let sharedChannel: any | null = null;
let sharedDeviceId: string | null = null;
let sharedLast: GoriStatus | null = null;
const lastUnhookedByDevice: Record<string, boolean> = {};
const alertFiredByDevice: Record<string, boolean> = {};
let sharedManualStopped = false; // 사용자가 해제 버튼을 눌렀는지
let sharedReconnectHandle: ReturnType<typeof setTimeout> | null = null;
const ALERT_FIRED_PREFIX = 'ALERT_FIRED_';
// 전체 기기 목록 캐시(화면 전환 시 깜빡임 방지)
let sharedAllDevices: Array<GoriStatus> = [];

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fonts = useFontByLanguage();
  const [deviceId, setDeviceId] = useState('r4-F412FA6D7118');
  const [workerName, setWorkerName] = useState('');
  const [connection, setConnection] = useState<'disconnected' | 'subscribed'>(
    'disconnected',
  );
  const [last, setLast] = useState<GoriStatus | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null); // 최근 이벤트(수신/갱신) 시각
  const [nowTs, setNowTs] = useState<number>(Date.now()); // 표시용 틱
  const [anyRegistered, setAnyRegistered] = useState<boolean>(false); // 등록된 기기 존재 여부
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // 기기별 미체결 알림 타이머
  const timersRef = useRef<
    Record<string, ReturnType<typeof setTimeout> | null>
  >({});
  const allDevicesChannelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);
  const [allDevices, setAllDevices] =
    useState<Array<GoriStatus>>(sharedAllDevices);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [currentSiteRole, setCurrentSiteRole] = useState<'admin' | 'manager' | 'viewer' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const clearTimerFor = (id: string) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      timersRef.current[id] = null;
    }
  };

  const clearAllTimers = () => {
    Object.keys(timersRef.current).forEach(k => clearTimerFor(k));
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

      // 새롭게 미체결로 전이됐거나(또는 초기) 아직 알림 안 보냈다면 기기별 타이머 시작
      if (!timersRef.current[id]) {
        timersRef.current[id] = setTimeout(async () => {
          timersRef.current[id] = null;
          const l = Boolean(row?.left_sensor);
          const r = Boolean(row?.right_sensor);
          // 타임아웃 시점에 최신 상태를 한 번 더 점검하기 위해 allDevices 캐시에서 확인
          let latest: GoriStatus | null = null;
          const found = sharedAllDevices.find(d => d.device_id === id);
          latest = found || row || sharedLast;
          const ll = Boolean(latest?.left_sensor);
          const rr = Boolean(latest?.right_sensor);
          if (!ll && !rr && !alertFiredByDevice[id]) {
            const displayName = String(latest?.worker_name || workerName || id);
            const title = i18n.t('notification.alertTitle', { name: displayName });
            const body = i18n.t('notification.alertBody');
            await sendRemotePush(title, body, {
              device_id: id,
              status: i18n.t('notification.status.unfastened'),
            });
            await saveAlertFiredFlag(id, true); // 같은 연속 구간에서는 한 번만
          }
        }, 5000);
      }
    } else {
      // 안전 상태로 전환: 타이머/플래그 초기화
      clearTimerFor(id);
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
    // 입력 우선순위: 명시 targetId > workerName > deviceId
    const raw = (targetId || (workerName || '').trim() || deviceId).trim();
    // 이름을 넣었어도 자동으로 device_id로 해석
    let id = raw;
    try {
      const { data } = await supabase
        .from('gori_status')
        .select('device_id')
        .eq('device_id', raw)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.device_id) {
        const byName = await supabase
          .from('gori_status')
          .select('device_id')
          .eq('worker_name', raw)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byName.data?.device_id) {
          id = String(byName.data.device_id);
          if (id !== deviceId) setDeviceId(id);
        }
      }
    } catch {}
    // 저장
    try {
      await AsyncStorage.setItem(STORAGE_KEY_DEVICE, id);
    } catch {}

    // 이전 알림 플래그 불러오기
    await loadAlertFiredFlag(id);

    // 최신 1건 로드
    await fetchLatest(id);

    // 기존 채널 유지 전략: 현재 장비 채널만 정리(다른 전역 구독은 유지)
    try {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;
      }
    } catch {}
    sharedChannel = null;
    sharedDeviceId = null;

    const channel = supabase
      .channel(`gori-status-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gori_status',
          filter: `device_id=eq.${id}`,
        },
        payload => {
          const row = (payload as any).new as GoriStatus;
          setLast(row);
          sharedLast = row;
          setLastEventAt(Date.now());
          evaluateForAlert(row, id);
        },
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          setConnection('subscribed');
        } else {
          setConnection('disconnected');
          // 재시도
          if (!sharedManualStopped) {
            if (sharedReconnectHandle) clearTimeout(sharedReconnectHandle);
            // 명확한 장애 상태에서만 재연결, 4초 대기
            if (
              ['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED'].includes(String(status))
            ) {
              sharedReconnectHandle = setTimeout(() => {
                sharedReconnectHandle = null;
                startSubscribe(id, false);
              }, 4000);
            }
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
      try {
        supabase.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;
    }
    sharedChannel = null;
    sharedDeviceId = null;
    setConnection('disconnected');
    clearAllTimers();
  };

  const fetchLatest = async (targetId?: string): Promise<GoriStatus | null> => {
    const id = targetId || deviceId;
    // created_at 우선, 없으면 updated_at 기준
    const tryFields = ['created_at', 'updated_at'];
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
        // 최근 이벤트 시각 업데이트(행의 시간 또는 지금)
        const t =
          (data as any).updated_at ||
          data.created_at;
        const ts = t ? new Date(String(t)).getTime() : Date.now();
        setLastEventAt(ts);
        evaluateForAlert(data, id);
        return data;
      }
    }
    return null;
  };

  const registerWorker = async () => {
    const raw = (deviceId || '').trim();
    const worker = (workerName || '').trim();
    if (!raw || !worker) {
      Alert.alert(t('common.error'), t('hookMonitor.deviceIdRequired'));
      return;
    }
    // 이름을 입력해둔 상태라면 device_id로 해석
    let id = raw;
    try {
      const { data } = await supabase
        .from('gori_status')
        .select('device_id')
        .eq('device_id', raw)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.device_id) {
        const byName = await supabase
          .from('gori_status')
          .select('device_id')
          .eq('worker_name', raw)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byName.data?.device_id) id = String(byName.data.device_id);
      }
    } catch {}

    const { error } = await supabase
      .from('gori_status')
      .upsert(
        { device_id: id, worker_name: worker },
        { onConflict: 'device_id' },
      );
    if (error) {
      Alert.alert(t('common.error'), error.message || t('hookMonitor.registerError'));
      return;
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY_WORKER, worker);
    } catch {}
    await fetchLatest(id);
    Alert.alert(t('common.success'), t('hookMonitor.registerSuccess'));
  };

  const normalizeStatus = (
    raw?: string | null,
  ): '이중체결' | '단일체결' | '미체결' | '-' => {
    if (!raw) return '-';
    const s = String(raw).trim().toLowerCase();
    if (
      [
        '이중',
        '이중체결',
        'double',
        'both',
        'locked',
        'lock',
        'secure',
        'fully',
        'ok',
      ].includes(s)
    ) {
      return '이중체결';
    }
    if (
      [
        '단일',
        '단일체결',
        'single',
        'one',
        'partial',
        'partially',
        'half',
      ].includes(s)
    ) {
      return '단일체결';
    }
    if (
      ['미', '미체결', 'none', 'unhooked', 'open', 'danger', 'alert'].includes(
        s,
      )
    ) {
      return '미체결';
    }
    if (s.includes('이중')) return '이중체결';
    if (s.includes('단일')) return '단일체결';
    if (s.includes('미')) return '미체결';
    return '-';
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_DEVICE);
        const savedWorker = await AsyncStorage.getItem(STORAGE_KEY_WORKER);
        const idToUse = (saved || sharedDeviceId || deviceId).trim();
        if (idToUse !== deviceId) setDeviceId(idToUse);
        if (savedWorker) setWorkerName(savedWorker);
        if (sharedLast) setLast(sharedLast);
        sharedManualStopped = false; // 화면 진입 시 자동 시작 허용
        await startSubscribe(idToUse, false);
        // 등록된 기기 존재 여부 점검 - 현장별로 확인
        try {
          const site = await getSelectedSite();
          if (site) {
            const { data } = await supabase
              .from('gori_status')
              .select('device_id,worker_name,site_id')
              .not('worker_name', 'is', null)
              .neq('worker_name', '')
              .eq('site_id', site.id)
              .limit(1)
              .maybeSingle();
            setAnyRegistered(!!data?.device_id);
            console.log('📊 [HookMonitorLocal] 등록된 기기 존재 여부:', !!data?.device_id);
          } else {
            setAnyRegistered(false);
          }
        } catch (error) {
          console.error('❌ [HookMonitorLocal] 등록된 기기 확인 실패:', error);
          setAnyRegistered(false);
        }
      } catch {}
    })();
    return () => {
      // 연결 유지: 해제하지 않음
    };
  }, []);

  // 1초마다 틱을 갱신하여 "최근 이벤트 기준 연결 상태" 표시를 부드럽게 업데이트
  useEffect(() => {
    const handle = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  // 현장 로드 및 권한 확인 함수
  const loadSelectedSite = useCallback(async () => {
    const site = await getSelectedSite();
    if (site) {
      setSelectedSiteId(site.id);
      // 현재 현장 권한 확인
      const role = await getCurrentSiteRole();
      console.log('🔍 [HookMonitorLocal] 현재 현장 권한:', role, '현장:', site.name);
      setCurrentSiteRole(role);
    } else {
      setSelectedSiteId(null);
      setCurrentSiteRole(null);
      console.log('⚠️ [HookMonitorLocal] 선택한 현장이 없습니다.');
    }
  }, []);

  // 화면 포커스 시 즉시 현장 로드 (환경설정에서 현장 변경 시 즉시 반영)
  useFocusEffect(
    useCallback(() => {
      loadSelectedSite();
    }, [loadSelectedSite])
  );

  // 선택한 현장 로드 및 권한 확인 (주기적 확인)
  useEffect(() => {
    loadSelectedSite();
    
    // 현장이 변경될 수 있으므로 주기적으로 확인 (1분마다)
    const interval = setInterval(() => {
      loadSelectedSite();
    }, 60000); // 60초 = 1분
    
    return () => clearInterval(interval);
  }, [loadSelectedSite]);

  // 전체 기기의 최신 상태를 불러와 디바이스별 최신 1건으로 정리
  const loadAllDevicesLatest = async () => {
    try {
      // 최신 현장 정보 가져오기 (삭제된 현장 체크)
      const currentSite = await getSelectedSite();
      const actualSiteId = currentSite?.id || null;
      
      // 선택한 현장이 없으면 조회하지 않음
      if (!actualSiteId) {
        console.log('⚠️ [HookMonitorLocal] 현장이 선택되지 않음');
        setAllDevices([]);
        sharedAllDevices = [];
        setSelectedSiteId(null);
        return;
      }

      // 선택한 현장이 실제로 존재하는지 확인 (삭제된 현장의 장비는 제외)
      const { data: siteExists } = await supabase
        .from('sites')
        .select('id')
        .eq('id', actualSiteId)
        .maybeSingle();

      if (!siteExists) {
        console.log('⚠️ [HookMonitorLocal] 선택한 현장이 존재하지 않음 (삭제됨):', actualSiteId);
        setAllDevices([]);
        sharedAllDevices = [];
        setSelectedSiteId(null);
        await clearSelectedSite();
        return;
      }
      
      // selectedSiteId가 actualSiteId와 다르면 업데이트 (동기화)
      if (selectedSiteId !== actualSiteId) {
        setSelectedSiteId(actualSiteId);
      }

      console.log('🔍 [HookMonitorLocal] 기기 목록 로드 시작, 현장 ID:', actualSiteId);

      // 1단계: 등록된 기기(worker_name이 있는 기기) 목록 먼저 조회
      // 이렇게 하면 최근 데이터가 없어도 등록된 기기는 항상 표시됨
      // 현장이 선택되어 있으면 해당 현장의 장비만 조회 (site_id가 NULL인 장비는 제외)
      const registeredQuery = supabase
        .from('gori_status')
        .select('device_id, worker_name, site_id, updated_at')
        .not('worker_name', 'is', null)
        .neq('worker_name', '')
        .eq('site_id', actualSiteId) // 현장이 선택되어 있으면 해당 현장의 장비만
        .order('updated_at', { ascending: false })
        .limit(1000);

      const { data: registeredData, error: registeredError } = await registeredQuery;
      
      if (registeredError) {
        console.error('❌ [HookMonitorLocal] 등록된 기기 조회 실패:', registeredError);
      } else {
        console.log('✅ [HookMonitorLocal] 등록된 기기 조회 성공:', registeredData?.length || 0, '개');
      }
      
      // 등록된 기기 목록 추출 (중복 제거 - device_id 기준으로 가장 최신 것만)
      const registeredDeviceMap = new Map<string, { device_id: string; worker_name: string; site_id: any }>();
      (registeredData || []).forEach((row: any) => {
        // 현장 필터링: 선택한 현장과 일치하는 장비만 (이미 쿼리에서 필터링되었지만 이중 체크)
        if (row.site_id !== actualSiteId) {
          return;
        }
        if (row.device_id && row.worker_name && String(row.worker_name).trim().length > 0) {
          // 이미 있는 기기면 더 최신 것만 유지
          const existing = registeredDeviceMap.get(row.device_id);
          if (!existing) {
            registeredDeviceMap.set(row.device_id, {
              device_id: row.device_id,
              worker_name: row.worker_name,
              site_id: row.site_id,
            });
          }
        }
      });
      
      const registeredDeviceIds = Array.from(registeredDeviceMap.keys());
      console.log('📋 [HookMonitorLocal] 등록된 기기 목록:', registeredDeviceIds.length, '개', registeredDeviceIds);

      // 2단계: 등록된 기기들의 최신 상태 데이터 조회
      let query = supabase
        .from('gori_status')
        .select(
          'device_id, worker_name, left_sensor, right_sensor, status, updated_at, created_at, site_id',
        )
        .order('updated_at', { ascending: false })
        .limit(1000);

      // 현장별 필터링: 선택한 현장의 장비만 조회
      // 현장이 선택되어 있으면 해당 현장의 장비만 조회 (site_id가 NULL인 장비는 제외)
      query = query.eq('site_id', actualSiteId);

      const { data, error } = await query;
      if (error) throw error;
      
      const byDevice: Record<string, GoriStatus & { __ts?: number }> = {};
      
      // 등록된 기기들의 최신 상태 데이터로 채우기
      (data || []).forEach((row: any) => {
        // 등록된 작업자만 표시
        if (!row.worker_name || String(row.worker_name).trim().length === 0)
          return;
        // 현장 필터링: 선택한 현장과 일치하는 장비만 (site_id가 NULL이면 제외)
        if (!row.site_id || row.site_id !== actualSiteId) {
          return;
        }
        const key = row.device_id;
        const tRaw = row.updated_at || row.created_at;
        const ts = tRaw ? new Date(String(tRaw)).getTime() : 0;
        const prev = byDevice[key];
        if (!prev || ts >= (prev.__ts || 0)) {
          byDevice[key] = { ...(row as GoriStatus), __ts: ts };
        }
      });

      // 3단계: 등록은 되어있지만 최신 데이터가 없는 기기도 포함
      // (마지막 알려진 상태가 없으면 기본값으로 표시)
      registeredDeviceIds.forEach(deviceId => {
        if (!byDevice[deviceId]) {
          // 등록은 되어있지만 최신 상태 데이터가 없는 경우
          // 마지막 알려진 상태를 찾거나 기본값으로 생성
          const lastKnown = sharedAllDevices.find(d => d.device_id === deviceId);
          if (lastKnown) {
            // 이전에 로드했던 데이터가 있으면 그것 사용
            byDevice[deviceId] = { ...lastKnown, __ts: 0 };
            console.log('📌 [HookMonitorLocal] 이전 데이터 사용:', deviceId, lastKnown.worker_name);
          } else {
            // 완전히 새로운 등록이면 기본값으로 생성
            const registeredInfo = registeredDeviceMap.get(deviceId);
            byDevice[deviceId] = {
              device_id: deviceId,
              worker_name: registeredInfo?.worker_name || deviceId,
              left_sensor: false,
              right_sensor: false,
              status: null,
              __ts: 0,
            } as GoriStatus & { __ts?: number };
            console.log('🆕 [HookMonitorLocal] 새 등록 기기 추가:', deviceId, registeredInfo?.worker_name);
          }
        }
      });

      const list = Object.values(byDevice).sort(
        (a: any, b: any) => {
          // 최신 데이터가 있는 것 우선 정렬, 그 다음 등록된 순서
          if ((b.__ts || 0) > 0 && (a.__ts || 0) === 0) return 1;
          if ((a.__ts || 0) > 0 && (b.__ts || 0) === 0) return -1;
          return (b.__ts || 0) - (a.__ts || 0);
        },
      );
      sharedAllDevices = list as Array<GoriStatus>;
      console.log('✅ [HookMonitorLocal] 최종 기기 목록:', sharedAllDevices.length, '개');
      sharedAllDevices.forEach(d => {
        console.log('  -', d.device_id, d.worker_name, 'updated_at:', (d as any).updated_at);
      });
      setAllDevices(sharedAllDevices);
      // 등록된 기기 존재 여부 업데이트
      setAnyRegistered(sharedAllDevices.length > 0);
      // 초기 로드 시점에도 각 기기에 대해 미체결 알림 로직 연결
      sharedAllDevices.forEach(r => evaluateForAlert(r, r.device_id));
    } catch (error) {
      console.error('❌ [HookMonitorLocal] 기기 목록 로드 실패:', error);
    }
  };

  // 전체 기기 실시간 구독
  useEffect(() => {
    // selectedSiteId를 최신 값으로 가져오기 위해 ref 사용
    const currentSiteId = selectedSiteId;
    
    if (!currentSiteId) {
      // 현장이 선택되지 않았으면 구독하지 않음
      console.log('⚠️ [HookMonitorLocal] 현장이 선택되지 않아 기기 목록을 로드하지 않음');
      setAllDevices([]);
      sharedAllDevices = [];
      return;
    }

    // 선택한 현장이 실제로 존재하는지 확인 (삭제된 현장의 장비는 제외)
    const checkSiteAndLoad = async () => {
      // 최신 selectedSiteId 확인 (삭제된 현장이면 null일 수 있음)
      const currentSite = await getSelectedSite();
      const actualSiteId = currentSite?.id || null;
      
      if (!actualSiteId || actualSiteId !== currentSiteId) {
        console.log('⚠️ [HookMonitorLocal] 선택한 현장이 존재하지 않음 (삭제됨):', currentSiteId);
        setAllDevices([]);
        sharedAllDevices = [];
        setSelectedSiteId(null);
        return;
      }

      const { data: siteExists } = await supabase
        .from('sites')
        .select('id')
        .eq('id', actualSiteId)
        .maybeSingle();

      if (!siteExists) {
        console.log('⚠️ [HookMonitorLocal] 선택한 현장이 존재하지 않음 (삭제됨):', actualSiteId);
        setAllDevices([]);
        sharedAllDevices = [];
        setSelectedSiteId(null);
        await clearSelectedSite();
        return;
      }

      console.log('🔄 [HookMonitorLocal] 기기 목록 로드 시작 (useEffect), 현장:', actualSiteId);
      // loadAllDevicesLatest는 selectedSiteId를 직접 참조하므로, 여기서는 actualSiteId를 사용
      loadAllDevicesLatest();
    };

    checkSiteAndLoad();
    
    // 주기적으로 다시 로드 (30초마다) - 등록된 기기가 누락되는 경우 대비
    const interval = setInterval(() => {
      console.log('🔄 [HookMonitorLocal] 주기적 기기 목록 갱신');
      checkSiteAndLoad();
    }, 30000);
    
    // 실시간 구독 설정
    const ch = supabase
      .channel('gori-status-all-devices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gori_status' },
        async (payload) => {
          console.log('📡 [HookMonitorLocal] 실시간 이벤트 수신:', payload.eventType, payload.new?.device_id);
          
          // 최신 selectedSiteId 확인 (클로저 문제 해결)
          const currentSite = await getSelectedSite();
          const actualSiteId = currentSite?.id || null;
          
          // 현장이 없으면 모든 이벤트 무시
          if (!actualSiteId) {
            console.log('🚫 [HookMonitorLocal] 현장이 선택되지 않음 - 이벤트 무시');
            return;
          }
          
          // 현장이 실제로 존재하는지 확인
          const { data: siteExists } = await supabase
            .from('sites')
            .select('id')
            .eq('id', actualSiteId)
            .maybeSingle();
          
          if (!siteExists) {
            console.log('🚫 [HookMonitorLocal] 선택한 현장이 존재하지 않음 (삭제됨) - 이벤트 무시');
            setAllDevices([]);
            sharedAllDevices = [];
            setSelectedSiteId(null);
            await clearSelectedSite();
            return;
          }
          
          const row = (payload as any).new as GoriStatus;
          
          // DELETE 이벤트 처리
          if (payload.eventType === 'DELETE') {
            const oldRow = (payload as any).old as GoriStatus;
            if (oldRow?.device_id) {
              console.log('🗑️ [HookMonitorLocal] 기기 삭제 이벤트:', oldRow.device_id);
              setAllDevices(prev => {
                const filtered = prev.filter(item => item.device_id !== oldRow.device_id);
                sharedAllDevices = filtered;
                return filtered;
              });
            }
            return;
          }
          
          // INSERT/UPDATE 이벤트 처리
          if (!row) {
            console.warn('⚠️ [HookMonitorLocal] payload.new가 없음');
            return;
          }
          
          // 작업자 미등록은 목록에서 제외
          const hasWorker = !!(
            row.worker_name && String(row.worker_name).trim().length > 0
          );
          
          // 현장 필터링: 선택한 현장의 장비만 처리 (site_id가 NULL인 장비는 제외)
          const rowSiteId = (row as any).site_id;
          if (!rowSiteId || rowSiteId !== actualSiteId) {
            // site_id가 NULL이거나 다른 현장의 장비는 무시
            console.log('🚫 [HookMonitorLocal] 다른 현장의 장비 또는 site_id가 NULL인 장비 무시:', rowSiteId, 'vs', actualSiteId);
            return;
          }
          
          if (hasWorker && row.device_id) {
            // 어떤 기기든 상태 이벤트 들어올 때마다 즉시 알림 평가
            evaluateForAlert(row, row.device_id);
          }
          
          // 즉시 상태 업데이트
          setAllDevices(prev => {
            const tRaw =
              (row as any).updated_at ||
              (row as any).created_at;
            const ts = tRaw ? new Date(String(tRaw)).getTime() : Date.now();
            const map: Record<string, any> = {};
            // 기존 목록 유지 (등록된 기기는 제거하지 않음)
            prev.forEach((r: any) => {
              map[r.device_id] = r;
            });
            
            if (hasWorker && row.device_id) {
              // 작업자가 등록된 기기는 항상 업데이트 (타임스탬프 비교 없이 즉시 업데이트)
              console.log('✅ [HookMonitorLocal] 기기 상태 즉시 업데이트:', row.device_id, row.worker_name, row.left_sensor, row.right_sensor);
              map[row.device_id] = { ...row, __ts: ts };
              
              // 새로 등록된 기기인 경우 (기존 목록에 없었던 경우) 전체 목록 다시 로드
              if (!prev.find((r: any) => r.device_id === row.device_id)) {
                console.log('🆕 [HookMonitorLocal] 새로 등록된 기기 감지 - 전체 목록 다시 로드:', row.device_id);
                // 비동기로 전체 목록 다시 로드 (다음 렌더링 사이클에서)
                setTimeout(() => {
                  loadAllDevicesLatest();
                }, 100);
              }
            }
            // 작업자가 없는 기기는 제거하지 않음 (등록된 기기는 유지)
            // 단, worker_name이 null로 변경된 경우에만 제거
            if (!hasWorker && map[row.device_id]) {
              const existing = map[row.device_id];
              // 기존에 worker_name이 있었는데 이제 없어진 경우만 제거
              if (existing.worker_name && String(existing.worker_name).trim().length > 0) {
                // 등록된 기기는 유지 (worker_name이 null로 변경되어도 마지막 상태 유지)
                // 제거하지 않음
              } else {
                // 처음부터 worker_name이 없었던 기기는 제거
                delete map[row.device_id];
              }
            }
            
            const list = Object.values(map).sort((a: any, b: any) => {
              const aTs = new Date(
                String(a.updated_at || a.created_at),
              ).getTime();
              const bTs = new Date(
                String(b.updated_at || b.created_at),
              ).getTime();
              // 최신 데이터가 있는 것 우선 정렬
              if (bTs > 0 && aTs === 0) return 1;
              if (aTs > 0 && bTs === 0) return -1;
              return bTs - aTs;
            }) as Array<GoriStatus>;
            sharedAllDevices = list;
            return sharedAllDevices;
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [HookMonitorLocal] 실시간 구독 성공');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [HookMonitorLocal] 실시간 구독 오류');
        } else {
          console.log('🔄 [HookMonitorLocal] 실시간 구독 상태:', status);
        }
      });
    
    allDevicesChannelRef.current = ch;
    
    // cleanup 함수: interval과 channel 모두 정리
    return () => {
      console.log('🧹 [HookMonitorLocal] cleanup: interval 및 channel 정리');
      clearInterval(interval);
      try {
        if (allDevicesChannelRef.current) {
          supabase.removeChannel(allDevicesChannelRef.current);
        }
      } catch (error) {
        console.error('❌ [HookMonitorLocal] channel 제거 실패:', error);
      }
      allDevicesChannelRef.current = null;
    };
  }, [selectedSiteId]);

  const getStatusLabel = (row: GoriStatus | null) => {
    if (!row) return '-';
    if (row.status) {
      const norm = normalizeStatus(row.status);
      if (norm !== '-') return norm;
    }
    const left = Boolean(row.left_sensor);
    const right = Boolean(row.right_sensor);
    if (left && right) return '이중체결';
    if (left || right) return '단일체결';
    return '미체결';
  };

  // 실시간 응답성 우선: 센서 값이 함께 오면 센서 기준으로 즉시 판정, 없으면 status 사용

  // 개인 상태 카드 UI는 숨김(전체 기기 목록만 표시)

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>☁️ {t('dashboard.title')}</Text>

      {/* 검색창 */}
      <View style={styles.searchContainer}>
        <Text style={styles.label}>{t('device.search')}</Text>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('device.searchPlaceholder')}
            placeholderTextColor="#999"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 관리자만 작업자 등록 버튼 표시 */}
      {currentSiteRole === 'admin' && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.primary]}
            onPress={() => {
              console.log('➡️ [HookMonitorLocal] 라우팅: /register (작업자 등록)');
              router.push('/register');
            }}
          >
            <Text style={styles.btnText}>{t('device.registerWorker')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!anyRegistered && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {t('device.waitingRegistration')}
          </Text>
        </View>
      )}

      {/* 전체 기기 목록 */}
      {allDevices.length > 0 && (() => {
        const filteredDevices = allDevices.filter(item => {
          const query = searchQuery.toLowerCase().trim();
          if (!query) return true;
          const deviceId = (item.device_id || '').toLowerCase();
          const workerName = (item.worker_name || '').toLowerCase();
          return deviceId.includes(query) || workerName.includes(query);
        });

        return (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.label, { marginBottom: 8 }]}>
              {t('device.totalDevices')} {searchQuery ? `(${filteredDevices.length})` : `(${allDevices.length})`}
            </Text>
            {filteredDevices.length === 0 ? (
              <View style={styles.infoBox}>
                <Text style={[styles.infoText, { fontFamily: fonts.regular }]}>
                  {t('dashboard.noSearchResults')}
                </Text>
              </View>
            ) : (
              filteredDevices.map(item => {
                const label = getStatusLabel(item);
                // 최신 데이터가 있는지 확인 (updated_at이 최근 2분 이내인지)
                const updatedAt = (item as any)?.updated_at ||
                  (item as any)?.created_at;
                const updateTime = updatedAt ? new Date(String(updatedAt)).getTime() : 0;
                const now = Date.now();
                const isRecent = updateTime > 0 && (now - updateTime) < 120000; // 2분 이내
                const isConnected = isRecent || updateTime > 0;
                
                return (
                  <View
                    key={item.device_id}
                    style={[styles.currentStatusCard, { marginBottom: 10 }]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle}>
                        {item.worker_name || item.device_id}
                      </Text>
                      <View style={styles.headerRight}>
                        <View
                          style={[styles.dot, { 
                            backgroundColor: isConnected ? '#22c55e' : '#999' 
                          }]}
                        />
                        <Text style={[styles.timestampInline, { fontFamily: fonts.regular }]}>
                          {isConnected 
                            ? formatKoreaTime(updatedAt, i18n.language === 'ko' ? 'ko-KR' : 'en-US')
                            : t('device.disconnected')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              label === '이중체결' || label === t('dashboard.status.doubleFastened')
                                ? '#22c55e'
                                : label === '단일체결' || label === t('dashboard.status.singleFastened')
                                ? '#f59e0b'
                                : label === '미체결' || label === t('dashboard.status.unfastened')
                                ? '#ef4444'
                                : '#999',
                          },
                        ]}
                      >
                        <Text style={styles.statusIconSmall}>
                          {label === '이중체결' || label === t('dashboard.status.doubleFastened')
                            ? '🔒'
                            : label === '단일체결' || label === t('dashboard.status.singleFastened')
                            ? '⚠️'
                            : label === '미체결' || label === t('dashboard.status.unfastened')
                            ? '🚨'
                            : '❓'}
                        </Text>
                        <Text style={[styles.statusTextSmall, { fontFamily: fonts.bold }]}>
                          {label === '이중체결' ? t('dashboard.status.doubleFastened')
                            : label === '단일체결' ? t('dashboard.status.singleFastened')
                            : label === '미체결' ? t('dashboard.status.unfastened')
                            : label}
                        </Text>
                      </View>
                      <View style={styles.sideSensors}>
                        <View style={styles.sensorItemInline}>
                          <Text style={[styles.sensorLabel, { fontFamily: fonts.regular }]}>{t('device.left')}</Text>
                          <Text style={[styles.sensorValue, { fontFamily: fonts.bold }]}>
                            {item?.left_sensor ? '✓' : '✗'}
                          </Text>
                        </View>
                        <View style={styles.sensorItemInline}>
                          <Text style={[styles.sensorLabel, { fontFamily: fonts.regular }]}>{t('device.right')}</Text>
                          <Text style={[styles.sensorValue, { fontFamily: fonts.bold }]}>
                            {item?.right_sensor ? '✓' : '✗'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EDF6EF',
    padding: 20,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#EDF6EF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 20,
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
  inputDisabled: {
    backgroundColor: '#F2F2F2',
    color: '#666',
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
  infoBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    color: '#000',
      },
  // 카드 스타일(테스트 화면과 유사)
  currentStatusCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
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
      },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timestampInline: {
    fontSize: 12,
    color: '#999',
      },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
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
    flexShrink: 1,
    minWidth: 120,
  },
  statusIconSmall: {
    fontSize: 24,
    marginRight: 8,
  },
  statusTextSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
      },
  sideSensors: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 12,
  },
  sensorItemInline: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
    flexShrink: 0,
    height: 50, // 고정 높이로 좌우 높이 맞춤
  },
  sensorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
      },
  sensorValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    lineHeight: 28, // 텍스트 높이 고정
    textAlign: 'center',
      },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
        color: '#000',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
});

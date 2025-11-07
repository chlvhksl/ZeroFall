import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

// 알림 표시 방식 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 푸시 토큰 가져오기
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // 권한 요청 (시뮬레이터와 실제 기기 모두에서 가능)
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('알림 권한 필요', '푸시 알림 권한이 필요합니다!');
    return;
  }

  // 시뮬레이터 체크
  if (!Device.isDevice) {
    console.log('⚠️ 시뮬레이터에서는 실제 푸시 알림이 작동하지 않습니다.');
    console.log('📱 실제 기기에서 테스트하거나 로컬 알림을 사용하세요.');
    console.log(
      '💡 시뮬레이터에서도 서버 테스트를 원한다면 실제 기기를 사용하세요.',
    );
    token = `simulator-token-${Date.now()}`;
    return token;
  }

  // 실제 기기에서만 푸시 토큰 발급 시도
  if (Platform.OS === 'ios') {
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('✅ iOS 푸시 토큰 발급 성공:', token);
    } catch (tokenError) {
      console.log('❌ iOS 푸시 토큰 발급 실패:', tokenError);
      console.log('💡 Apple Developer 계정과 APNs 인증서가 필요합니다.');
      console.log('💡 또는 로컬 알림을 사용하세요.');
      // 개발 환경에서는 임시 토큰 생성
      token = `ios-dev-token-${Date.now()}`;
    }
  } else {
    // Android
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('✅ Android 푸시 토큰 발급 성공:', token);
    } catch (tokenError) {
      console.log('❌ Android 푸시 토큰 발급 실패:', tokenError);
      token = `android-dev-token-${Date.now()}`;
    }
  }

  return token;
}

// 로컬 푸시 알림 발송
const scheduledNotiKeys: Set<string> = new Set();

export async function sendLocalNotification(
  title: string,
  body: string,
  extraData?: Record<string, any>
) {
  // 스케줄 중복 방지(10초): device_id 기준으로 같은 알림은 건너뜀
  const deviceForKey = extraData?.device_id || extraData?.deviceId || extraData?.device;
  const statusForKey = extraData?.status || '';
  const scheduleKey = deviceForKey ? `${deviceForKey}|${statusForKey}|${title}|${body}` : null;
  if (scheduleKey) {
    try {
      const storeKey = `NOTI_SCHEDULE_${scheduleKey}`;
      const last = await AsyncStorage.getItem(storeKey);
      const now = Date.now();
      if (last && now - Number(last) < 10000) return;
      await AsyncStorage.setItem(storeKey, String(now));
    } catch {}
    if (scheduledNotiKeys.has(scheduleKey)) return;
    scheduledNotiKeys.add(scheduleKey);
    setTimeout(() => scheduledNotiKeys.delete(scheduleKey as string), 10000);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      sound: true,
      data: { timestamp: Date.now(), ...(extraData || {}) },
    },
    trigger: null, // 즉시 발송
  });
}

// Supabase notification_history에 기록
export async function logNotificationHistory(
  params: { deviceId?: string; status?: string; title: string; body: string }
) {
  try {
    // device_id가 없는 알림은 기록하지 않음(중복/불명확한 소스 차단)
    if (!params.deviceId) return;
    // 클라이언트 측 중복 방지(영구 저장 기반): 10초 윈도우 내 동일 키는 무시
    const notiKey = `${params.deviceId}|${params.status || ''}|${params.title}|${params.body}`;
    try {
      const storeKey = `NOTI_LOG_${notiKey}`;
      const last = await AsyncStorage.getItem(storeKey);
      const now = Date.now();
      if (last && now - Number(last) < 10000) return;
      await AsyncStorage.setItem(storeKey, String(now));
    } catch {}
    if (recentNotiKeys.has(notiKey)) return; // 메모리 가드
    recentNotiKeys.add(notiKey);
    setTimeout(() => recentNotiKeys.delete(notiKey), 10000);

    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('notification_history')
      .insert({
        device_id: params.deviceId || null,
        title: params.title,
        body: params.body,
        status: params.status || null,
      })
      .select('*')
      .single();
    if (error) {
      console.error('notification_history 기록 실패:', error);
    }
  } catch (e) {
    console.error('notification_history 기록 중 오류:', e);
  }
}

// (placeholder removed)

// 시뮬레이터 테스트용 알림 함수
export async function testNotificationInSimulator() {
  if (!Device.isDevice) {
    console.log('🧪 시뮬레이터에서 알림 테스트 시작...');

    // 즉시 알림
    await sendLocalNotification(
      '시뮬레이터 테스트',
      '이 알림은 시뮬레이터에서도 작동합니다!',
    );

    console.log('✅ 시뮬레이터 알림 테스트 완료');
  } else {
    console.log('📱 실제 기기에서는 실제 푸시 알림을 사용하세요.');
  }
}

// Supabase에 푸시 토큰 저장
export async function savePushTokenToSupabase(token: string, userId: string) {
  try {
    const { supabase } = await import('./supabase');

    const { error } = await supabase.from('user_push_tokens').upsert({
      user_id: userId,
      push_token: token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('푸시 토큰 저장 실패:', error);
      return false;
    }

    console.log('푸시 토큰 저장 성공');
    return true;
  } catch (error) {
    console.error('푸시 토큰 저장 중 오류:', error);
    return false;
  }
}

// 푸시 알림 리스너 설정
let listenersRegistered = false;
const recentNotiKeys: Set<string> = new Set();
const lastDeliveredAtByDevice: Record<string, number> = {};

// In-app notification history bus (즉시 UI 반영)
type NotiRow = {
  id?: number;
  device_id?: string | null;
  title?: string | null;
  body?: string | null;
  status?: string | null;
  created_at?: string;
};

const notiListeners: Array<(row: NotiRow) => void> = [];
export function addNotificationHistoryListener(fn: (row: NotiRow) => void) {
  notiListeners.push(fn);
  return () => {
    const idx = notiListeners.indexOf(fn);
    if (idx >= 0) notiListeners.splice(idx, 1);
  };
}
function emitNotificationHistory(row: NotiRow) {
  notiListeners.forEach((fn) => { try { fn(row); } catch {} });
}
export function setupNotificationListeners() {
  if (listenersRegistered) return () => {};
  listenersRegistered = true;
  // 알림 수신 시 실행될 함수
  const notificationListener = Notifications.addNotificationReceivedListener(
    notification => {
      console.log('알림 수신:', notification);
      try {
        const content = notification.request?.content as any;
        const title = content?.title || '알림';
        const body = content?.body || '';
        const data = content?.data || {};
        const deviceId = data.device_id || data.deviceId || data.device || undefined;
        // device_id 없는 알림은 무시(테스트/기타 알림 차단)
        if (!deviceId) return;
        const now = Date.now();
        const lastAt = lastDeliveredAtByDevice[deviceId] || 0;
        if (now - lastAt < 10000) return; // 10초 내 중복 무시
        lastDeliveredAtByDevice[deviceId] = now;
        // DB 기록 + 즉시 UI 반영(emit은 logNotificationHistory에서 처리)
        const createdAt = new Date().toISOString();
        // 즉시 UI 반영
        emitNotificationHistory({ device_id: deviceId, status: data.status ?? null, title, body, created_at: createdAt });
        // DB 기록(중복 방지 로직 포함)
        logNotificationHistory({ deviceId, status: data.status || null, title, body });
      } catch {}
    },
  );

  // 알림 탭 시 실행될 함수
  const responseListener =
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('알림 탭:', response);
    });

  return () => {
    try { notificationListener.remove(); } catch {}
    try { responseListener.remove(); } catch {}
    listenersRegistered = false;
  };
}

// 서버에 푸시 토큰 등록
export async function registerTokenToServer(token: string) {
  try {
    // Vercel 배포 URL로 변경 (실제 배포 후 URL 교체)
    const serverUrl = process.env.EXPO_PUBLIC_PUSH_SERVER_URL;
    // process.env.NODE_ENV === 'production'
    //   ? process.env.EXPO_PUBLIC_PUSH_SERVER_URL
    //   : 'http://localhost:3001';

    const response = await fetch(`${serverUrl}/api/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        userId: 'user-' + Date.now(), // 임시 사용자 ID
        platform: Platform.OS,
      }),
    });

    const result = await response.json();
    console.log('토큰 등록 응답:', result);
    return result;
  } catch (error) {
    console.error('토큰 등록 실패:', error);
    return null;
  }
}

// 모든 사용자에게 푸시 요청
export async function requestBroadcastPush(title: string, body: string) {
  try {
    // Vercel 배포 URL로 변경 (실제 배포 후 URL 교체)
    const serverUrl = process.env.EXPO_PUBLIC_PUSH_SERVER_URL;
    // process.env.NODE_ENV === 'production'
    //   ? process.env.EXPO_PUBLIC_PUSH_SERVER_URL
    //   : 'http://localhost:3001';

    const response = await fetch(`${serverUrl}/api/broadcast-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        body: body,
        data: {
          type: 'broadcast',
          timestamp: Date.now(),
        },
      }),
    });

    const result = await response.json();
    console.log('전체 푸시 응답:', result);
    return result;
  } catch (error) {
    console.error('전체 푸시 요청 실패:', error);
    return null;
  }
}

// 서버에서 테스트 푸시 요청
export async function requestTestPush(token: string) {
  try {
    // Vercel 배포 URL로 변경 (실제 배포 후 URL 교체)
    const serverUrl = process.env.EXPO_PUBLIC_PUSH_SERVER_URL;
    // process.env.NODE_ENV === 'production'
    //   ? 'https://your-app-name.vercel.app'
    //   : 'http://localhost:3001';

    const response = await fetch(`${serverUrl}/api/test-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
      }),
    });

    const result = await response.json();
    console.log('테스트 푸시 응답:', result);
    return result;
  } catch (error) {
    console.error('테스트 푸시 요청 실패:', error);
    return null;
  }
}

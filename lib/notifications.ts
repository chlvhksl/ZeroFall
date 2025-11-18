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
  try {
    // projectId를 명시적으로 전달 (app.json의 extra.eas.projectId)
    const projectId = 'd0386660-2228-4773-a478-d72799d1f08d';
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    token = tokenResponse.data;
    console.log(`✅ ${Platform.OS} 푸시 토큰 발급 성공:`, token);
  } catch (tokenError: any) {
    console.error(`❌ ${Platform.OS} 푸시 토큰 발급 실패:`, tokenError);
    console.error('에러 상세:', JSON.stringify(tokenError, null, 2));

    // 에러 메시지에 따라 다른 안내
    if (tokenError.message?.includes('projectId')) {
      console.error('💡 projectId가 설정되지 않았거나 잘못되었습니다.');
    } else if (tokenError.message?.includes('network')) {
      console.error('💡 네트워크 연결을 확인하세요.');
    } else if (tokenError.message?.includes('permission')) {
      console.error('💡 알림 권한이 필요합니다.');
    } else {
      console.error(
        '💡 알 수 없는 오류입니다. Expo 프로젝트 설정을 확인하세요.',
      );
    }

    // 개발 환경에서는 임시 토큰 생성하지 않음 (null 반환)
    return null;
  }

  return token;
}

// 로컬 푸시 알림 발송
const scheduledNotiKeys: Set<string> = new Set();

export async function sendLocalNotification(
  title: string,
  body: string,
  extraData?: Record<string, any>,
) {
  // 스케줄 중복 방지(10초): device_id 기준으로 같은 알림은 건너뜀
  const deviceForKey =
    extraData?.device_id || extraData?.deviceId || extraData?.device;
  const statusForKey = extraData?.status || '';
  // 제목/본문이 달라도 같은 장비·같은 상태라면 10초 내 중복 표시 금지
  const scheduleKey = deviceForKey ? `${deviceForKey}|${statusForKey}` : null;
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
export async function logNotificationHistory(params: {
  deviceId?: string;
  status?: string;
  title: string;
  body: string;
}) {
  try {
    // device_id가 없는 알림은 기록하지 않음(중복/불명확한 소스 차단)
    if (!params.deviceId) return;
    // 클라이언트 측 중복 방지(영구 저장 기반): 10초 윈도우 내 동일 키는 무시
    const notiKey = `${params.deviceId}|${params.status || ''}|${
      params.title
    }|${params.body}`;
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
    const { error } = await supabase
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

// 알림 권한 상태 확인
export async function getNotificationPermissionStatus() {
  try {
    const permissionStatus = await Notifications.getPermissionsAsync();
    return permissionStatus.status; // 'granted', 'denied', 'undetermined'
  } catch (error) {
    console.error('권한 상태 확인 실패:', error);
    return 'undetermined';
  }
}

// 알림 권한 설정 (권한 요청)
export async function requestNotificationPermission(): Promise<{
  success: boolean;
  status: string;
  message: string;
}> {
  try {
    // 현재 권한 상태 확인
    const currentStatus = await getNotificationPermissionStatus();
    console.log('📱 현재 알림 권한 상태:', currentStatus);

    // 이미 허용된 경우
    if (currentStatus === 'granted') {
      return {
        success: true,
        status: 'granted',
        message: '알림 권한이 이미 허용되어 있습니다.',
      };
    }

    // 권한 요청
    console.log('🔔 알림 권한 요청 시작...');
    const permissionResponse = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
      android: {
        // Android 13 이상에서 POST_NOTIFICATIONS 권한 요청
      },
    });

    const finalStatus = permissionResponse.status;
    console.log('✅ 권한 요청 결과:', finalStatus);

    if (finalStatus === 'granted') {
      return {
        success: true,
        status: 'granted',
        message: '알림 권한이 허용되었습니다.',
      };
    } else if (finalStatus === 'denied') {
      // 권한이 거부된 경우 설정 앱으로 이동 안내
      Alert.alert(
        '알림 권한 필요',
        Platform.OS === 'ios'
          ? '푸시 알림을 받으려면 알림 권한이 필요합니다.\n\n설정에서 알림 권한을 허용해주세요.'
          : '푸시 알림을 받으려면 알림 권한이 필요합니다.\n\n설정에서 알림 권한을 허용한 후 앱으로 돌아오시면 자동으로 토큰을 발급받습니다.',
        [
          { text: '나중에', style: 'cancel' },
          {
            text: '설정 열기',
            onPress: async () => {
              try {
                const { Linking } = await import('react-native');
                if (Platform.OS === 'android') {
                  await Linking.openSettings();
                } else {
                  await Linking.openURL('app-settings:');
                }
              } catch (err) {
                console.error('설정 앱 열기 실패:', err);
              }
            },
          },
        ],
      );
      return {
        success: false,
        status: 'denied',
        message: '알림 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.',
      };
    } else {
      return {
        success: false,
        status: 'undetermined',
        message: '알림 권한 상태가 결정되지 않았습니다.',
      };
    }
  } catch (error) {
    console.error('❌ 권한 요청 중 오류 발생:', error);
    return {
      success: false,
      status: 'error',
      message: '알림 권한 요청 중 오류가 발생했습니다.',
    };
  }
}

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
  notiListeners.forEach(fn => {
    try {
      fn(row);
    } catch {}
  });
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
        const deviceId =
          data.device_id || data.deviceId || data.device || undefined;
        // device_id 없는 알림은 무시(테스트/기타 알림 차단)
        if (!deviceId) return;
        const now = Date.now();
        const lastAt = lastDeliveredAtByDevice[deviceId] || 0;
        if (now - lastAt < 10000) return; // 10초 내 중복 무시
        lastDeliveredAtByDevice[deviceId] = now;
        // DB 기록 + 즉시 UI 반영(emit은 logNotificationHistory에서 처리)
        const createdAt = new Date().toISOString();
        // 즉시 UI 반영
        emitNotificationHistory({
          device_id: deviceId,
          status: data.status ?? null,
          title,
          body,
          created_at: createdAt,
        });
        // DB 기록(중복 방지 로직 포함)
        logNotificationHistory({
          deviceId,
          status: data.status || null,
          title,
          body,
        });
      } catch {}
    },
  );

  // 알림 탭 시 실행될 함수
  const responseListener =
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('알림 탭:', response);
    });

  return () => {
    try {
      notificationListener.remove();
    } catch {}
    try {
      responseListener.remove();
    } catch {}
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

// 원격 푸시 알림 발송 (특정 토큰으로)
export async function sendRemotePushToToken(
  token: string,
  title: string,
  body: string,
  extraData?: Record<string, any>,
) {
  try {
    const serverUrl = process.env.EXPO_PUBLIC_PUSH_SERVER_URL;

    if (!serverUrl) {
      console.error('푸시 서버 URL이 설정되지 않았습니다.');
      return null;
    }

    const response = await fetch(`${serverUrl}/api/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        title: title,
        body: body,
        data: { timestamp: Date.now(), ...(extraData || {}) },
      }),
    });

    const result = await response.json();
    console.log('원격 푸시 발송 응답:', result);
    return result;
  } catch (error) {
    console.error('원격 푸시 발송 실패:', error);
    return null;
  }
}

// 원격 푸시 알림 발송 (현재 로그인한 사용자에게)
export async function sendRemotePush(
  title: string,
  body: string,
  extraData?: Record<string, any>,
) {
  try {
    const { supabase } = await import('./supabase');

    // 현재 로그인한 사용자 정보 가져오기
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      console.error('로그인한 사용자 정보를 찾을 수 없습니다.');
      return null;
    }

    // admin 테이블에서 푸시 토큰 가져오기
    const { data: adminData, error: fetchError } = await supabase
      .from('zerofall_admin')
      .select('push_token')
      .eq('admin_mail', user.email)
      .maybeSingle(); // .single() 대신 .maybeSingle() 사용 (결과가 없어도 에러 발생 안 함)

    if (fetchError) {
      console.error('푸시 토큰 조회 중 오류:', fetchError);
      return null;
    }

    if (!adminData?.push_token) {
      console.warn(
        '푸시 토큰이 없습니다. 로그인 시 푸시 토큰이 발급되지 않았을 수 있습니다.',
      );
      return null;
    }

    // 원격 푸시 발송
    return await sendRemotePushToToken(
      adminData.push_token,
      title,
      body,
      extraData,
    );
  } catch (error) {
    console.error('원격 푸시 발송 중 오류:', error);
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

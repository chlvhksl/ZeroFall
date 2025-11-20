import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
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

// 푸시 토큰 가져오기 (성공/실패 정보 포함)
export async function registerForPushNotificationsAsync(): Promise<{
  token: string | null;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}> {
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
    console.warn('⚠️ 알림 권한이 허용되지 않았습니다.');
    return {
      token: null,
      success: false,
      errorCode: 'PERMISSION_DENIED',
      errorMessage: '알림 권한이 필요합니다.',
    };
  }

  // 시뮬레이터 체크
  if (!Device.isDevice) {
    console.log('⚠️ 시뮬레이터에서는 실제 푸시 알림이 작동하지 않습니다.');
    console.log('📱 실제 기기에서 테스트하거나 로컬 알림을 사용하세요.');
    console.log(
      '💡 시뮬레이터에서도 서버 테스트를 원한다면 실제 기기를 사용하세요.',
    );
    token = `simulator-token-${Date.now()}`;
    return {
      token,
      success: true, // 시뮬레이터는 성공으로 처리하되, 실제 토큰은 아님
    };
  }

  // 실제 기기에서만 푸시 토큰 발급 시도
  try {
    // projectId를 app.json의 extra.eas.projectId에서 가져오기
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error('❌ projectId가 설정되지 않았습니다.');
      console.error('💡 app.json의 extra.eas.projectId를 확인하세요.');
      return {
        token: null,
        success: false,
        errorCode: 'PROJECT_ID_MISSING',
        errorMessage: '프로젝트 ID가 설정되지 않았습니다.',
      };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    token = tokenResponse.data;
    console.log(`✅ ${Platform.OS} 푸시 토큰 발급 성공:`, token);
    return {
      token,
      success: true,
    };
  } catch (tokenError: any) {
    console.error(`❌ ${Platform.OS} 푸시 토큰 발급 실패:`, tokenError);
    console.error('에러 상세:', JSON.stringify(tokenError, null, 2));

    // 에러 코드에 따른 구체적인 안내
    const errorCode = tokenError.code || 'UNKNOWN_ERROR';
    let errorMessage = '푸시 토큰 발급에 실패했습니다.';

    if (errorCode === 'E_REGISTRATION_FAILED') {
      console.error('❌ 푸시 토큰 등록 실패 (E_REGISTRATION_FAILED)');
      console.error('💡 가능한 원인:');
      console.error('   1. Google Play Services가 설치/업데이트되지 않음');
      console.error('   2. FCM (Firebase Cloud Messaging) 설정 문제');
      console.error('   3. 네트워크 연결 문제');
      console.error(
        '   4. 로컬 빌드는 EAS 빌드와 달리 FCM 자동 설정이 안 될 수 있음',
      );
      console.error('💡 해결 방법:');
      console.error('   - Google Play Services 업데이트 확인');
      console.error('   - EAS 빌드(preview/development) 사용 권장');
      console.error('   - 네트워크 연결 확인');
      errorMessage =
        '푸시 토큰 등록 실패\n\n가능한 원인:\n- Google Play Services 문제\n- FCM 설정 문제\n- 네트워크 연결 문제';
    } else if (tokenError.message?.includes('projectId')) {
      console.error('💡 projectId가 설정되지 않았거나 잘못되었습니다.');
      errorMessage = '프로젝트 ID 설정 오류';
    } else if (tokenError.message?.includes('network')) {
      console.error('💡 네트워크 연결을 확인하세요.');
      errorMessage = '네트워크 연결 오류';
    } else if (tokenError.message?.includes('permission')) {
      console.error('💡 알림 권한이 필요합니다.');
      errorMessage = '알림 권한이 필요합니다';
    } else {
      console.error(
        '💡 알 수 없는 오류입니다. Expo 프로젝트 설정을 확인하세요.',
      );
      console.error('💡 에러 코드:', errorCode);
      errorMessage = `알 수 없는 오류 (코드: ${errorCode})`;
    }

    return {
      token: null,
      success: false,
      errorCode,
      errorMessage,
    };
  }
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

// 서버에 푸시 토큰 등록 (더 이상 필요 없음 - Supabase에 직접 저장)
// 이 함수는 하위 호환성을 위해 유지하지만, 실제로는 Supabase에 직접 저장됨
export async function registerTokenToServer(token: string) {
  try {
    const { supabase } = await import('./supabase');

    // 현재 로그인한 사용자 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      console.log('ℹ️ 로그인된 사용자가 없어 토큰을 서버에 저장하지 않습니다.');
      return null;
    }
    const { error: adminError } = await supabase
      .from('zerofall_admin')
      .select('*')
      .eq('admin_mail', user.email)
      .maybeSingle(); // .single() 대신 .maybeSingle() 사용

    console.log('???????', user);
    if (adminError) {
      console.error('❌ Supabase에서 사용자 조회 실패:', adminError);
      return null;
    }

    // zerofall_admin 테이블에 토큰 삽입
    const { first_name, last_name, affiliation } = user.user_metadata;
    const { error, data } = await supabase.from('zerofall_admin').upsert([
      {
        admin_id: user.id,
        push_token: token,
        admin_name: `${first_name}${last_name}`,
        admin_aff: affiliation,
        admin_mail: user.email,
      },
    ]);
    console.log('insertytttt', error, data);

    return {
      success: true,
      message: 'Supabase에 토큰이 저장되었습니다.',
    };
  } catch (error) {
    console.error('토큰 등록 실패:', error);
    return null;
  }
}

// Supabase Edge Function URL 가져오기
function getSupabaseFunctionUrl(functionName: string): string {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://your-project-id.supabase.co';
  // Supabase Edge Functions URL 형식: https://{project-ref}.supabase.co/functions/v1/{function-name}
  return `${supabaseUrl}/functions/v1/${functionName}`;
}

// 원격 푸시 알림 발송 (특정 토큰으로)
export async function sendRemotePushToToken(
  token: string,
  title: string,
  body: string,
  extraData?: Record<string, any>,
) {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase 설정이 올바르지 않습니다.');
      return null;
    }

    const functionUrl = getSupabaseFunctionUrl('send-push');

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
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
    const { supabase } = await import('./supabase');
    const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

    // 모든 admin의 푸시 토큰 조회
    const { data: adminData, error: fetchError } = await supabase
      .from('zerofall_admin')
      .select('push_token, admin_mail')
      .not('push_token', 'is', null);

    const pushTokens = adminData?.map(admin => admin.push_token);

    const message = {
      to: pushTokens,
      sound: 'default',
      title: title,
      body: body,
      data: { broadcast: true, timestamp: Date.now() },
    };

    const pushResponse = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    console.log('pushTokens', pushTokens, pushResponse);

    const result = await pushResponse.json();
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
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase 설정이 올바르지 않습니다.');
      return null;
    }

    const functionUrl = getSupabaseFunctionUrl('test-push');

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
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

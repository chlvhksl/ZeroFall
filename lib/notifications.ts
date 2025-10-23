import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

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

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('알림 권한 필요', '푸시 알림 권한이 필요합니다!');
      return;
    }
    
    // 개발 환경에서는 projectId 없이 토큰 발급 (로컬 알림용)
    // 실제 배포 시에는 Expo 프로젝트 ID 필요
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (tokenError) {
      console.log('Expo 푸시 토큰 발급 실패 (개발 환경에서는 정상):', tokenError);
      // 개발 환경에서는 임시 토큰 생성
      token = `dev-token-${Date.now()}`;
    }
    
    console.log('푸시 토큰:', token);
  } else {
    Alert.alert('알림', '실제 기기에서만 푸시 알림을 사용할 수 있습니다.');
  }

  return token;
}

// 로컬 푸시 알림 발송
export async function sendLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      sound: true,
      data: { timestamp: Date.now() },
    },
    trigger: null, // 즉시 발송
  });
}


import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from './notifications';
import { supabase } from './supabase';

const LOCAL_TOKEN_KEY = '@push_token';
const TOKEN_TIMESTAMP_KEY = '@push_token_timestamp';

export class PushTokenManager {
  /**
   * 토큰 갱신이 필요한지 확인
   */
  static async shouldUpdateToken(
    localToken: string | null,
    serverToken: string | null,
  ): Promise<boolean> {
    // 1. 서버에 토큰이 없으면 무조건 갱신
    if (!serverToken) {
      console.log('🔄 서버 토큰 없음 - 갱신 필요');
      return true;
    }

    // 2. 로컬에 토큰이 없으면 무조건 갱신
    if (!localToken) {
      console.log('🔄 로컬 토큰 없음 - 갱신 필요');
      return true;
    }

    // 3. 로컬과 서버 토큰이 다르면 갱신 (기기 변경 등)
    if (localToken !== serverToken) {
      console.log('🔄 토큰 불일치 - 갱신 필요');
      console.log('로컬:', localToken.substring(0, 30) + '...');
      console.log('서버:', serverToken.substring(0, 30) + '...');
      return true;
    }

    // 4. 토큰이 오래되었으면 갱신 (7일 기준)
    const tokenAge = await this.getTokenAge();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7일 (FCM/APNs 안전 주기)

    if (tokenAge > maxAge) {
      const days = Math.floor(tokenAge / (24 * 60 * 60 * 1000));
      console.log(`🔄 토큰 만료 (${days}일 경과) - 갱신 필요`);
      return true;
    }

    // 5. 모든 조건 통과 - 갱신 불필요
    console.log('✅ 토큰 유효 - 갱신 불필요');
    return false;
  }

  /**
   * 토큰 나이 확인 (밀리초)
   */
  static async getTokenAge(): Promise<number> {
    try {
      const timestamp = await AsyncStorage.getItem(TOKEN_TIMESTAMP_KEY);
      if (!timestamp) return Infinity; // 타임스탬프 없으면 매우 오래된 것으로 간주

      return Date.now() - parseInt(timestamp);
    } catch (error) {
      console.error('❌ 토큰 나이 확인 실패:', error);
      return Infinity;
    }
  }

  /**
   * 로컬 토큰 저장
   */
  static async saveLocalToken(token: string): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [LOCAL_TOKEN_KEY, token],
        [TOKEN_TIMESTAMP_KEY, Date.now().toString()],
      ]);
      console.log('✅ 로컬 토큰 저장 완료');
    } catch (error) {
      console.error('❌ 로컬 토큰 저장 실패:', error);
    }
  }

  /**
   * 로컬 토큰 조회
   */
  static async getLocalToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LOCAL_TOKEN_KEY);
    } catch (error) {
      console.error('❌ 로컬 토큰 조회 실패:', error);
      return null;
    }
  }

  /**
   * 완전 통합 토큰 관리 (토큰 발급 + DB 저장 + 로컬 저장)
   */
  static async manageTokenComplete(userId: string): Promise<{
    success: boolean;
    token?: string;
    action: 'updated' | 'kept' | 'failed';
    message: string;
  }> {
    try {
      console.log('🔍 통합 토큰 관리 시작 - 사용자:', userId);

      // 1. 현재 로컬 토큰 조회
      const localToken = await this.getLocalToken();

      // 2. 서버에서 기존 토큰 조회
      const { data: userData, error: fetchError } = await supabase
        .from('zerofall_admin')
        .select('push_token')
        .eq('admin_id', userId)
        .single();

      if (fetchError) {
        console.error('❌ 서버 토큰 조회 실패:', fetchError);
        return {
          success: false,
          action: 'failed',
          message: '서버 토큰 조회 실패',
        };
      }

      const serverToken = userData?.push_token;

      // 3. 토큰 갱신 필요성 판단
      const needsUpdate = await this.shouldUpdateToken(localToken, serverToken);

      if (!needsUpdate && serverToken) {
        // 토큰 갱신 불필요 - 로컬만 동기화
        await this.saveLocalToken(serverToken);
        console.log('✅ 기존 토큰 유지:', serverToken.substring(0, 30) + '...');
        return {
          success: true,
          token: serverToken,
          action: 'kept',
          message: '기존 토큰 유지',
        };
      }

      // 4. 새 토큰 발급
      console.log('🔄 새 토큰 발급 시작...');
      const newTokenResult = await registerForPushNotificationsAsync();

      if (!newTokenResult.success || !newTokenResult.token) {
        console.error('❌ 토큰 발급 실패:', newTokenResult.error);
        return {
          success: false,
          action: 'failed',
          message: newTokenResult.error || '토큰 발급 실패',
        };
      }

      const newToken = newTokenResult.token;
      console.log('✅ 새 토큰 발급 완료:', newToken.substring(0, 30) + '...');

      // 5. DB에 새 토큰 저장
      const dbResult = await this.updateTokenInDB(userId, newToken);
      if (!dbResult.success) {
        return {
          success: false,
          action: 'failed',
          message: dbResult.error || 'DB 저장 실패',
        };
      }

      // 6. 로컬에 새 토큰 저장
      await this.saveLocalToken(newToken);

      console.log('🎉 토큰 갱신 완료 (DB + 로컬)');
      return {
        success: true,
        token: newToken,
        action: 'updated',
        message: '토큰 갱신 완료',
      };
    } catch (error) {
      console.error('❌ 통합 토큰 관리 실패:', error);
      return {
        success: false,
        action: 'failed',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * DB에 토큰 업데이트
   */
  static async updateTokenInDB(
    userId: string,
    token: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await supabase
        .from('zerofall_admin')
        .update({
          push_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq('admin_id', userId);

      if (error) {
        console.error('❌ DB 토큰 업데이트 실패:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log('✅ DB 토큰 업데이트 성공');
      return { success: true };
    } catch (error) {
      console.error('❌ DB 토큰 업데이트 예외:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * DB에서 사용자 토큰 조회
   */
  static async getTokenFromDB(userId: string): Promise<{
    success: boolean;
    token?: string | null;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('zerofall_admin')
        .select('push_token')
        .eq('admin_id', userId)
        .single();

      if (error) {
        console.error('❌ DB 토큰 조회 실패:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        token: data?.push_token,
      };
    } catch (error) {
      console.error('❌ DB 토큰 조회 예외:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 토큰 강제 갱신 (재설치 등)
   */
  static async forceRefreshToken(userId: string): Promise<boolean> {
    try {
      console.log('🔄 토큰 강제 갱신 시작');

      // 로컬 토큰 삭제
      await AsyncStorage.multiRemove([LOCAL_TOKEN_KEY, TOKEN_TIMESTAMP_KEY]);

      // 새 토큰 발급 및 저장 (통합 버전 사용)
      const result = await this.manageTokenComplete(userId);

      return result.success;
    } catch (error) {
      console.error('❌ 토큰 강제 갱신 실패:', error);
      return false;
    }
  }
}

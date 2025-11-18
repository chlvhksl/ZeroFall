// Supabase Edge Function: 테스트 푸시 알림 발송
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

interface TestPushRequest {
  token: string;
}

serve(async (req) => {
  // CORS 헤더 설정
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { token } = (await req.json()) as TestPushRequest;

    // 입력 검증
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '토큰이 필요합니다.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // 시뮬레이터 토큰 체크
    if (token.startsWith('simulator-token-')) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '시뮬레이터에서는 실제 푸시 알림을 발송할 수 없습니다.',
          token: token,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // 테스트 푸시 메시지
    const testData = {
      timestamp: Date.now(),
      type: 'test',
      from: 'ZeroFall Server',
    };

    const message = {
      to: token,
      sound: 'default',
      title: '🧪 테스트 푸시 알림',
      body: 'Supabase Edge Function에서 발송한 테스트 알림입니다!',
      data: testData,
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

    const pushResult = await pushResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: '테스트 푸시 알림이 발송되었습니다.',
        data: pushResult,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (error) {
    console.error('테스트 푸시 알림 발송 실패:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: '테스트 푸시 알림 발송 실패',
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
});


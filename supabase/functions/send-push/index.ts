// Supabase Edge Function: 개별 푸시 알림 발송
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

interface PushRequest {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
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
    const { token, title, body, data } = (await req.json()) as PushRequest;

    // 입력 검증
    if (!token || !title || !body) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '토큰, 제목, 내용은 필수입니다.',
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

    // Expo Push API로 푸시 발송
    const message = {
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data || {},
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
        message: '푸시 알림이 발송되었습니다.',
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
    console.error('푸시 알림 발송 실패:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: '푸시 알림 발송 실패',
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


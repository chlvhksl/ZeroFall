// Supabase Edge Function: 전체 공지 푸시 알림 발송
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

interface BroadcastRequest {
  title: string;
  body: string;
  data?: Record<string, any>;
}

serve(async req => {
  // CORS 헤더 설정
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { title, body, data } = (await req.json()) as BroadcastRequest;

    // 입력 검증
    if (!title || !body) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '제목과 내용은 필수입니다.',
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

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Supabase 설정이 올바르지 않습니다.',
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

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 모든 admin의 푸시 토큰 조회
    const { data: adminData, error: fetchError } = await supabase
      .from('zerofall_admin')
      .select('push_token, admin_mail')
      .not('push_token', 'is', null);

    if (fetchError) {
      console.error('Supabase에서 토큰 조회 실패:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          message: '푸시 토큰 조회 실패',
          error: fetchError.message,
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

    // null이 아닌 푸시 토큰만 필터링
    const tokens = (adminData || [])
      .filter(admin => admin.push_token && admin.push_token.trim() !== '')
      .map(admin => ({
        token: admin.push_token,
        email: admin.admin_mail,
      }));

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '등록된 푸시 토큰이 없습니다.',
          totalTokens: 0,
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

    console.log(`📢 모든 사용자에게 푸시 발송 시작 (${tokens.length}명)`);

    // 모든 토큰에 순차적으로 푸시 발송
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const tokenData of tokens) {
      try {
        // 시뮬레이터 토큰 체크
        if (tokenData.token.startsWith('simulator-token-')) {
          failCount++;
          results.push({
            email: tokenData.email || 'unknown',
            token: tokenData.token.substring(0, 20) + '...',
            success: false,
            error: '시뮬레이터 토큰',
          });
          continue;
        }

        const message = {
          to: tokenData.token,
          sound: 'default',
          title: title,
          body: body,
          data: { ...(data || {}), broadcast: true, timestamp: Date.now() },
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

        if (pushResult.data?.status === 'ok') {
          successCount++;
        } else {
          failCount++;
        }

        results.push({
          email: tokenData.email || 'unknown',
          token: tokenData.token.substring(0, 20) + '...',
          success: pushResult.data?.status === 'ok',
        });
      } catch (error) {
        failCount++;
        results.push({
          email: tokenData.email || 'unknown',
          token: tokenData.token.substring(0, 20) + '...',
          success: false,
          error: error.message,
        });
      }
    }

    console.log(
      `📊 푸시 발송 완료: 성공 ${successCount}개, 실패 ${failCount}개`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `모든 사용자에게 푸시 알림을 발송했습니다.`,
        totalTokens: tokens.length,
        successCount: successCount,
        failCount: failCount,
        results: results,
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
    console.error('전체 푸시 발송 실패:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: '전체 푸시 발송 실패',
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

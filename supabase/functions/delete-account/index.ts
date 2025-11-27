// Supabase Edge Function: 계정 완전 삭제
// 사용자의 Supabase Auth 계정 및 관련 데이터를 모두 삭제합니다.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log('📥 [delete-account] 계정 삭제 요청 수신');

    // 인증 토큰 확인
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '인증 토큰이 필요합니다.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Supabase 클라이언트 생성 (Service Role Key 사용 - Admin 권한 필요)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [delete-account] Supabase 환경 변수가 설정되지 않았습니다.');
      return new Response(
        JSON.stringify({
          success: false,
          message: '서버 설정 오류',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Service Role Key로 Admin 클라이언트 생성
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 사용자 인증 확인 (일반 클라이언트로 토큰 검증)
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('❌ [delete-account] 사용자 인증 실패:', userError);
      return new Response(
        JSON.stringify({
          success: false,
          message: '인증에 실패했습니다.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const userId = user.id;
    console.log('✅ [delete-account] 사용자 인증 성공:', userId);

    // 1. admin_sites 테이블에서 사용자 데이터 삭제
    console.log('🗑️ [delete-account] admin_sites 테이블에서 삭제 중...');
    const { error: adminSitesError } = await supabaseAdmin
      .from('admin_sites')
      .delete()
      .eq('admin_id', userId);

    if (adminSitesError) {
      console.warn('⚠️ [delete-account] admin_sites 삭제 실패:', adminSitesError);
      // 계속 진행 (다른 데이터는 삭제)
    } else {
      console.log('✅ [delete-account] admin_sites 삭제 완료');
    }

    // 2. zerofall_admin 테이블에서 사용자 데이터 삭제
    console.log('🗑️ [delete-account] zerofall_admin 테이블에서 삭제 중...');
    const { error: adminError } = await supabaseAdmin
      .from('zerofall_admin')
      .delete()
      .eq('admin_id', userId);

    if (adminError) {
      console.warn('⚠️ [delete-account] zerofall_admin 삭제 실패:', adminError);
      // 계속 진행
    } else {
      console.log('✅ [delete-account] zerofall_admin 삭제 완료');
    }

    // 3. notification_history에서 사용자 관련 알림 삭제 (선택적)
    // admin_id가 있는 경우만 삭제 (없으면 스킵)
    console.log('🗑️ [delete-account] notification_history에서 삭제 중...');
    const { error: notificationError } = await supabaseAdmin
      .from('notification_history')
      .delete()
      .eq('admin_id', userId);

    if (notificationError) {
      console.warn('⚠️ [delete-account] notification_history 삭제 실패:', notificationError);
      // 계속 진행
    } else {
      console.log('✅ [delete-account] notification_history 삭제 완료');
    }

    // 4. Supabase Auth에서 사용자 계정 삭제 (Admin API 사용)
    console.log('🗑️ [delete-account] Supabase Auth 계정 삭제 중...');
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('❌ [delete-account] Auth 계정 삭제 실패:', deleteUserError);
      return new Response(
        JSON.stringify({
          success: false,
          message: '계정 삭제에 실패했습니다.',
          error: deleteUserError.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('✅ [delete-account] Supabase Auth 계정 삭제 완료');

    // 5. 사용자가 만든 현장(sites) 삭제
    // creator_id가 userId인 현장 조회 및 삭제
    console.log('🗑️ [delete-account] 사용자가 만든 현장 조회 중...');
    const { data: createdSites, error: sitesError } = await supabaseAdmin
      .from('sites')
      .select('id, name')
      .eq('creator_id', userId);

    if (sitesError) {
      console.warn('⚠️ [delete-account] 생성한 현장 조회 실패:', sitesError);
    } else if (createdSites && createdSites.length > 0) {
      console.log(`🗑️ [delete-account] 사용자가 만든 현장 ${createdSites.length}개 발견 - 삭제 시작`);
      
      // 각 현장 삭제 (CASCADE로 admin_sites, gori_status 등 관련 데이터도 자동 삭제됨)
      for (const site of createdSites) {
        const { error: deleteSiteError } = await supabaseAdmin
          .from('sites')
          .delete()
          .eq('id', site.id);
        
        if (deleteSiteError) {
          console.warn(`⚠️ [delete-account] 현장 삭제 실패 (${site.name}):`, deleteSiteError);
        } else {
          console.log(`✅ [delete-account] 현장 삭제 완료: ${site.name}`);
        }
      }
      
      console.log(`✅ [delete-account] 총 ${createdSites.length}개 현장 삭제 완료`);
    } else {
      console.log('ℹ️ [delete-account] 사용자가 만든 현장이 없습니다.');
    }

    console.log('✅ [delete-account] 계정 삭제 완료:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: '계정이 성공적으로 삭제되었습니다.',
        userId: userId,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('❌ [delete-account] 계정 삭제 중 오류:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: '계정 삭제 중 오류가 발생했습니다.',
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});


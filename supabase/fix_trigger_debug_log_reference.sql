-- trigger_debug_log 테이블 참조 제거
-- gori_status 테이블의 트리거 함수에서 trigger_debug_log 참조를 제거합니다.

-- 1. 현재 트리거 함수 확인
DO $$
BEGIN
  RAISE NOTICE '현재 notify_unsecured_alert 함수 확인 중...';
END $$;

-- 2. 트리거 함수 재생성 (trigger_debug_log 참조 제거)
CREATE OR REPLACE FUNCTION notify_unsecured_alert()
RETURNS TRIGGER AS $$
DECLARE
  http_request_id BIGINT;
BEGIN
  -- 미체결 상태로 전환된 경우에만 알림 발송
  -- INSERT: NEW.status가 '미체결'이면 발송
  -- UPDATE: NEW.status가 '미체결'이고 OLD.status가 '미체결'이 아니면 발송
  IF NEW.status = '미체결' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM '미체결'))) THEN
    -- Edge Function 호출
    -- 참고: Supabase 프로젝트 URL과 Service Role Key를 직접 입력해야 합니다
    -- Supabase Dashboard > Settings > API에서 확인 가능
    SELECT net.http_post(
      url := 'https://lvbzmydsduzqjzyaurpu.supabase.co/functions/v1/notify-unsecured',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_cbHtJV-N6CcN8h9WB7hzYw_P6VJ5-S_'
      ),
      body := jsonb_build_object(
        'device_id', NEW.device_id,
        'status', NEW.status,
        'left_sensor', NEW.left_sensor,
        'right_sensor', NEW.right_sensor,
        'worker_name', NEW.worker_name,
        'timestamp', NEW.updated_at
      )
    ) INTO http_request_id;
    
    RAISE NOTICE '미체결 알림 요청 전송: device_id=%, http_request_id=%', NEW.device_id, http_request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거 확인 및 재생성
DROP TRIGGER IF EXISTS trigger_notify_unsecured ON gori_status;

CREATE TRIGGER trigger_notify_unsecured
  AFTER INSERT OR UPDATE ON gori_status
  FOR EACH ROW
  WHEN (NEW.status = '미체결')
  EXECUTE FUNCTION notify_unsecured_alert();

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 트리거 함수 수정 완료: trigger_debug_log 참조 제거됨';
END $$;


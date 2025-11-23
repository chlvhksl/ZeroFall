-- 트리거 및 푸시 알림 상태 확인

-- 1. 트리거 존재 여부 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'gori_status'
  AND trigger_name = 'trigger_notify_unsecured';

-- 2. 트리거 함수 확인
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'notify_unsecured_alert';

-- 3. 최근 gori_status 변경 내역 확인
SELECT 
  device_id,
  status,
  left_sensor,
  right_sensor,
  worker_name,
  updated_at,
  created_at
FROM gori_status
ORDER BY updated_at DESC
LIMIT 10;

-- 4. HTTP 요청 큐 확인 (트리거가 HTTP 요청을 보냈는지)
SELECT 
  id,
  method,
  url,
  headers,
  body,
  status_code,
  error_msg
FROM net.http_request_queue
ORDER BY id DESC
LIMIT 10;

-- 5. 푸시 토큰 등록 상태 확인
SELECT 
  admin_id,
  admin_name,
  admin_mail,
  CASE 
    WHEN push_token IS NULL THEN '토큰 없음'
    WHEN push_token LIKE 'simulator-token-%' THEN '시뮬레이터 토큰'
    ELSE '실제 토큰'
  END as token_status,
  LENGTH(push_token) as token_length
FROM zerofall_admin
ORDER BY updated_at DESC;

-- 6. notification_history 확인 (알림 발송 내역)
SELECT 
  id,
  device_id,
  title,
  body,
  status,
  created_at
FROM notification_history
ORDER BY created_at DESC
LIMIT 10;


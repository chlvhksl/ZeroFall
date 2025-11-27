-- gori_status 테이블에 reset_wifi_flag 컬럼 추가
ALTER TABLE gori_status 
ADD COLUMN IF NOT EXISTS reset_wifi_flag BOOLEAN DEFAULT false;

-- 인덱스 추가 (선택사항, 성능 향상)
CREATE INDEX IF NOT EXISTS idx_gori_status_reset_wifi_flag 
ON gori_status(device_id) 
WHERE reset_wifi_flag = true;

-- 주석 추가
COMMENT ON COLUMN gori_status.reset_wifi_flag IS 'WiFi 재설정 플래그: true이면 아두이노가 AP 모드로 전환됨';



-- notification_history 테이블에 site_id 컬럼 추가
ALTER TABLE notification_history
ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;

-- 기존 데이터의 site_id 채우기 (gori_status에서 조회)
UPDATE notification_history nh
SET site_id = (
  SELECT gs.site_id
  FROM gori_status gs
  WHERE gs.device_id = nh.device_id
    AND gs.worker_name IS NOT NULL
  ORDER BY gs.updated_at DESC
  LIMIT 1
)
WHERE nh.site_id IS NULL;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_notification_history_site_id 
ON notification_history(site_id);

CREATE INDEX IF NOT EXISTS idx_notification_history_device_id 
ON notification_history(device_id);


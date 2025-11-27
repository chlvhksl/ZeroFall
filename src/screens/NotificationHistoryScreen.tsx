/**
 * 알림 내역 화면
 *
 * 기능:
 * - 최근 상태 기록 조회
 * - Realtime으로 실시간 업데이트
 * - 장비별 상태 기록 표시
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n-safe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addNotificationHistoryListener } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import { formatKoreaTime } from '../../lib/utils';
import { useLocalDevice } from '../context/LocalDeviceContext';
import { useFontByLanguage } from '../../lib/fontUtils-safe';
import { getSelectedSite } from '../../lib/siteManagement';

type NotificationRow = {
  id: number;
  created_at: string;
  device_id: string | null;
  title: string | null;
  body: string | null;
  status: string | null;
};

export default function NotificationHistoryScreen() {
  const { t } = useTranslation();
  const fonts = useFontByLanguage();
  const insets = useSafeAreaInsets();
  const { status: localConnStatus } = useLocalDevice();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [rtConnected, setRtConnected] = useState(false);
  const [workerNames, setWorkerNames] = useState<{ [deviceId: string]: string }>({});

  useEffect(() => {
    let channel: any | null = null;
    let offLocal: (() => void) | null = null;

    const fetchInitial = async () => {
      try {
        // 현재 선택된 현장 가져오기
        const selectedSite = await getSelectedSite();
        const selectedSiteId = selectedSite?.id || null;
        
        // 현장별 장비 필터링: 현재 현장의 장비 ID 목록 가져오기
        let allowedDeviceIds: string[] = [];
        if (selectedSiteId) {
          const { data: deviceData, error: deviceError } = await supabase
            .from('gori_status')
            .select('device_id, site_id')
            .eq('site_id', selectedSiteId); // 명확하게 선택한 현장의 장비만 가져오기
          
          if (deviceError) {
            console.error('장비 목록 가져오기 실패:', deviceError);
          } else if (deviceData) {
            // 현장 필터링: 선택한 현장의 장비만 허용
            allowedDeviceIds = deviceData
              .filter(row => row.site_id === selectedSiteId)
              .map(row => row.device_id)
              .filter(Boolean);
          }
        }
        
        // 알림 가져오기
        let query = supabase
          .from<NotificationRow>('notification_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50); // 필터링 전에 더 많이 가져오기
        
        const { data, error } = await query;
        if (error) throw error;
        
        // 현장 필터링 적용
        let filteredData = data || [];
        if (selectedSiteId && allowedDeviceIds.length > 0) {
          filteredData = filteredData.filter(item => 
            !item.device_id || allowedDeviceIds.includes(item.device_id)
          );
        } else if (selectedSiteId) {
          // 현장이 선택되었지만 해당 현장의 장비가 없으면 빈 배열
          filteredData = [];
        }
        
        // 최대 30개로 제한
        filteredData = filteredData.slice(0, 30);
        setItems(filteredData);
        
        // 작업자 이름 가져오기
        const deviceIds = [...new Set(filteredData.map(item => item.device_id).filter(Boolean))];
        if (deviceIds.length > 0) {
          const { data: workerData, error: workerError } = await supabase
            .from('gori_status')
            .select('device_id, worker_name')
            .in('device_id', deviceIds);
          
          if (workerError) {
            console.error('작업자 이름 가져오기 실패:', workerError);
          }
          
          if (workerData) {
            const workerMap: { [deviceId: string]: string } = {};
            workerData.forEach(item => {
              if (item.device_id && item.worker_name) {
                workerMap[item.device_id] = item.worker_name;
              }
            });
            console.log('작업자 이름 로드 완료:', workerMap);
            setWorkerNames(workerMap);
          }
        }
      } catch (e) {
        console.error('Notification history fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    channel = supabase
      .channel('notification_history_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_history' },
        async payload => {
          const row = payload.new as NotificationRow;
          
          // 현장 필터링: 현재 선택된 현장의 장비 알림만 추가
          const selectedSite = await getSelectedSite();
          const selectedSiteId = selectedSite?.id || null;
          
          if (row.device_id) {
            // 장비가 있는 알림만 현장 필터링 적용
            if (selectedSiteId) {
              const { data: deviceData } = await supabase
                .from('gori_status')
                .select('device_id, site_id')
                .eq('device_id', row.device_id)
                .single();
              
              if (deviceData) {
                // site_id가 NULL이거나 선택한 현장과 일치하지 않으면 무시
                if (!deviceData.site_id || deviceData.site_id !== selectedSiteId) {
                  console.log('🚫 [NotificationHistory] 다른 현장의 알림 무시:', deviceData.site_id, 'vs', selectedSiteId);
                  return; // 다른 현장의 알림은 무시
                }
              } else {
                // 장비 정보를 찾을 수 없으면 무시
                return;
              }
            }
          }
          
          setItems(prev => [row, ...prev].slice(0, 30));
          
          // 새 알림의 작업자 이름 가져오기
          if (row.device_id && !workerNames[row.device_id]) {
            try {
              const { data } = await supabase
                .from('gori_status')
                .select('device_id, worker_name')
                .eq('device_id', row.device_id)
                .single();
              
              if (data && data.worker_name) {
                setWorkerNames(prev => ({
                  ...prev,
                  [row.device_id!]: data.worker_name,
                }));
              }
            } catch (error) {
              console.error('작업자 이름 가져오기 실패:', error);
            }
          }
        },
      )
      .subscribe(status => setRtConnected(status === 'SUBSCRIBED'));

    fetchInitial();

    // 즉시 반영: 앱 내 수신 이벤트를 상단에 삽입(Realtime 올 때는 필터로 중복 숨김)
    offLocal = addNotificationHistoryListener(async (row: any) => {
      // 현장 필터링: 현재 선택된 현장의 장비 알림만 추가
      if (row.device_id) {
        const selectedSite = await getSelectedSite();
        const selectedSiteId = selectedSite?.id || null;
        
        if (selectedSiteId) {
          const { data: deviceData } = await supabase
            .from('gori_status')
            .select('device_id, site_id')
            .eq('device_id', row.device_id)
            .single();
          
          if (deviceData) {
            // site_id가 NULL이거나 선택한 현장과 일치하지 않으면 무시
            if (!deviceData.site_id || deviceData.site_id !== selectedSiteId) {
              return; // 다른 현장의 알림은 무시
            }
          } else {
            // 장비 정보를 찾을 수 없으면 무시
            return;
          }
        }
      }
      
      setItems(prev =>
        [
          {
            id: Math.floor(Math.random() * 1e9),
            created_at: row.created_at || new Date().toISOString(),
            device_id: row.device_id ?? null,
            title: row.title ?? t('notification.title'),
            body: row.body ?? null,
            status: row.status ?? null,
          },
          ...prev,
        ].slice(0, 30),
      );
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (offLocal) offLocal();
    };
  }, [t]);

  // 알림 제목과 본문을 현재 언어로 번역
  const getNotificationDisplayText = (title: string | null, body: string | null, deviceId: string | null) => {
    if (!title && !body) {
      return { title: t('notification.title'), body: '' };
    }

    const titleStr = title || '';
    let bodyStr = body || '';

    // 작업자 이름 가져오기 (우선순위: workerNames > 본문에서 추출)
    let workerName = '';
    
    // 1. workerNames에서 가져오기 (가장 확실한 방법)
    if (deviceId && workerNames[deviceId]) {
      workerName = workerNames[deviceId];
    }
    
    // 2. 본문에서 작업자 이름 추출 시도 (다양한 언어 패턴 지원)
    if (!workerName) {
      const workerPatterns = [
        /작업자\s*['"]?([^'"{]+)['"]?\s*고리/,  // 한국어: 작업자 '이름' 고리
        /Worker\s*['"]?([^'"{]+)['"]?\s*hook/i,  // 영어: Worker 'name' hook
        /作業者\s*['"]?([^'"{]+)['"]?\s*フック/,  // 일본어
        /工人\s*['"]?([^'"{]+)['"]?\s*钩/,       // 중국어 간체
        /工人\s*['"]?([^'"{]+)['"]?\s*鉤/,       // 중국어 번체
        /Trabajador\s*['"]?([^'"{]+)['"]?\s*gancho/i,  // 스페인어
        /Travailleur\s*['"]?([^'"{]+)['"]?\s*accroche/i,  // 프랑스어
        /Arbeiter\s*['"]?([^'"{]+)['"]?\s*Haken/i,  // 독일어
        /Lavoratore\s*['"]?([^'"{]+)['"]?\s*gancio/i,  // 이탈리아어
        /Trabalhador\s*['"]?([^'"{]+)['"]?\s*gancho/i,  // 포르투갈어
        /Рабочий\s*['"]?([^'"{]+)['"]?\s*крюк/i,   // 러시아어
      ];

      for (const pattern of workerPatterns) {
        const match = (titleStr + ' ' + bodyStr).match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim();
          // {worker} 플레이스홀더가 아닌 실제 이름인지 확인
          if (extracted && extracted !== '{worker}' && extracted !== '{{worker}}' && !extracted.includes('{')) {
            workerName = extracted;
            break;
          }
        }
      }
    }

    // 장비 이름 추출 (제목에서)
    let deviceName = '';
    const devicePatterns = [
      /['"]([^'"]+)['"]\s*안전고리/,  // 한국어: '이름' 안전고리
      /['"]([^'"]+)['"]\s*safety\s*hook/i,  // 영어
      /['"]([^'"]+)['"]\s*安全フック/,  // 일본어
      /['"]([^'"]+)['"]\s*安全钩/,     // 중국어 간체
      /['"]([^'"]+)['"]\s*安全鉤/,     // 중국어 번체
    ];
    for (const pattern of devicePatterns) {
      const match = titleStr.match(pattern);
      if (match && match[1]) {
        deviceName = match[1].trim();
        break;
      }
    }

    // 알림 타입 판별 및 번역
    let translatedTitle = titleStr;
    let translatedBody = bodyStr;

    // 미체결 경고 알림인지 확인
    const isUnfastenedAlert = titleStr.includes('미체결') || titleStr.includes('Unfastened') || 
        titleStr.includes('未締結') || titleStr.includes('未系') ||
        titleStr.includes('Desenganchado') || titleStr.includes('Déconnecté') ||
        titleStr.includes('Losgelöst') || titleStr.includes('Scollegato') ||
        titleStr.includes('Desconectado') || titleStr.includes('Отключено');

    if (isUnfastenedAlert) {
      // 미체결 경고 알림
      // 제목: 작업자 이름이 있으면 alertTitle 사용, 없으면 unfastenedWarning 사용
      if (workerName) {
        translatedTitle = i18n.t('notification.alertTitle', { name: workerName });
      } else {
        translatedTitle = t('notification.unfastenedWarning');
      }
      
      // 본문: 항상 alertBody 사용 (작업자 이름 포함하지 않음)
      translatedBody = t('notification.alertBody');
    } else {
      // 다른 알림 타입: 본문의 {worker} 플레이스홀더 직접 치환
      if (workerName) {
        // 모든 {worker} 패턴 치환
        translatedBody = bodyStr
          .replace(/\{worker\}/g, workerName)
          .replace(/\{\{worker\}\}/g, workerName)
          .replace(/"\{worker\}"/g, `"${workerName}"`)
          .replace(/'\{worker\}'/g, `'${workerName}'`);
      } else if (bodyStr.includes('{worker}') || bodyStr.includes('{{worker}}')) {
        // 작업자 이름이 없고 플레이스홀더가 있으면 그대로 표시 (또는 기본 메시지)
        translatedBody = bodyStr;
      }
    }

    return { title: translatedTitle, body: translatedBody };
  };

  // 상태 문자열을 현재 언어로 번역
  const getTranslatedStatus = (status: string | null | undefined): string => {
    if (!status) return '';

    const statusLower = status.toLowerCase();
    
    // 상태 매핑 (다양한 언어 지원)
    const statusMap: { [key: string]: string } = {
      // 한국어
      '미체결': t('notification.status.unfastened'),
      '단일체결': t('notification.status.singleFastened'),
      '이중체결': t('notification.status.doubleFastened'),
      // 영어
      'unfastened': t('notification.status.unfastened'),
      'single': t('notification.status.singleFastened'),
      'double': t('notification.status.doubleFastened'),
      'unhooked': t('notification.status.unfastened'),
      'single fastened': t('notification.status.singleFastened'),
      'double fastened': t('notification.status.doubleFastened'),
      // 일본어
      '未締結': t('notification.status.unfastened'),
      '単一締結': t('notification.status.singleFastened'),
      '二重締結': t('notification.status.doubleFastened'),
      // 중국어 간체
      '未系': t('notification.status.unfastened'),
      '单系': t('notification.status.singleFastened'),
      '双系': t('notification.status.doubleFastened'),
      // 중국어 번체
      '未繫': t('notification.status.unfastened'),
      '單繫': t('notification.status.singleFastened'),
      '雙繫': t('notification.status.doubleFastened'),
      // 스페인어
      'desenganchado': t('notification.status.unfastened'),
      'enganchado simple': t('notification.status.singleFastened'),
      'enganchado doble': t('notification.status.doubleFastened'),
      // 프랑스어
      'déconnecté': t('notification.status.unfastened'),
      'accroché simple': t('notification.status.singleFastened'),
      'accroché double': t('notification.status.doubleFastened'),
      // 독일어
      'losgelöst': t('notification.status.unfastened'),
      'einfach befestigt': t('notification.status.singleFastened'),
      'doppelt befestigt': t('notification.status.doubleFastened'),
      // 이탈리아어
      'scollegato': t('notification.status.unfastened'),
      'collegato singolo': t('notification.status.singleFastened'),
      'collegato doppio': t('notification.status.doubleFastened'),
      // 포르투갈어
      'desconectado': t('notification.status.unfastened'),
      'conectado simples': t('notification.status.singleFastened'),
      'conectado duplo': t('notification.status.doubleFastened'),
      // 러시아어
      'отключено': t('notification.status.unfastened'),
      'одинарное': t('notification.status.singleFastened'),
      'двойное': t('notification.status.doubleFastened'),
    };

    // 정확한 매칭 시도
    if (statusMap[statusLower]) {
      return statusMap[statusLower];
    }

    // 부분 매칭 시도
    for (const [key, value] of Object.entries(statusMap)) {
      if (statusLower.includes(key) || key.includes(statusLower)) {
        return value;
      }
    }

    // 매칭 실패 시 원본 반환
    return status;
  };

  const getStatusColor = (status?: string | null) => {
    if (!status) return '#666';
    const statusLower = status.toLowerCase();
    // 다양한 언어의 상태 문자열 확인
    if (
      statusLower.includes('미체결') ||
      statusLower.includes('unfastened') ||
      statusLower.includes('unhooked') ||
      statusLower.includes('danger') ||
      statusLower.includes('未締結') ||
      statusLower.includes('未系') ||
      statusLower.includes('desenganchado') ||
      statusLower.includes('déconnecté') ||
      statusLower.includes('losgelöst') ||
      statusLower.includes('scollegato') ||
      statusLower.includes('desconectado') ||
      statusLower.includes('отключено')
    ) {
      return '#ef4444';
    }
    if (
      statusLower.includes('단일체결') ||
      statusLower.includes('single') ||
      statusLower.includes('partial') ||
      statusLower.includes('単一締結') ||
      statusLower.includes('单系') ||
      statusLower.includes('enganchado simple') ||
      statusLower.includes('accroché simple') ||
      statusLower.includes('einfach befestigt') ||
      statusLower.includes('collegato singolo') ||
      statusLower.includes('conectado simples') ||
      statusLower.includes('одинарное')
    ) {
      return '#f59e0b';
    }
    return '#666';
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: 8 }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: fonts.extraBold }]}>🔔 {t('notification.title')}</Text>
      </View>

      {/* 원격(Supabase) 알림 내역 – Realtime 상태 배지는 숨김 */}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
          <Text style={[styles.loadingText, { fontFamily: fonts.regular }]}>{t('notification.loading')}</Text>
        </View>
      ) : items.length > 0 ? (
        // 보이는 수준에서도 초단위 중복 제거
        items
          .filter(n => !!n.device_id)
          .filter((n, idx, arr) => {
            const prev = arr[idx - 1];
            if (!prev) return true;
            const sameTime =
              new Date(n.created_at).toISOString().slice(0, 19) ===
              new Date(prev.created_at).toISOString().slice(0, 19);
            const sameTitle =
              n.title === prev.title &&
              n.body === prev.body &&
              (n.device_id || '') === (prev.device_id || '');
            return !(sameTime && sameTitle);
          })
          .map(n => {
            const displayText = getNotificationDisplayText(n.title, n.body, n.device_id);
            const statusColor = getStatusColor(n.status);
            return (
              <View key={n.id} style={styles.statusItem}>
                <Text style={[styles.timeText, { fontFamily: fonts.regular }]}>
                  {formatKoreaTime(n.created_at)}
                </Text>
                <View style={styles.statusItemHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusColor },
                    ]}
                  />
                  <Text style={[styles.statusItemText, { fontFamily: fonts.bold }]}>
                    {displayText.title}
                  </Text>
                </View>
              </View>
            );
          })
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>{t('notification.noNotifications')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  statusItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  statusItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    lineHeight: 22,
  },
  statusItemBody: {
    fontSize: 14,
    color: '#333',
    marginLeft: 20,
    marginBottom: 8,
    lineHeight: 20,
  },
  emptyContainer: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

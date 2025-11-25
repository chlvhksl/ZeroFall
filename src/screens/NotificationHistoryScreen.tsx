/**
 * 알림 내역 화면
 *
 * 기능:
 * - 최근 상태 기록 조회
 * - Realtime으로 실시간 업데이트
 * - 장비별 상태 기록 표시
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addNotificationHistoryListener } from '../../lib/notifications';
import { getSelectedSite } from '../../lib/siteManagement';
import { supabase } from '../../lib/supabase';
import { formatKoreaTime } from '../../lib/utils';
import { useLocalDevice } from '../context/LocalDeviceContext';

import { useFontByLanguage } from '../../lib/fontUtils-safe';

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
  const insets = useSafeAreaInsets();
  const fonts = useFontByLanguage();
  const { status: localConnStatus } = useLocalDevice();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [rtConnected, setRtConnected] = useState(false);
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);

  // 현재 선택한 현장 감지
  useEffect(() => {
    const loadCurrentSite = async () => {
      const selectedSite = await getSelectedSite();
      setCurrentSiteId(selectedSite?.id || null);
    };

    loadCurrentSite();
    // 현장이 변경될 수 있으므로 주기적으로 갱신
    const interval = setInterval(loadCurrentSite, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let channel: any | null = null;
    let offLocal: (() => void) | null = null;

    const fetchInitial = async () => {
      try {
        // 현재 선택한 현장 가져오기
        const selectedSite = await getSelectedSite();
        
        // 알림 내역 조회
        let query = supabase
          .from('notification_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);

        // 현장이 선택되었으면 site_id로 필터링
        if (selectedSite) {
          query = query.eq('site_id', selectedSite.id);
        } else {
          // 현장이 선택되지 않았으면 빈 결과
          setItems([]);
          setLoading(false);
          return;
        }

        const { data, error } = await query;
        if (error) throw error;
        
        setItems(data || []);
      } catch (e) {
        console.error('알림 내역 조회 오류:', e);
      } finally {
        setLoading(false);
      }
    };

    channel = supabase
      .channel('notification_history_stream')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notification_history',
          filter: currentSiteId ? `site_id=eq.${currentSiteId}` : undefined
        },
        payload => {
          const row = payload.new as NotificationRow;
          // 현재 현장의 알림만 추가 (필터가 이미 적용되어 있지만 이중 체크)
          if (!currentSiteId || (row as any).site_id === currentSiteId) {
            setItems(prev => [row, ...prev].slice(0, 30));
          }
        },
      )
      .subscribe(status => setRtConnected(status === 'SUBSCRIBED'));

    fetchInitial();

    // 즉시 반영: 앱 내 수신 이벤트를 상단에 삽입(Realtime 올 때는 필터로 중복 숨김)
    offLocal = addNotificationHistoryListener((row: any) => {
      // 현재 현장의 알림만 추가
      if (!currentSiteId || row.site_id === currentSiteId) {
        setItems(prev =>
          [
            {
              id: Math.floor(Math.random() * 1e9),
              created_at: row.created_at || new Date().toISOString(),
              device_id: row.device_id ?? null,
              title: row.title ?? '알림',
              body: row.body ?? null,
              status: row.status ?? null,
            },
            ...prev,
          ].slice(0, 30),
        );
      }
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (offLocal) offLocal();
    };
  }, [currentSiteId]);

  // 알림 타입을 식별하고 번역 키로 매핑하는 함수
  const getNotificationDisplayText = (notification: NotificationRow) => {
    const title = notification.title || '';
    const body = notification.body || '';
    
    // 알림 타입 식별: 안전고리 미체결 경고 알림인지 확인
    // Title 패턴: "🚨", "안전고리", "Safety Hook", "安全フック", "安全钩" 등이 포함되어 있으면
    const isUnfastenedAlert = 
      title.includes('🚨') ||
      title.includes('안전고리') ||
      title.includes('Safety Hook') ||
      title.includes('安全フック') ||
      title.includes('安全钩') ||
      title.includes('安全鉤') ||
      title.includes('gancho de seguridad') ||
      title.includes('crochet de sécurité') ||
      title.includes('Sicherheitshaken') ||
      title.includes('gancio di sicurezza') ||
      title.includes('gancho de segurança') ||
      title.includes('крюк безопасности');
    
    if (isUnfastenedAlert) {
      // 작업자 이름 추출
      // body 패턴: "작업자 '이름' 고리..." 또는 "Worker '이름' hook..." 등
      let workerName = '';
      
      // body에서 작업자 이름 추출 시도 (더 정확함)
      // 패턴 1: "작업자 '이름' 고리..." 또는 "Worker '이름' hook..."
      const bodyPattern1 = /(?:작업자|Worker|作業者|作业人员|作業人員|trabajador|travailleur|Arbeiter|lavoratore|trabalhador|рабочий)\s*['"']([^'"']+)['"']/;
      const match1 = body.match(bodyPattern1);
      if (match1 && match1[1]) {
        workerName = match1[1].trim();
      }
      
      // 패턴 2: "'이름' 고리..." 또는 "'이름' hook..."
      if (!workerName) {
        const bodyPattern2 = /['"']([^'"']+?)['"']\s*(?:고리|hook|フック|钩|鉤|gancho|crochet|Haken|gancio|крюк)/;
        const match2 = body.match(bodyPattern2);
        if (match2 && match2[1]) {
          workerName = match2[1].trim();
        }
      }
      
      // body에서 찾지 못하면 title에서 시도
      if (!workerName) {
        // title 패턴: "🚨 이름 안전고리..." 또는 "🚨 이름 Safety Hook..."
        // 🚨 다음에 오는 첫 번째 단어를 작업자 이름으로 추정
        const titleMatch = title.match(/🚨\s*([^\s🚨]+?)(?:\s|안전|Safety|安全|gancho|crochet|Haken|gancio|крюк)/);
        if (titleMatch && titleMatch[1]) {
          const candidate = titleMatch[1].trim();
          // 안전고리 관련 키워드가 아닌 경우에만 작업자 이름으로 간주
          const keywords = ['안전고리', 'Safety', '安全', 'gancho', 'crochet', 'Haken', 'gancio', 'крюк', 'Alerta', 'Alerte', 'Warnung', 'Avviso', 'Alerta', 'Предупреждение'];
          if (!keywords.some(keyword => candidate.toLowerCase().includes(keyword.toLowerCase()))) {
            workerName = candidate;
          }
        }
      }
      
      // 번역된 제목과 본문 반환
      const translatedTitle = workerName 
        ? t('notification.alertTitle', { name: workerName })
        : t('notification.unfastenedWarning');
      const translatedBody = t('notification.alertBody');
      
      return {
        title: translatedTitle,
        body: translatedBody,
      };
    }
    
    // 알림 타입을 식별할 수 없으면 원본 텍스트 반환 (fallback)
    return {
      title: title || t('notification.title'),
      body: body || '',
    };
  };

  // Status를 번역 키로 매핑
  const getTranslatedStatus = (status?: string | null) => {
    if (!status) return null;
    
    // 각 언어의 status 텍스트를 번역 키로 매핑
    const statusMap: Record<string, string> = {
      // 한국어
      '미체결': 'notification.status.unfastened',
      '단일체결': 'notification.status.singleFastened',
      '이중체결': 'notification.status.doubleFastened',
      // 영어
      'Not tied off': 'notification.status.unfastened',
      'Single': 'notification.status.singleFastened',
      'Double': 'notification.status.doubleFastened',
      // 일본어
      '未締結': 'notification.status.unfastened',
      '単一締結': 'notification.status.singleFastened',
      '二重締結': 'notification.status.doubleFastened',
      // 간체 중국어
      '未系挂': 'notification.status.unfastened',
      '单侧系挂': 'notification.status.singleFastened',
      '双侧系挂': 'notification.status.doubleFastened',
      // 번체 중국어
      '未繫掛': 'notification.status.unfastened',
      '單側繫掛': 'notification.status.singleFastened',
      '雙側繫掛': 'notification.status.doubleFastened',
      // 스페인어
      'No atado': 'notification.status.unfastened',
      'Sencillo': 'notification.status.singleFastened',
      'Doble': 'notification.status.doubleFastened',
      // 프랑스어
      'Non attaché': 'notification.status.unfastened',
      'Simple': 'notification.status.singleFastened',
      // 'Double'은 영어와 동일하므로 영어 항목 사용
      // 독일어
      'Nicht befestigt': 'notification.status.unfastened',
      'Einfach': 'notification.status.singleFastened',
      'Doppelt': 'notification.status.doubleFastened',
      // 이탈리아어
      'Non fissato': 'notification.status.unfastened',
      'Singolo': 'notification.status.singleFastened',
      'Doppio': 'notification.status.doubleFastened',
      // 포르투갈어
      'Não fixado': 'notification.status.unfastened',
      'Simples': 'notification.status.singleFastened',
      'Duplo': 'notification.status.doubleFastened',
      // 러시아어
      'Не закреплен': 'notification.status.unfastened',
      'Одинарный': 'notification.status.singleFastened',
      'Двойной': 'notification.status.doubleFastened',
    };
    
    const translationKey = statusMap[status];
    return translationKey ? t(translationKey) : status;
  };

  const getStatusColor = (status?: string | null) => {
    if (!status) return '#666';
    
    // Status를 번역 키로 매핑하여 비교
    const statusMap: Record<string, string> = {
      // 한국어
      '미체결': 'unfastened',
      '단일체결': 'singleFastened',
      '이중체결': 'doubleFastened',
      // 영어
      'Not tied off': 'unfastened',
      'Single': 'singleFastened',
      'Double': 'doubleFastened',
      // 일본어
      '未締結': 'unfastened',
      '単一締結': 'singleFastened',
      '二重締結': 'doubleFastened',
      // 간체 중국어
      '未系挂': 'unfastened',
      '单侧系挂': 'singleFastened',
      '双侧系挂': 'doubleFastened',
      // 번체 중국어
      '未繫掛': 'unfastened',
      '單側繫掛': 'singleFastened',
      '雙側繫掛': 'doubleFastened',
      // 스페인어
      'No atado': 'unfastened',
      'Sencillo': 'singleFastened',
      'Doble': 'doubleFastened',
      // 프랑스어
      'Non attaché': 'unfastened',
      'Simple': 'singleFastened',
      // 'Double'은 영어와 동일하므로 영어 항목 사용
      // 독일어
      'Nicht befestigt': 'unfastened',
      'Einfach': 'singleFastened',
      'Doppelt': 'doubleFastened',
      // 이탈리아어
      'Non fissato': 'unfastened',
      'Singolo': 'singleFastened',
      'Doppio': 'doubleFastened',
      // 포르투갈어
      'Não fixado': 'unfastened',
      'Simples': 'singleFastened',
      'Duplo': 'doubleFastened',
      // 러시아어
      'Не закреплен': 'unfastened',
      'Одинарный': 'singleFastened',
      'Двойной': 'doubleFastened',
    };
    
    const statusType = statusMap[status];
    if (statusType === 'unfastened') return '#ef4444';
    if (statusType === 'singleFastened') return '#f59e0b';
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
            const displayText = getNotificationDisplayText(n);
            return (
              <View key={n.id} style={styles.statusItem}>
                <Text style={styles.deviceName}>{formatKoreaTime(n.created_at)}</Text>
                <View style={styles.statusItemHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(n.status) },
                    ]}
                  />
                  <Text style={[styles.statusItemText, { fontFamily: fonts.bold }]}>{displayText.title}</Text>
                </View>
                {!!displayText.body && (
                  <Text style={[styles.statusItemDetail, { fontFamily: fonts.regular }]}>{displayText.body}</Text>
                )}
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 14,
    color: '#999',
        marginBottom: 4,
  },
  statusItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
        flex: 1,
  },
  statusItemTime: {
    fontSize: 12,
    color: '#666',
      },
  statusItemDetail: {
    fontSize: 14,
    color: '#666',
        marginLeft: 16,
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

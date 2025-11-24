import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n-safe';
import { useFontByLanguage } from '../../lib/fontUtils-safe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSelectedSite } from '../../lib/siteManagement';
import { supabase } from '../../lib/supabase';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';

type Row = {
  device_id: string;
  worker_name?: string | null;
  status?: string | null;
  left_sensor?: boolean | null;
  right_sensor?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
  wifi_ssid?: string | null;
  site_id?: string | null;
};

const STALE_MS = 45000;
const PENDING_WINDOW_MS = 120000; // 최근 2분 내 업데이트 + 미등록을 "등록 대기중"으로 간주
const REFRESH_MS = 5000; // 목록 주기적 갱신(5초)

export default function RegisterDeviceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fonts = useFontByLanguage();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [workerName, setWorkerName] = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [wifiWarning, setWifiWarning] = useState(false);
  const [manualSSID, setManualSSID] = useState<string>('');
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // 현재 선택된 현장 가져오기
      const selectedSite = await getSelectedSite();
      const siteId = selectedSite?.id || null;
      setCurrentSiteId(siteId);

      const { data, error } = await supabase
        .from('gori_status')
        .select('device_id, worker_name, status, left_sensor, right_sensor, updated_at, created_at, wifi_ssid, site_id')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('device.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('gori-status-register')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gori_status' },
        () => load()
      )
      .subscribe();
    channelRef.current = ch;
    const interval = setInterval(() => load(), REFRESH_MS);
    return () => {
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // 전체 기기 목록에는 "등록된 기기"만 표시
    let list = rows
      .filter((r) => !!(r.worker_name && String(r.worker_name).trim().length > 0))
      .slice();
    // 최신 업데이트 순 정렬
    list.sort((a, b) => {
      const at = new Date(a.updated_at || a.created_at || 0).getTime();
      const bt = new Date(b.updated_at || b.created_at || 0).getTime();
      return bt - at;
    });
    if (!q) return list;
    return list.filter((r) => {
      const deviceIdLower = r.device_id.toLowerCase();
      const workerNameLower = (r.worker_name || '').toLowerCase();
      
      // 전체 device_id에서 검색
      if (deviceIdLower.includes(q)) {
        return true;
      }
      
      // 작업자 이름에서 검색
      if (workerNameLower.includes(q)) {
        return true;
      }
      
      // 기기명의 'r4-' 이후 6자리 추출하여 검색
      // 예: 'r4-1051db357ebc' → '1051db' 추출
      const deviceIdMatch = deviceIdLower.match(/^r4-([a-f0-9]{6})/);
      if (deviceIdMatch) {
        const shortCode = deviceIdMatch[1]; // 'r4-' 이후 6자리
        if (shortCode.includes(q)) {
          return true;
        }
      }
      
      return false;
    });
  }, [rows, query]);

  const pending = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    
    const filtered = rows
      .filter((r) => {
        // 1. 미등록 기기만
        const unreg = !r.worker_name || r.worker_name === '';
        if (!unreg) return false;
        
        // 2. 최근 2분 내 업데이트
        const t = r.updated_at 
          ? new Date(r.updated_at).getTime() 
          : (r.created_at ? new Date(r.created_at).getTime() : now);
        const timeDiff = now - t;
        if (timeDiff >= PENDING_WINDOW_MS) return false;

        // 3. 같은 와이파이 확인 (Android만)
        if (Platform.OS === 'android') {
          // 수동 입력이 있으면 수동 입력을 우선 사용
          if (manualSSID.trim()) {
            const manualSSIDLower = manualSSID.trim().toLowerCase();
            let matches = false;
            
            // 방법 1: WiFi 이름으로 검색
            if (r.wifi_ssid) {
              const deviceSSID = String(r.wifi_ssid).trim().toLowerCase();
              if (deviceSSID === manualSSIDLower) {
                matches = true;
              }
            }
            
            // 방법 2: 기기명의 앞 6자리로 검색 (r4- 이후 6자리)
            if (!matches) {
              const deviceIdLower = r.device_id.toLowerCase();
              const deviceIdMatch = deviceIdLower.match(/^r4-([a-f0-9]{6})/);
              if (deviceIdMatch) {
                const shortCode = deviceIdMatch[1]; // 'r4-' 이후 6자리
                if (shortCode === manualSSIDLower) {
                  matches = true;
                }
              }
            }
            
            // WiFi 이름 또는 기기명 앞 4자리 중 하나라도 일치하면 표시
            if (!matches) {
              return false;
            }
          } else {
            // 수동 입력 없음 → 아무것도 표시하지 않음
            return false;
          }
        }

        // 4. 검색어 필터
        if (!q) return true;
        
        const deviceIdLower = r.device_id.toLowerCase();
        const workerNameLower = (r.worker_name || '').toLowerCase();
        
        // 전체 device_id에서 검색
        if (deviceIdLower.includes(q)) {
          return true;
        }
        
        // 작업자 이름에서 검색
        if (workerNameLower.includes(q)) {
          return true;
        }
        
        // 기기명의 'r4-' 이후 4자리 추출하여 검색
        // 예: 'r4-1051db357ebc' → '1051' 추출
        const deviceIdMatch = deviceIdLower.match(/^r4-([a-f0-9]{4})/);
        if (deviceIdMatch) {
          const shortCode = deviceIdMatch[1]; // 'r4-' 이후 4자리
          if (shortCode.includes(q)) {
            return true;
          }
        }
        
        return false;
      })
      .sort((a, b) => {
        const at = new Date(a.updated_at || a.created_at || 0).getTime();
        const bt = new Date(b.updated_at || b.created_at || 0).getTime();
        return bt - at;
      });
    
    return filtered;
  }, [rows, query, manualSSID, currentSiteId]);

  const handleRegister = async () => {
    const id = selectedId.trim();
    const name = workerName.trim();
    if (!id || !name) {
      Alert.alert(t('common.error'), t('device.deviceIdWorkerNameRequired'));
      return;
    }
    try {
      // 현재 선택된 현장 가져오기
      const selectedSite = await getSelectedSite();
      const siteId = selectedSite?.id || null;

      const { error } = await supabase
        .from('gori_status')
        .upsert({ 
          device_id: id, 
          worker_name: name,
          site_id: siteId // 현재 현장 ID 저장
        }, { onConflict: 'device_id' });
      if (error) throw error;
      Alert.alert(t('common.success'), t('device.registerSuccess'), [
        {
          text: t('device.goToDashboard'),
          onPress: () => router.back(),
        },
        { text: t('common.confirm') },
      ]);
      setWorkerName('');
      setSelectedId('');
      await load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('device.registerError'));
    }
  };

  const handleUnregister = async (deviceId: string) => {
    Alert.alert(
      t('device.unregister'),
      t('device.unregisterConfirm', { deviceId }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('device.unregister'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('gori_status')
                .update({ worker_name: null, site_id: null })
                .eq('device_id', deviceId);
              
              if (error) throw error;
              
              Alert.alert(t('common.success'), t('device.unregisterSuccess'));
              await load();
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || t('device.unregisterError'));
            }
          },
        },
      ]
    );
  };

  const isOnline = (r: Row) => {
    const t = new Date(r.updated_at || r.created_at || 0).getTime();
    return Date.now() - t < STALE_MS;
  };

  // 상태 값을 번역하는 함수
  const getTranslatedStatus = (status: string | null | undefined, leftSensor?: boolean | null, rightSensor?: boolean | null): string => {
    if (!status) {
      // status가 없으면 센서 값으로 판단
      const left = Boolean(leftSensor);
      const right = Boolean(rightSensor);
      if (left && right) return t('dashboard.status.doubleFastened');
      if (left || right) return t('dashboard.status.singleFastened');
      return t('dashboard.status.unfastened');
    }

    const s = String(status).trim().toLowerCase();
    
    // 한국어 상태 값 확인
    if (s.includes('이중') || s === 'double' || s === 'both' || s === 'locked' || s === 'secure' || s === 'fully' || s === 'ok') {
      return t('dashboard.status.doubleFastened');
    }
    if (s.includes('단일') || s === 'single' || s === 'one' || s === 'partial' || s === 'partially' || s === 'half') {
      return t('dashboard.status.singleFastened');
    }
    if (s.includes('미') || s === 'none' || s === 'unhooked' || s === 'open' || s === 'danger' || s === 'alert') {
      return t('dashboard.status.unfastened');
    }

    // 센서 값으로 판단
    const left = Boolean(leftSensor);
    const right = Boolean(rightSensor);
    if (left && right) return t('dashboard.status.doubleFastened');
    if (left || right) return t('dashboard.status.singleFastened');
    return t('dashboard.status.unfastened');
  };

  const renderItem = ({ item }: { item: Row }) => {
    const online = isOnline(item);
    const unregistered = !item.worker_name;
    const selected = selectedId === item.device_id;
    return (
      <View key={item.device_id} style={[
        styles.card,
        selected && styles.cardSelected,
        unregistered && styles.cardPending,
      ]}>
        <TouchableOpacity
          onPress={() => setSelectedId(item.device_id)}
          style={{ flex: 1 }}
        >
          <Text style={[styles.cardTitle, { fontFamily: fonts.bold }]}>
            {item.device_id} {online ? '✅' : '❌'}
          </Text>
          <Text style={[styles.cardText, { fontFamily: fonts.regular }]}>
            {t('device.worker')}: {item.worker_name || t('device.unregistered')}   |   {t('device.status')}: {getTranslatedStatus(item.status, item.left_sensor, item.right_sensor)}
          </Text>
          <Text style={[styles.cardSub, { fontFamily: fonts.regular }]}>
            {t('device.updated')}: {new Date(item.updated_at || item.created_at || '').toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US')}
          </Text>
        </TouchableOpacity>
        {!unregistered && (
          <TouchableOpacity
            onPress={() => handleUnregister(item.device_id)}
            style={styles.unregisterButton}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.unregisterButtonText}>{t('device.unregister')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={[styles.title, { fontFamily: fonts.bold }]}>{t('device.registerWorker')}</Text>
        </View>

        {/* 와이파이 안내 메시지 */}
        <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
          <Text style={[styles.infoText, { fontFamily: fonts.regular }]}>
            {t('device.registerInfo')}
            {Platform.OS === 'android' && (
              <>
                {'\n'}
                <Text style={[styles.infoBold, { fontFamily: fonts.bold }]}>{t('device.currentWiFi')}</Text> {manualSSID || t('device.inputRequired')}
                {'\n'}
                <Text style={[styles.infoBold, { fontFamily: fonts.bold }]}>{t('device.filtering')}</Text> {manualSSID ? t('device.filteringActive') : t('device.filteringWaiting')}
                {!manualSSID && (
                  <>
                    {'\n'}
                    <Text style={[styles.infoWarning, { fontFamily: fonts.regular }]}>
                      {t('device.wifiNameWarning')}
                    </Text>
                    {'\n'}
                    <Text style={[styles.infoLink, { fontFamily: fonts.regular }]} onPress={() => {
                      if (Platform.OS === 'android') {
                        Linking.openSettings();
                      }
                    }}>
                      {t('device.checkWifiSettings')}
                    </Text>
                  </>
                )}
              </>
            )}
          </Text>
        </View>
      </View>

      {/* 수동 SSID 입력 (Android만, 기본으로 표시) */}
      {Platform.OS === 'android' && (
        <View style={styles.row}>
          <TextInput
            value={manualSSID}
            onChangeText={setManualSSID}
            placeholder={t('device.manualWifiPlaceholder')}
            style={[styles.input, { fontFamily: fonts.regular }]}
            autoCapitalize="none"
          />
          {manualSSID.trim() && (
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={() => {
                setManualSSID('');
                // 입력 필드는 사라지지 않음 (X 버튼은 값만 지움)
              }}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('device.searchPlaceholder')}
          style={[styles.input, { fontFamily: fonts.regular }]}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.row}>
        <TextInput
          value={selectedId}
          onChangeText={() => {}}
          placeholder={t('device.selectDevice')}
          style={[styles.input, { backgroundColor: '#F2F2F2', color: '#666', fontFamily: fonts.regular }]}
          autoCapitalize="none"
          editable={false}
        />
      </View>
      <View style={styles.row}>
        <TextInput
          value={workerName}
          onChangeText={setWorkerName}
          placeholder={t('device.enterWorkerName')}
          style={[styles.input, { fontFamily: fonts.regular }]}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={handleRegister}>
          <Text style={[styles.btnText, { fontFamily: fonts.bold }]}>{t('device.register')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { fontFamily: fonts.bold }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>

      {/* 등록 대기중 섹션 */}
      <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>
        {t('device.waitingDevices')} {pending.length > 0 && `(${pending.length})`}
      </Text>
      {pending.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>
            {t('device.noWaitingDevices')}{'\n'}
            {t('device.waitingDevicesInfo')}
          </Text>
        </View>
      ) : (
        <View style={{ marginBottom: 10 }}>
          {pending.map((item) => {
            const online = isOnline(item);
            const selected = selectedId === item.device_id;
            return (
              <TouchableOpacity
                key={item.device_id}
                onPress={() => setSelectedId(item.device_id)}
                style={[
                  styles.card,
                  styles.cardPending,
                  selected && styles.cardSelected,
                ]}
              >
                <Text style={[styles.cardTitle, { fontFamily: fonts.bold }]}>
                  {item.device_id} {online ? '✅' : '❌'}
                </Text>
                <Text style={[styles.cardText, { fontFamily: fonts.regular }]}>
                  {t('device.status')}: {getTranslatedStatus(item.status, item.left_sensor, item.right_sensor)}
                </Text>
                <Text style={[styles.cardSub, { fontFamily: fonts.regular }]}>
                  {t('device.updated')}: {new Date(item.updated_at || item.created_at || '').toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

        <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>{t('device.allDevices')}</Text>
        {filtered.map((item) => renderItem({ item }))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
    paddingHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  title: {
    fontSize: 24,
    // fontWeight: 'bold', // 폰트 파일 자체에 굵기 포함
        color: '#000',
    flex: 1,
  },
  row: {
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
      },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  primary: {
    backgroundColor: '#78C4B4',
  },
  secondary: {
    backgroundColor: '#D8D8C8',
  },
  btnText: {
    fontSize: 16,
    // fontWeight: 'bold',
        color: '#000',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: '#1e90ff',
  },
  cardPending: {
    backgroundColor: '#f9fff5',
  },
  sectionTitle: {
    fontSize: 16,
    // fontWeight: 'bold',
        color: '#000',
    marginBottom: 6,
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  emptyText: {
    color: '#000',
        textAlign: 'center',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: '#000',
        fontSize: 13,
    lineHeight: 18,
  },
  infoBold: {
        fontWeight: 'bold',
  },
  infoLink: {
        color: '#007AFF',
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  infoWarning: {
        color: '#FF6B00',
    fontSize: 12,
    marginTop: 4,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    top: 12,
    zIndex: 1,
  },
  cardTitle: {
    fontSize: 16,
    // fontWeight: 'bold',
        color: '#000',
    marginBottom: 4,
  },
  cardText: {
    color: '#000',
    marginBottom: 2,
      },
  cardSub: {
    color: '#333',
    fontSize: 12,
      },
  unregisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF3B30',
    marginTop: 8,
  },
  unregisterButtonText: {
    color: '#FF3B30',
    fontSize: 14,
        marginLeft: 4,
  },
  debugBox: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFC107',
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  debugText: {
    color: '#856404',
    fontSize: 11,
      },
});



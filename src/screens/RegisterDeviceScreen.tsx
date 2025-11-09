import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Row = {
  device_id: string;
  worker_name?: string | null;
  status?: string | null;
  left_sensor?: boolean | null;
  right_sensor?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const STALE_MS = 45000;
const PENDING_WINDOW_MS = 120000; // 최근 2분 내 업데이트 + 미등록을 "등록 대기중"으로 간주
const REFRESH_MS = 5000; // 목록 주기적 갱신(5초)

export default function RegisterDeviceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [workerName, setWorkerName] = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gori_status')
        .select('device_id, worker_name, status, left_sensor, right_sensor, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      Alert.alert('오류', e?.message || '목록을 불러오지 못했습니다.');
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
    return list.filter(
      (r) =>
        r.device_id.toLowerCase().includes(q) ||
        (r.worker_name || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const pending = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        const unreg = !r.worker_name || r.worker_name === '';
        const t = new Date(r.updated_at || r.created_at || 0).getTime();
        const recent = now - t < PENDING_WINDOW_MS;
        if (!unreg || !recent) return false;
        if (!q) return true;
        return (
          r.device_id.toLowerCase().includes(q) ||
          (r.worker_name || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const at = new Date(a.updated_at || a.created_at || 0).getTime();
        const bt = new Date(b.updated_at || b.created_at || 0).getTime();
        return bt - at;
      });
  }, [rows, query]);

  const handleRegister = async () => {
    const id = selectedId.trim();
    const name = workerName.trim();
    if (!id || !name) {
      Alert.alert('입력 필요', 'device_id와 작업자 이름을 모두 입력해 주세요.');
      return;
    }
    try {
      const { error } = await supabase
        .from('gori_status')
        .upsert({ device_id: id, worker_name: name }, { onConflict: 'device_id' });
      if (error) throw error;
      Alert.alert('완료', '작업자 이름이 등록되었습니다.', [
        {
          text: '대시보드로 이동',
          onPress: () => router.back(),
        },
        { text: '확인' },
      ]);
      setWorkerName('');
      await load();
    } catch (e: any) {
      Alert.alert('등록 실패', e?.message || '등록에 실패했습니다.');
    }
  };

  const isOnline = (r: Row) => {
    const t = new Date(r.updated_at || r.created_at || 0).getTime();
    return Date.now() - t < STALE_MS;
  };

  const renderItem = ({ item }: { item: Row }) => {
    const online = isOnline(item);
    const unregistered = !item.worker_name;
    const selected = selectedId === item.device_id;
    return (
      <TouchableOpacity
        onPress={() => setSelectedId(item.device_id)}
        style={[
          styles.card,
          selected && styles.cardSelected,
          unregistered && styles.cardPending,
        ]}
      >
        <Text style={styles.cardTitle}>
          {item.device_id} {online ? '✅' : '❌'}
        </Text>
        <Text style={styles.cardText}>
          작업자: {item.worker_name || '(미등록)'}   |   상태: {item.status || '-'}
        </Text>
        <Text style={styles.cardSub}>
          업데이트: {new Date(item.updated_at || item.created_at || '').toLocaleString('ko-KR')}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>작업자 등록/변경</Text>

      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="기기 또는 이름 검색"
          style={styles.input}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.row}>
        <TextInput
          value={selectedId}
          onChangeText={() => {}}
          placeholder="선택된 기기"
          style={[styles.input, { backgroundColor: '#F2F2F2', color: '#666' }]}
          autoCapitalize="none"
          editable={false}
        />
      </View>
      <View style={styles.row}>
        <TextInput
          value={workerName}
          onChangeText={setWorkerName}
          placeholder="작업자 이름 입력"
          style={styles.input}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={handleRegister}>
          <Text style={styles.btnText}>등록/변경</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => router.back()}>
          <Text style={styles.btnText}>취소</Text>
        </TouchableOpacity>
      </View>

      {/* 등록 대기중 섹션 */}
      <Text style={styles.sectionTitle}>등록 대기중 (최근 2분)</Text>
      {pending.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>현재 대기중 기기가 없습니다.</Text>
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
                <Text style={styles.cardTitle}>
                  {item.device_id} {online ? '✅' : '❌'}
                </Text>
                <Text style={styles.cardText}>
                  상태: {item.status || '-'}
                </Text>
                <Text style={styles.cardSub}>
                  업데이트: {new Date(item.updated_at || item.created_at || '').toLocaleString('ko-KR')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>전체 기기</Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.device_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshing={loading}
        onRefresh={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    // fontWeight: 'bold', // 폰트 파일 자체에 굵기 포함
    fontFamily: 'NanumSquare-Bold',
    color: '#000',
    marginBottom: 12,
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
    fontFamily: 'NanumSquare-Regular',
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
    fontFamily: 'NanumSquare-Bold',
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
    fontFamily: 'NanumSquare-Bold',
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
    fontFamily: 'NanumSquare-Regular',
  },
  cardTitle: {
    fontSize: 16,
    // fontWeight: 'bold',
    fontFamily: 'NanumSquare-Bold',
    color: '#000',
    marginBottom: 4,
  },
  cardText: {
    color: '#000',
    marginBottom: 2,
    fontFamily: 'NanumSquare-Regular',
  },
  cardSub: {
    color: '#333',
    fontSize: 12,
    fontFamily: 'NanumSquare-Regular',
  },
});



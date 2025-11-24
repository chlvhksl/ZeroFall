/**
 * 앱 사용 가이드 화면
 * 
 * ZeroFall 앱의 주요 기능과 사용 방법을 안내합니다.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

export default function GuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const guideSections = [
    {
      title: '1. 현장 선택',
      icon: 'location-outline',
      content: [
        '로그인 후 현장을 선택합니다.',
        '현장을 생성하거나 기존 현장에 참여할 수 있습니다.',
        '현장별로 장비와 알림이 관리됩니다.',
      ],
    },
    {
      title: '2. 대시보드',
      icon: 'grid-outline',
      content: [
        '등록된 장비들의 실시간 상태를 확인할 수 있습니다.',
        { text: '미체결(빨간색): 안전고리가 체결되지 않음', color: '#ef4444', icon: 'alert-circle' },
        { text: '단일체결(노란색): 한쪽만 체결됨', color: '#f59e0b', icon: 'warning' },
        { text: '이중체결(초록색): 양쪽 모두 체결됨', color: '#22c55e', icon: 'checkmark-circle' },
        '관리자는 작업자 등록/변경이 가능합니다.',
      ],
    },
    {
      title: '3. 알림 내역',
      icon: 'notifications-outline',
      content: [
        '미체결 상태가 5초 이상 지속되면 알림이 발송됩니다.',
        '과거 알림 내역을 최대 30개까지 확인할 수 있습니다.',
        '현장별로 알림이 필터링됩니다.',
      ],
    },
    {
      title: '4. 장비 등록',
      icon: 'hardware-chip-outline',
      content: [
        'Wi-Fi 네트워크 이름을 입력하여 장비를 검색합니다.',
        '등록 대기 중인 장비를 선택하여 등록합니다.',
        '장비 이름과 작업자를 지정할 수 있습니다.',
        '등록된 장비는 해제할 수 있습니다.',
      ],
    },
    {
      title: '5. 환경설정',
      icon: 'settings-outline',
      content: [
        '계정 정보 확인 및 수정',
        '비밀번호 변경',
        '알림 내역 삭제',
        '캐시 데이터 삭제',
        '앱 버전 확인',
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* 고정 헤더 (뒤로가기 버튼 포함) */}
      <View style={[styles.header, { paddingTop: insets.top || 0 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>앱 사용 가이드</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 소개 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ZeroFall 안전고리 모니터링 시스템</Text>
          <View style={styles.introContent}>
            <Text style={styles.introText}>
              안전고리의 체결 상태를 실시간으로 모니터링하고, 미체결 시 즉시 알림을 받을 수 있는 시스템입니다.
            </Text>
          </View>
        </View>

        {/* 가이드 섹션들 */}
        {guideSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={24} color="#78C4B4" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.content.map((item, itemIndex) => {
              // 객체 형태인지 문자열인지 확인
              if (typeof item === 'object' && item !== null && 'text' in item) {
                return (
                  <View key={itemIndex} style={[styles.contentItem, styles.statusItem]}>
                    <View style={[styles.statusIndicator, { backgroundColor: item.color }]}>
                      <Ionicons name={item.icon as any} size={16} color="#FFF" />
                    </View>
                    <Text style={styles.contentText}>{item.text}</Text>
                  </View>
                );
              }
              // 문자열인 경우
              if (typeof item === 'string') {
                return (
                  <View key={itemIndex} style={styles.contentItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.contentText}>{item}</Text>
                  </View>
                );
              }
              return null;
            })}
          </View>
        ))}

        {/* 주의사항 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>주의사항</Text>
          <View style={styles.contentItem}>
            <View style={styles.bullet} />
            <Text style={styles.contentText}>
              미체결 상태가 5초 이상 지속되면 자동으로 알림이 발송됩니다.
            </Text>
          </View>
          <View style={styles.contentItem}>
            <View style={styles.bullet} />
            <Text style={styles.contentText}>
              장비 등록 시 Wi-Fi 네트워크 이름을 정확히 입력해야 합니다.
            </Text>
          </View>
          <View style={styles.contentItem}>
            <View style={styles.bullet} />
            <Text style={styles.contentText}>
              현장별로 장비와 알림이 분리되어 관리됩니다.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#EDF6EF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: FONT_EXTRABOLD,
    color: '#000',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONT_BOLD,
    color: '#000',
    fontWeight: 'bold',
  },
  introContent: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  introText: {
    fontSize: 14,
    fontFamily: FONT_REGULAR,
    color: '#666',
    lineHeight: 22,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#78C4B4',
    marginTop: 6,
    marginRight: 12,
  },
  contentText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_REGULAR,
    color: '#666',
    lineHeight: 22,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bottomSpacer: {
    height: 4,
  },
});

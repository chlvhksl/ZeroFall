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
      content: [
        '로그인 후 현장을 선택합니다.',
        '현장을 생성하거나 기존 현장에 참여할 수 있습니다.',
        '현장별로 장비와 알림이 관리됩니다.',
      ],
    },
    {
      title: '2. 대시보드',
      content: [
        '등록된 장비들의 실시간 상태를 확인할 수 있습니다.',
        '미체결(빨간색): 안전고리가 체결되지 않음',
        '단일체결(노란색): 한쪽만 체결됨',
        '이중체결(초록색): 양쪽 모두 체결됨',
        '관리자는 작업자 등록/변경이 가능합니다.',
      ],
    },
    {
      title: '3. 알림 내역',
      content: [
        '미체결 상태가 5초 이상 지속되면 알림이 발송됩니다.',
        '과거 알림 내역을 최대 30개까지 확인할 수 있습니다.',
        '현장별로 알림이 필터링됩니다.',
      ],
    },
    {
      title: '4. 장비 등록',
      content: [
        'Wi-Fi 네트워크 이름을 입력하여 장비를 검색합니다.',
        '등록 대기 중인 장비를 선택하여 등록합니다.',
        '장비 이름과 작업자를 지정할 수 있습니다.',
        '등록된 장비는 해제할 수 있습니다.',
      ],
    },
    {
      title: '5. 환경설정',
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top - 36 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* 뒤로가기 버튼 */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.title}>앱 사용 가이드</Text>

        {/* 소개 섹션 */}
        {renderSection(
          'ZeroFall 안전고리 모니터링 시스템',
          <View style={styles.introContent}>
            <Text style={styles.introText}>
              안전고리의 체결 상태를 실시간으로 모니터링하고, 미체결 시 즉시 알림을 받을 수 있는 시스템입니다.
            </Text>
          </View>,
        )}

        {/* 가이드 섹션들 */}
        {guideSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.contentItem}>
                <View style={styles.bullet} />
                <Text style={styles.contentText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* 주의사항 섹션 */}
        {renderSection(
          '주의사항',
          <>
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
          </>,
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );

  function renderSection(title: string, children: React.ReactNode) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
      </View>
    );
  }
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
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: FONT_EXTRABOLD,
    color: '#000',
    marginBottom: 32,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONT_BOLD,
    color: '#666',
    marginBottom: 4,
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
  bottomSpacer: {
    height: 4,
  },
});

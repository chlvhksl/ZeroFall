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
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontByLanguage } from '../../lib/fontUtils-safe';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';

export default function GuideScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useFontByLanguage();

  const guideSections = [
    {
      title: t('guide.section1'),
      icon: 'location-outline',
      content: [
        t('guide.section1_1'),
        t('guide.section1_2'),
        t('guide.section1_3'),
      ],
    },
    {
      title: t('guide.section2'),
      icon: 'grid-outline',
      content: [
        t('guide.section2_1'),
        { text: t('guide.section2_2'), color: '#ef4444', icon: 'alert-circle' },
        { text: t('guide.section2_3'), color: '#f59e0b', icon: 'warning' },
        { text: t('guide.section2_4'), color: '#22c55e', icon: 'checkmark-circle' },
        t('guide.section2_5'),
      ],
    },
    {
      title: t('guide.section3'),
      icon: 'notifications-outline',
      content: [
        t('guide.section3_1'),
        t('guide.section3_2'),
        t('guide.section3_3'),
      ],
    },
    {
      title: t('guide.section4'),
      icon: 'hardware-chip-outline',
      content: [
        t('guide.section4_1'),
        t('guide.section4_2'),
        t('guide.section4_3'),
        t('guide.section4_4'),
      ],
    },
    {
      title: t('guide.section5'),
      icon: 'settings-outline',
      content: [
        t('guide.section5_1'),
        t('guide.section5_2'),
        t('guide.section5_3'),
        t('guide.section5_4'),
        t('guide.section5_5'),
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* 고정 헤더 (뒤로가기 버튼 포함) */}
      <View style={[styles.header, { paddingTop: insets.top || 0 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // 최초 로그인에서 온 경우 현장 선택 화면으로 이동, 아니면 뒤로가기
            router.replace('/site-select');
          }}
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('guide.title')}</Text>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => {
            // 다음 버튼: 현장 선택 화면으로 이동
            router.replace('/site-select');
          }}
          activeOpacity={0.7}>
          <Text style={styles.nextButtonText}>{t('common.next')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 소개 섹션 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>{t('guide.intro')}</Text>
          <View style={styles.introContent}>
            <Text style={[styles.introText, { fontFamily: fonts.regular }]}>
              {t('guide.introText')}
            </Text>
          </View>
        </View>

        {/* 가이드 섹션들 */}
        {guideSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={24} color="#78C4B4" style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>{section.title}</Text>
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
                    <Text style={[styles.contentText, { fontFamily: fonts.regular }]}>{item}</Text>
                  </View>
                );
              }
              return null;
            })}
          </View>
        ))}

        {/* 주의사항 섹션 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>{t('guide.caution')}</Text>
          <View style={styles.contentItem}>
            <View style={styles.bullet} />
            <Text style={[styles.contentText, { fontFamily: fonts.regular }]}>
              {t('guide.caution1')}
            </Text>
          </View>
          <View style={styles.contentItem}>
            <View style={styles.bullet} />
            <Text style={[styles.contentText, { fontFamily: fonts.regular }]}>
              {t('guide.caution2')}
            </Text>
          </View>
          <View style={styles.contentItem}>
            <View style={styles.bullet} />
            <Text style={styles.contentText}>
              {t('guide.caution3')}
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
  nextButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#78C4B4',
    borderWidth: 2,
    borderColor: '#000',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  title: {
    fontSize: 32,
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

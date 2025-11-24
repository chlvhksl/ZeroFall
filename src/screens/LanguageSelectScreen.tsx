import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changeLanguage, getCurrentLanguage } from '../../lib/i18n-safe';

// 폰트 설정
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

const LANGUAGES = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
];

export default function LanguageSelectScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [currentLanguage, setCurrentLanguage] = useState<string>(getCurrentLanguage());

  // 언어 변경 감지
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const handleLanguageSelect = async (languageCode: 'ko' | 'en') => {
    const success = await changeLanguage(languageCode);
    if (success) {
      setCurrentLanguage(languageCode);
      // 언어 변경 후 뒤로가기
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.language')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.subtitle}>{t('settings.selectLanguage')}</Text>

        {LANGUAGES.map((language) => {
          const isSelected = currentLanguage === language.code;
          return (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageOption,
                isSelected && styles.languageOptionSelected,
              ]}
              onPress={() => handleLanguageSelect(language.code as 'ko' | 'en')}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  isSelected && styles.languageOptionTextSelected,
                ]}
              >
                {language.name}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark" size={20} color="#78C4B4" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
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
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: FONT_BOLD,
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONT_REGULAR,
    color: '#666',
    marginBottom: 16,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  languageOptionSelected: {
    backgroundColor: '#F0F9F4',
    borderColor: '#78C4B4',
    borderWidth: 2,
  },
  languageOptionText: {
    fontSize: 16,
    fontFamily: FONT_REGULAR,
    color: '#333',
  },
  languageOptionTextSelected: {
    fontFamily: FONT_BOLD,
    color: '#78C4B4',
  },
});


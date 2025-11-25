/**
 * 안전한 i18n 초기화 유틸리티
 * 네이티브 모듈이 준비된 후에 초기화하도록 설계
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 언어 리소스
import ko from '../locales/ko.json';
import en from '../locales/en.json';
import jp from '../locales/jp.json';
import zhCN from '../locales/zh-CN.json';
import zhTW from '../locales/zh-TW.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import it from '../locales/it.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';

const resources = {
  ko: {
    translation: ko,
  },
  en: {
    translation: en,
  },
  jp: {
    translation: jp,
  },
  'zh-CN': {
    translation: zhCN,
  },
  'zh-TW': {
    translation: zhTW,
  },
  es: {
    translation: es,
  },
  fr: {
    translation: fr,
  },
  de: {
    translation: de,
  },
  it: {
    translation: it,
  },
  pt: {
    translation: pt,
  },
  ru: {
    translation: ru,
  },
};

const LANGUAGE_STORAGE_KEY = '@zerofall_language';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * i18n을 안전하게 초기화합니다.
 * 네이티브 모듈이 준비될 때까지 대기합니다.
 */
export async function initializeI18n(): Promise<void> {
  // 이미 초기화되었으면 바로 반환
  if (isInitialized) {
    return;
  }

  // 이미 초기화 중이면 기존 Promise 반환
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // 네이티브 모듈이 준비될 때까지 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 100));

      // 저장된 언어 우선 확인, 없으면 시스템 언어 사용
      let savedLanguage: string | null = null;
      try {
        savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      } catch (error) {
        console.log('저장된 언어 읽기 실패:', error);
      }

      let language = 'ko';
      const supportedLanguages = ['ko', 'en', 'jp', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'it', 'pt', 'ru'];
      if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
        language = savedLanguage;
      } else {
        // 시스템 언어 감지
        const defaultLanguage = Localization.getLocales()[0]?.languageCode || 'ko';
        // 언어 코드 정규화
        let normalizedLang = defaultLanguage;
        if (defaultLanguage === 'ja') {
          normalizedLang = 'jp';
        } else if (defaultLanguage === 'zh') {
          // 중국어는 지역 코드로 구분
          const regionCode = Localization.getLocales()[0]?.regionCode || '';
          // 간체: CN, SG 등 / 번체: TW, HK, MO 등
          normalizedLang = (regionCode === 'CN' || regionCode === 'SG') ? 'zh-CN' : 'zh-TW';
        }
        language = supportedLanguages.includes(normalizedLang) ? normalizedLang : 'ko';
      }

      // i18n 초기화
      await i18n.use(initReactI18next).init({
        compatibilityJSON: 'v3',
        resources,
        lng: language,
        fallbackLng: 'ko',
        interpolation: {
          escapeValue: false,
        },
      });

      isInitialized = true;
      console.log('✅ i18n 초기화 완료:', language);
    } catch (error) {
      console.error('❌ i18n 초기화 실패:', error);
      // 에러가 발생해도 앱은 계속 실행되도록 기본값 설정
      await i18n.use(initReactI18next).init({
        compatibilityJSON: 'v3',
        resources,
        lng: 'ko',
        fallbackLng: 'ko',
        interpolation: {
          escapeValue: false,
        },
      });
      isInitialized = true;
    }
  })();

  return initPromise;
}

/**
 * i18n이 초기화되었는지 확인
 */
export function isI18nReady(): boolean {
  return isInitialized;
}

/**
 * 안전하게 언어를 변경합니다.
 * 초기화가 완료된 후에만 작동합니다.
 */
export async function changeLanguage(language: 'ko' | 'en' | 'jp' | 'zh-CN' | 'zh-TW' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru'): Promise<boolean> {
  try {
    // 초기화가 완료되지 않았으면 대기
    if (!isInitialized) {
      await initPromise;
    }

    // 유효한 언어인지 확인
    const supportedLanguages = ['ko', 'en', 'jp', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'it', 'pt', 'ru'];
    if (!supportedLanguages.includes(language)) {
      console.error('❌ 유효하지 않은 언어:', language);
      return false;
    }

    // 언어 변경
    await i18n.changeLanguage(language);

    // AsyncStorage에 저장
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      console.log('✅ 언어 변경 및 저장 완료:', language);
    } catch (error) {
      console.error('❌ 언어 저장 실패:', error);
      // 저장 실패해도 언어는 변경됨
    }

    return true;
  } catch (error) {
    console.error('❌ 언어 변경 실패:', error);
    return false;
  }
}

/**
 * 현재 언어 가져오기
 */
export function getCurrentLanguage(): string {
  return i18n.language || 'ko';
}

export default i18n;


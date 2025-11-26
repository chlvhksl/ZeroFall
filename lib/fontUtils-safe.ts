/**
 * 안전한 폰트 유틸리티
 * i18n과 충돌하지 않도록 설계
 */

import { Platform } from 'react-native';
import React from 'react';
import i18n from './i18n-safe';

// 한국어/영어 폰트 상수
const FONT_REGULAR = 'NanumSquare-Regular';
const FONT_BOLD = 'NanumSquare-Bold';
const FONT_EXTRABOLD = 'NanumSquare-ExtraBold';

// 시스템 폰트 상수 (CJK 언어용)
// iOS: PingFang 시리즈 사용
// Android: sans-serif 시리즈 사용
const getSystemFont = (weight: 'regular' | 'bold' | 'extraBold', variant: 'jp' | 'sc' | 'tc') => {
  if (Platform.OS === 'ios') {
    // iOS: PingFang 폰트 사용
    // PingFang은 ExtraBold를 지원하지 않으므로 Bold로 fallback
    const pingFangName = variant === 'jp' ? 'PingFang JP' : variant === 'sc' ? 'PingFang SC' : 'PingFang TC';
    return pingFangName;
  } else {
    // Android: sans-serif 시리즈 사용
    if (weight === 'regular') return 'sans-serif';
    if (weight === 'bold') return 'sans-serif-medium';
    if (weight === 'extraBold') return 'sans-serif-black';
    return 'sans-serif';
  }
};

// 유럽 언어 폰트 상수 (NotoSans)
const FONT_EU_REGULAR = 'NotoSans-Regular';
const FONT_EU_BOLD = 'NotoSans-Bold';
const FONT_EU_EXTRABOLD = 'NotoSans-ExtraBold';

export interface Fonts {
  regular: string;
  bold: string;
  extraBold: string;
}

/**
 * 언어에 따라 폰트를 반환합니다.
 * i18n이 준비되지 않았으면 기본 Nanum 폰트를 반환합니다.
 */
export function getFontByLanguage(): Fonts {
  try {
    // i18n이 초기화되지 않았으면 기본값 반환
    if (!i18n.isInitialized) {
      return {
        regular: FONT_REGULAR,
        bold: FONT_BOLD,
        extraBold: FONT_EXTRABOLD,
      };
    }

    const language = i18n.language || 'ko';

    // 일본어는 시스템 폰트 사용 (PingFang JP / sans-serif)
    if (language === 'jp') {
      return {
        regular: getSystemFont('regular', 'jp'),
        bold: getSystemFont('bold', 'jp'),
        extraBold: getSystemFont('extraBold', 'jp'),
      };
    }

    // 간체 중국어는 시스템 폰트 사용 (PingFang SC / sans-serif)
    if (language === 'zh-CN' || language === 'sc') {
      return {
        regular: getSystemFont('regular', 'sc'),
        bold: getSystemFont('bold', 'sc'),
        extraBold: getSystemFont('extraBold', 'sc'),
      };
    }

    // 번체 중국어는 시스템 폰트 사용 (PingFang TC / sans-serif)
    if (language === 'zh-TW' || language === 'tc') {
      return {
        regular: getSystemFont('regular', 'tc'),
        bold: getSystemFont('bold', 'tc'),
        extraBold: getSystemFont('extraBold', 'tc'),
      };
    }

    // 유럽 언어는 NotoSans 폰트 사용 (스페인어, 프랑스어, 독일어, 이탈리아어, 포르투갈어, 러시아어)
    if (['es', 'fr', 'de', 'it', 'pt', 'ru'].includes(language)) {
      return {
        regular: FONT_EU_REGULAR,
        bold: FONT_EU_BOLD,
        extraBold: FONT_EU_EXTRABOLD,
      };
    }

    // 한국어와 영어는 Nanum 폰트 사용
    if (language === 'ko' || language === 'en') {
      return {
        regular: FONT_REGULAR,
        bold: FONT_BOLD,
        extraBold: FONT_EXTRABOLD,
      };
    }

    // 기본값: Nanum 폰트
    return {
      regular: FONT_REGULAR,
      bold: FONT_BOLD,
      extraBold: FONT_EXTRABOLD,
    };
  } catch (error) {
    console.error('폰트 가져오기 실패:', error);
    // 에러 발생 시 기본값 반환
    return {
      regular: FONT_REGULAR,
      bold: FONT_BOLD,
      extraBold: FONT_EXTRABOLD,
    };
  }
}

/**
 * React Hook으로 폰트를 사용합니다.
 */
export function useFontByLanguage(): Fonts {
  const [fonts, setFonts] = React.useState<Fonts>(() => getFontByLanguage());

  React.useEffect(() => {
    // i18n이 초기화되면 폰트 업데이트
    if (i18n.isInitialized) {
      setFonts(getFontByLanguage());
    }

    // 언어 변경 감지
    const handleLanguageChange = (lng: string) => {
      setFonts(getFontByLanguage());
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return fonts;
}



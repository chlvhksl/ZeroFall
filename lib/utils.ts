/**
 * 타임스탬프를 현재 언어에 맞는 시간 형식으로 포맷팅
 * @param timestamp ISO 문자열, Date 객체, 또는 epoch milliseconds
 * @param locale 선택적 로케일 (기본값: 시스템 언어 또는 'ko-KR')
 * @returns 시간 형식 문자열 (예: "2025. 11. 6. 오후 6:00:00" 또는 "11/6/2025, 6:00:00 PM")
 */
export function formatKoreaTime(
  timestamp: string | Date | number | null | undefined,
  locale?: string
): string {
  if (!timestamp) return '-';
  
  try {
    const date = typeof timestamp === 'string' || typeof timestamp === 'number' 
      ? new Date(timestamp) 
      : timestamp;
    
    if (isNaN(date.getTime())) return '-';
    
    // locale이 제공되지 않으면 기본값으로 'ko-KR' 사용
    const targetLocale = locale || 'ko-KR';
    return date.toLocaleString(targetLocale);
  } catch {
    return '-';
  }
}


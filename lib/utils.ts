/**
 * 타임스탬프를 한국 시간 형식으로 포맷팅
 * @param timestamp ISO 문자열, Date 객체, 또는 epoch milliseconds
 * @returns 한국 시간 형식 문자열 (예: "2025. 11. 6. 오후 6:00:00")
 */
export function formatKoreaTime(timestamp: string | Date | number | null | undefined): string {
  if (!timestamp) return '-';
  
  try {
    const date = typeof timestamp === 'string' || typeof timestamp === 'number' 
      ? new Date(timestamp) 
      : timestamp;
    
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleString('ko-KR');
  } catch {
    return '-';
  }
}


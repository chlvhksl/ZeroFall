import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Supabase 프로젝트 설정
// 환경 변수에서 가져오거나 기본값 사용
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

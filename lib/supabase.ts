import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Supabase 프로젝트 설정을 여기에 입력하세요
// https://supabase.com/dashboard에서 프로젝트 설정 > API를 확인하세요
const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseAnonKey = 'your-anon-key-here';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

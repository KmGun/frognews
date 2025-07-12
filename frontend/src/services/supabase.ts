import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경 변수가 설정되지 않았습니다. 목업 데이터를 사용합니다.');
}

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 데이터베이스 타입 정의 (Supabase 테이블 구조에 맞게)
export interface ArticleRow {
  id?: number;
  title_summary: string;
  published_at: string | null;
  url: string;
  image_urls: string; // JSON 문자열
  summary_lines: string; // JSON 문자열
  details: string; // JSON 문자열
  category: number | null;
  created_at: string;
}

// 데이터베이스 테이블 타입
export interface Database {
  public: {
    Tables: {
      articles: {
        Row: ArticleRow;
        Insert: Omit<ArticleRow, 'id' | 'created_at'>;
        Update: Partial<Omit<ArticleRow, 'id' | 'created_at'>>;
      };
    };
  };
}

// 타입이 적용된 Supabase 클라이언트
export const typedSupabase = supabase as typeof supabase & {
  from: <T extends keyof Database['public']['Tables']>(
    table: T
  ) => any;
}; 
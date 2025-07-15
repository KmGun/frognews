import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경 변수가 설정되지 않았습니다. 로컬 개발을 위해 임시 설정을 사용합니다.');
}

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 데이터베이스 타입 정의
export interface Database {
  public: {
    Tables: {
      articles: {
        Row: {
          id: number;
          title_summary: string;
          published_at: string | null;
          url: string;
          image_urls: string;
          summary_lines: string;
          details: string;
          category: number | null;
          is_approved: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['articles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Omit<Database['public']['Tables']['articles']['Row'], 'id' | 'created_at'>>;
      };
      tweets: {
        Row: {
          id: string;
          text: string;
          text_ko: string | null;
          is_translated: boolean;
          translation_model: string | null;
          translated_at: string | null;
          author_name: string;
          author_username: string;
          author_profile_image_url: string | null;
          created_at: string;
          url: string;
          category: number | null;
          is_approved: boolean;
        };
        Insert: Omit<Database['public']['Tables']['tweets']['Row'], 'created_at'>;
        Update: Partial<Omit<Database['public']['Tables']['tweets']['Row'], 'id' | 'created_at'>>;
      };
      youtube_videos: {
        Row: {
          id: string;
          title: string;
          thumbnail_url: string;
          channel_name: string;
          published_at: string;
          duration: string | null;
          view_count: number | null;
          scraped_at: string;
          is_active: boolean;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['youtube_videos']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Database['public']['Tables']['youtube_videos']['Row'], 'id' | 'created_at' | 'updated_at'>>;
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
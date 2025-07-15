// 기본 컨텐츠 인터페이스
export interface BaseContent {
  id: string;
  created_at: string;
  updated_at?: string;
  is_approved: boolean;
  category?: number;
}

// 기사 데이터 타입 (어드민용)
export interface AdminArticle extends BaseContent {
  title_summary: string;
  published_at: string | null;
  url: string;
  image_urls: string; // JSON 문자열
  summary_lines: string; // JSON 문자열  
  details: string; // JSON 문자열
}

// 트위터 게시물 타입 (어드민용)
export interface AdminTweet extends BaseContent {
  text: string;
  text_ko?: string; // 한국어 번역
  is_translated?: boolean; // 번역 여부
  translation_model?: string; // 번역 모델
  translated_at?: string; // 번역 시각
  author_name: string;
  author_username: string;
  author_profile_image_url?: string;
  url: string;
}

// 유튜브 영상 타입 (어드민용)
export interface AdminYouTubeVideo extends BaseContent {
  title: string;
  thumbnail_url: string;
  channel_name: string;
  published_at: string;
  duration?: string;
  view_count?: number;
}

// 파싱된 기사 데이터 (편집용)
export interface ParsedArticle {
  id: string;
  type: 'article';
  titleSummary: string;
  publishedAt?: Date;
  url: string;
  imageUrls: string[];
  summaryLines: string[];
  details: string[];
  category?: number;
  isApproved: boolean;
  createdAt?: Date;
}

// 파싱된 트위터 게시물 (편집용)
export interface ParsedTweet {
  id: string;
  type: 'tweet';
  text: string;
  textKo?: string;
  isTranslated?: boolean;
  translationModel?: string;
  translatedAt?: Date;
  author: {
    name: string;
    username: string;
    profileImageUrl?: string;
  };
  createdAt: Date;
  url: string;
  category?: number;
  isApproved: boolean;
}

// 파싱된 유튜브 영상 (편집용)
export interface ParsedYouTubeVideo {
  id: string;
  type: 'youtube';
  title: string;
  thumbnailUrl: string;
  channelName: string;
  publishedAt: Date;
  duration?: string;
  viewCount?: number;
  category?: number;
  isApproved: boolean;
}

// 카테고리 매핑
export const CATEGORIES = {
  1: { name: '오픈소스', color: '#10b981' },
  2: { name: '서비스', color: '#3b82f6' },
  3: { name: '연구', color: '#8b5cf6' },
  4: { name: '비즈니스/산업', color: '#f59e0b' },
  5: { name: '기타', color: '#6b7280' }
} as const;

// 필터링 옵션
export interface FilterOptions {
  category?: number;
  isApproved?: boolean;
  contentType?: 'articles' | 'tweets' | 'youtube_videos';
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

// 페이지네이션 옵션
export interface PaginationOptions {
  page: number;
  limit: number;
  total: number;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

// 컨텐츠 업데이트 타입
export interface ContentUpdate {
  id: string;
  contentType: 'articles' | 'tweets' | 'youtube_videos';
  updates: Record<string, any>;
}

// 일괄 승인 요청 타입
export interface BulkApprovalRequest {
  contentType: 'articles' | 'tweets' | 'youtube_videos';
  ids: string[];
  isApproved: boolean;
} 
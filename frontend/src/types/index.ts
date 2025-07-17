// 기사 데이터 타입
export interface Article {
  id?: string;
  titleSummary: string;
  publishedAt?: Date;
  url: string;
  imageUrls: string[];
  summaryLines: string[];
  details: string[];
  category?: number; // 1: 오픈소스, 2: 서비스, 3: 연구, 4: 비즈니스/산업, 5: 기타
  createdAt?: Date;
}

// 트위터 게시물 타입
export interface Tweet {
  id: string;
  text: string;
  textKo?: string; // 한국어 번역
  isTranslated?: boolean; // 번역 여부
  translationModel?: string; // 번역 모델
  translatedAt?: Date; // 번역 시각
  author: {
    name: string;
    username: string;
    profileImageUrl: string;
  };
  createdAt: Date;
  url: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
  };
  category?: number; // 1~5 카테고리 태깅
  // 미디어 정보
  media?: string[]; // 이미지 URL 배열
  // 비디오 임베드 관련 필드
  hasVideo?: boolean; // 비디오 포함 여부
  videoEmbedInfo?: {
    tweetId: string; // 트위터 게시물 ID
    username: string; // 작성자 username
    embedUrl: string; // 임베드용 URL
  };
}

// 유튜브 영상 타입
export interface YouTubeVideo {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  channelName: string;
  channelUrl?: string;
  publishedAt: Date;
  createdAt: Date;
  duration?: string;
  viewCount?: number;
  url: string;
}

// 사용자 타입
export interface User {
  id: string;
  sessionId: string;
  userAgent?: string;
  firstVisitAt: Date;
  lastVisitAt: Date;
  totalArticlesRead: number;
  createdAt: Date;
  updatedAt: Date;
}

// 사용자가 읽은 기사 타입
export interface UserReadArticle {
  id: string;
  userId: string;
  articleId: string;
  readAt: Date;
  readingDuration: number; // 초 단위
  createdAt: Date;
}

// 카테고리 매핑
export const CATEGORIES = {
  1: { name: "오픈소스", color: "#10b981" },
  2: { name: "서비스", color: "#3b82f6" },
  3: { name: "연구", color: "#8b5cf6" },
  4: { name: "비즈니스/산업", color: "#f59e0b" },
  5: { name: "기타", color: "#6b7280" },
} as const;

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

// 스크래핑 결과 타입
export interface ScrapingResult {
  success: boolean;
  articles: Article[];
  errors: string[];
  source: string;
  scrapedAt: Date;
  totalCount: number;
}

// 필터링 옵션
export interface FilterOptions {
  category?: number;
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

// 로컬 스토리지 키
export const LOCAL_STORAGE_KEYS = {
  THEME: "frognews-theme",
  FAVORITES: "frognews-favorites",
  RECENT_ARTICLES: "frognews-recent-articles",
} as const;

// 테마 타입
export type Theme = "light" | "dark";

// 컴포넌트 Props 타입들
export interface ArticleCardProps {
  article: Article;
  onClick?: () => void;
}

export interface CategoryTagProps {
  category: number;
  active?: boolean;
  onClick?: () => void;
}

export interface ImageCarouselProps {
  images: string[];
  title: string;
}

export interface SummaryLineProps {
  line: string;
  detail: string;
  expanded?: boolean;
  onToggle?: () => void;
}

// 사용자 피드백 타입
export interface UserFeedback {
  id?: string;
  userId: string;
  score: number; // 1-10점
  feedbackText?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 피드백 제출 데이터 타입
export interface FeedbackSubmission {
  score: number;
  feedbackText: string;
}

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

// 스크래핑 결과 타입
export interface ScrapingResult {
  success: boolean;
  articles: Article[];
  errors: string[];
  source: string;
  scrapedAt: Date;
  totalCount: number;
}

// 뉴스 소스 설정 타입
export interface NewsSource {
  id: string;
  name: string;
  baseUrl: string;
  listPageUrl: string;
  selectors: {
    articleLinks: string;
    title: string;
    content: string;
    author?: string;
    publishedAt?: string;
    category?: string;
    imageUrl?: string;
  };
  enabled: boolean;
  scrapeInterval: number; // 분 단위
}

// 스크래핑 설정 타입
export interface ScrapingConfig {
  maxConcurrent: number;
  timeout: number;
  retryAttempts: number;
  delayBetweenRequests: number;
  userAgent: string;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

// 스크래핑 작업 상태
export enum ScrapingStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 스크래핑 작업 타입
export interface ScrapingJob {
  id: string;
  sourceId: string;
  status: ScrapingStatus;
  startedAt?: Date;
  completedAt?: Date;
  articlesCount: number;
  errors: string[];
} 
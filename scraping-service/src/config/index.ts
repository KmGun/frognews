import dotenv from 'dotenv';
import { NewsSource, ScrapingConfig } from '@/types';

dotenv.config();

// 환경 변수
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001'),
  
  // Supabase 설정
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  
  // 스크래핑 설정
  MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS || '3'),
  SCRAPING_TIMEOUT: parseInt(process.env.SCRAPING_TIMEOUT || '30000'),
  RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS || '3'),
  DELAY_BETWEEN_REQUESTS: parseInt(process.env.DELAY_BETWEEN_REQUESTS || '1000'),
  
  // 브라우저 설정
  BROWSER_HEADLESS: process.env.BROWSER_HEADLESS === 'true',
  BROWSER_TIMEOUT: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
};

// 스크래핑 기본 설정
export const SCRAPING_CONFIG: ScrapingConfig = {
  maxConcurrent: ENV.MAX_CONCURRENT_JOBS,
  timeout: ENV.SCRAPING_TIMEOUT,
  retryAttempts: ENV.RETRY_ATTEMPTS,
  delayBetweenRequests: ENV.DELAY_BETWEEN_REQUESTS,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// 뉴스 소스 설정
export const NEWS_SOURCES: NewsSource[] = [
  {
    id: 'chosun',
    name: '조선일보',
    baseUrl: 'https://www.chosun.com',
    listPageUrl: 'https://www.chosun.com/national/',
    selectors: {
      articleLinks: 'a[href*="/national/"]',
      title: '.article-header h1, .news-title h1',
      content: '.article-body, .news-content',
      author: '.reporter-name, .byline',
      publishedAt: '.date-time, .news-date',
      category: '.category, .section-name',
      imageUrl: '.article-photo img, .news-photo img'
    },
    enabled: true,
    scrapeInterval: 60 // 60분마다
  },
  {
    id: 'hankyung',
    name: '한국경제',
    baseUrl: 'https://www.hankyung.com',
    listPageUrl: 'https://www.hankyung.com/economy',
    selectors: {
      articleLinks: 'a[href*="/article/"]',
      title: '.headline, .news-tit',
      content: '.article-body, .news-body',
      author: '.journalist, .reporter',
      publishedAt: '.date, .news-date',
      category: '.category',
      imageUrl: '.photo img, .article-img img'
    },
    enabled: true,
    scrapeInterval: 60
  },
  {
    id: 'yonhap',
    name: '연합뉴스',
    baseUrl: 'https://www.yna.co.kr',
    listPageUrl: 'https://www.yna.co.kr/economy',
    selectors: {
      articleLinks: 'a[href*="/view/"]',
      title: '.tit, .article-tit',
      content: '.story-news, .article-txt',
      author: '.writer, .byline',
      publishedAt: '.date, .article-date',
      category: '.category',
      imageUrl: '.img-wrap img, .photo img'
    },
    enabled: true,
    scrapeInterval: 45
  }
];

// 크론 작업 스케줄
export const CRON_SCHEDULES = {
  // 매 30분마다 스크래핑
  REGULAR_SCRAPING: '*/30 * * * *',
  // 매일 새벽 2시에 전체 정리
  DAILY_CLEANUP: '0 2 * * *',
  // 매시간 헬스 체크
  HEALTH_CHECK: '0 * * * *'
};

// 로깅 설정
export const LOG_CONFIG = {
  level: ENV.NODE_ENV === 'production' ? 'info' : 'debug',
  format: ENV.NODE_ENV === 'production' ? 'json' : 'simple',
  maxFiles: 7,
  maxSize: '20m'
}; 
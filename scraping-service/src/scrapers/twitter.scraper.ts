import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { scrapingLogger } from '../utils/logger';
import { translateTweetToKorean, canTranslate } from '../utils/translation';
import { SCRAPING_CONFIG } from '../config';

export interface TwitterPostData {
  id: string;
  text: string;
  textKo?: string; // 한국어 번역
  isTranslated?: boolean; // 번역 여부
  translationModel?: string; // 번역 모델
  translatedAt?: Date; // 번역 시각
  author: {
    name: string;
    username: string;
    profileImageUrl?: string;
  };
  createdAt: Date;
  url: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export class TwitterScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  // 브라우저 초기화
  async initBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: false, // 디버깅을 위해 보이게
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--start-maximized'
        ]
      });

      this.page = await this.browser.newPage();
      
      // User Agent 설정 (일반 브라우저처럼)
      await this.page.setUserAgent(SCRAPING_CONFIG.userAgent);
      
      // 뷰포트 설정
      await this.page.setViewport({ width: 1280, height: 720 });
      
      scrapingLogger.info('트위터 브라우저 초기화 완료');
    } catch (error) {
      scrapingLogger.error('브라우저 초기화 실패', error as Error);
      throw error;
    }
  }

  // 브라우저 종료
  async closeBrowser(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      scrapingLogger.info('트위터 브라우저 종료 완료');
    } catch (error) {
      scrapingLogger.error('브라우저 종료 실패', error as Error);
    }
  }

  // 지연 함수
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 트위터 URL에서 게시물 ID 추출
  private extractTweetId(url: string): string | null {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // 날짜 파싱 함수
  private parseTwitterDate(dateText: string): Date {
    // 트위터 날짜 형식 처리
    // 예: "오후 2:30 · 2024년 1월 10일" 또는 "2:30 PM · Jan 10, 2024"
    try {
      // 상대 시간 처리 (예: "2시간", "1일 전")
      if (dateText.includes('시간')) {
        const hours = parseInt(dateText.match(/(\d+)시간/)?.[1] || '0');
        return new Date(Date.now() - hours * 60 * 60 * 1000);
      }
      if (dateText.includes('일')) {
        const days = parseInt(dateText.match(/(\d+)일/)?.[1] || '0');
        return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
      if (dateText.includes('분')) {
        const minutes = parseInt(dateText.match(/(\d+)분/)?.[1] || '0');
        return new Date(Date.now() - minutes * 60 * 1000);
      }

      // 절대 시간 처리는 현재 시간으로 대체 (복잡한 파싱 대신)
      return new Date();
    } catch (error) {
      scrapingLogger.warn(`날짜 파싱 실패: ${dateText}`);
      return new Date();
    }
  }

  // 숫자 파싱 함수 (1.2K -> 1200)
  private parseMetricNumber(text: string): number {
    if (!text) return 0;
    
    const cleanText = text.replace(/[,\s]/g, '');
    const match = cleanText.match(/(\d+(?:\.\d+)?)(K|M|만|천)?/i);
    
    if (!match) return 0;
    
    const number = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase();
    
    switch (unit) {
      case 'K':
      case '천':
        return Math.round(number * 1000);
      case 'M':
        return Math.round(number * 1000000);
      case '만':
        return Math.round(number * 10000);
      default:
        return Math.round(number);
    }
  }

  // 개별 트위터 게시물 스크래핑
  async scrapeTweetDetails(tweetUrl: string): Promise<TwitterPostData | null> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      scrapingLogger.info(`트위터 게시물 스크래핑 시작: ${tweetUrl}`);
      
      // 트위터 페이지 로드
      await this.page.goto(tweetUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 페이지 로딩 대기
      await this.delay(3000);

      // 로그인 요구 시 처리 (간단한 우회)
      try {
        await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 5000 });
      } catch {
        scrapingLogger.warn('트위터 로그인 요구 또는 게시물 로딩 실패');
        return null;
      }

      const content = await this.page.content();
      const $ = cheerio.load(content);

      // 트위터 게시물 ID 추출
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        scrapingLogger.error('트위터 게시물 ID 추출 실패');
        return null;
      }

      // 게시물 텍스트 추출
      let tweetText = '';
      const textSelectors = [
        '[data-testid="tweetText"]',
        '[data-testid="tweet"] div[lang]',
        'div[data-testid="tweet"] span',
        '.tweet-text',
        '.TweetTextSize'
      ];

      for (const selector of textSelectors) {
        const textElement = $(selector).first();
        if (textElement.length > 0) {
          tweetText = textElement.text().trim();
          if (tweetText) break;
        }
      }

      // 작성자 정보 추출
      let authorName = '';
      let authorUsername = '';
      let profileImageUrl = '';

      const authorNameSelectors = [
        '[data-testid="User-Name"] span',
        '.ProfileHeaderCard-nameLink',
        '.ProfileNameTruncated-link'
      ];

      for (const selector of authorNameSelectors) {
        const nameElement = $(selector).first();
        if (nameElement.length > 0) {
          authorName = nameElement.text().trim();
          if (authorName) break;
        }
      }

      const usernameSelectors = [
        '[data-testid="User-Name"] a[href*="/"]',
        '.ProfileHeaderCard-screenname',
        '.username'
      ];

      for (const selector of usernameSelectors) {
        const usernameElement = $(selector).first();
        if (usernameElement.length > 0) {
          const href = usernameElement.attr('href');
          if (href) {
            authorUsername = href.replace('/', '').replace('@', '');
            if (authorUsername) break;
          }
        }
      }

      // 프로필 이미지 추출
      const profileImageSelectors = [
        '[data-testid="Tweet-User-Avatar"] img',
        '.ProfileAvatar-image',
        '.avatar img'
      ];

      for (const selector of profileImageSelectors) {
        const imgElement = $(selector).first();
        if (imgElement.length > 0) {
          profileImageUrl = imgElement.attr('src') || '';
          if (profileImageUrl) break;
        }
      }

      // 게시물 날짜 추출
      let createdAt = new Date();
      const dateSelectors = [
        '[data-testid="Tweet-User-Name"] time',
        '.tweet-timestamp',
        '.ProfileTweet-timestamp'
      ];

      for (const selector of dateSelectors) {
        const dateElement = $(selector).first();
        if (dateElement.length > 0) {
          const dateText = dateElement.text().trim();
          if (dateText) {
            createdAt = this.parseTwitterDate(dateText);
            break;
          }
        }
      }

      // 기본 데이터 구성
      const tweetData: TwitterPostData = {
        id: tweetId,
        text: tweetText,
        author: {
          name: authorName,
          username: authorUsername,
          profileImageUrl: profileImageUrl
        },
        createdAt: createdAt,
        url: tweetUrl
      };

      // 번역 기능 (영어 게시물인 경우)
      if (canTranslate() && tweetText) {
        try {
          scrapingLogger.info('번역 시도 중...');
          const translatedText = await translateTweetToKorean(tweetText);
          
          if (translatedText) {
            tweetData.textKo = translatedText;
            tweetData.isTranslated = true;
            tweetData.translationModel = 'gpt-4.1';
            tweetData.translatedAt = new Date();
            scrapingLogger.info('번역 완료');
          } else {
            tweetData.isTranslated = false;
            scrapingLogger.info('번역 불필요 또는 실패');
          }
        } catch (error) {
          scrapingLogger.error('번역 중 오류 발생:', error as Error);
          tweetData.isTranslated = false;
        }
      } else {
        tweetData.isTranslated = false;
        if (!canTranslate()) {
          scrapingLogger.warn('OpenAI API 키가 설정되지 않아 번역을 건너뜁니다.');
        }
      }

      // 데이터 검증
      if (!tweetText || !authorName) {
        scrapingLogger.error('필수 데이터 추출 실패');
        return null;
      }

      scrapingLogger.info('트위터 게시물 스크래핑 완료');
      return tweetData;

    } catch (error) {
      scrapingLogger.error('트위터 게시물 스크래핑 실패:', error as Error);
      return null;
    }
  }

  // 전체 스크래핑 프로세스
  async scrapeTweet(tweetUrl: string): Promise<TwitterPostData | null> {
    try {
      await this.initBrowser();
      const result = await this.scrapeTweetDetails(tweetUrl);
      return result;
    } catch (error) {
      scrapingLogger.error('트위터 스크래핑 프로세스 실패', error as Error);
      return null;
    } finally {
      await this.closeBrowser();
    }
  }
} 
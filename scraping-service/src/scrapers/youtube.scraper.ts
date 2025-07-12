import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { scrapingLogger } from '../utils/logger';
import { SCRAPING_CONFIG } from '../config';
import { YouTubeVideoData } from '../utils/save-youtube-videos';

export class YouTubeScraper {
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
      
      scrapingLogger.info('유튜브 브라우저 초기화 완료');
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
      scrapingLogger.info('유튜브 브라우저 종료 완료');
    } catch (error) {
      scrapingLogger.error('브라우저 종료 실패', error as Error);
    }
  }

  // 지연 함수
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // YouTube URL에서 비디오 ID 추출
  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^&\n?#]+)/,
      /(?:https?:\/\/)?youtu\.be\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  // 조회수 파싱 함수 (1,234,567 조회수 -> 1234567)
  private parseViewCount(text: string): number {
    if (!text) return 0;
    
    // "1,234,567 조회수" 또는 "1.2M views" 형태
    const cleanText = text.replace(/[,\s조회수views]/gi, '');
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

  // 날짜 파싱 함수
  private parsePublishedDate(dateText: string): Date {
    try {
      // "2024년 1월 10일" 또는 "Jan 10, 2024" 형태
      if (dateText.includes('년')) {
        const match = dateText.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        if (match) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
      }
      
      // 상대 시간 처리 (예: "2시간 전", "1일 전")
      if (dateText.includes('시간')) {
        const hours = parseInt(dateText.match(/(\d+)시간/)?.[1] || '0');
        return new Date(Date.now() - hours * 60 * 60 * 1000);
      }
      if (dateText.includes('일')) {
        const days = parseInt(dateText.match(/(\d+)일/)?.[1] || '0');
        return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
      if (dateText.includes('주')) {
        const weeks = parseInt(dateText.match(/(\d+)주/)?.[1] || '0');
        return new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
      }
      if (dateText.includes('개월')) {
        const months = parseInt(dateText.match(/(\d+)개월/)?.[1] || '0');
        return new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000);
      }
      if (dateText.includes('년')) {
        const years = parseInt(dateText.match(/(\d+)년/)?.[1] || '0');
        return new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000);
      }

      // 기본값
      return new Date();
    } catch (error) {
      scrapingLogger.warn(`날짜 파싱 실패: ${dateText}`);
      return new Date();
    }
  }

  // 개별 YouTube 영상 스크래핑
  async scrapeVideoDetails(videoUrl: string): Promise<YouTubeVideoData | null> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      scrapingLogger.info(`유튜브 영상 스크래핑 시작: ${videoUrl}`);
      
      // YouTube 페이지 로드
      await this.page.goto(videoUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 페이지 로딩 대기
      await this.delay(5000);

      // 동의 팝업 처리 (있을 경우)
      try {
        const acceptButton = await this.page.$('button[aria-label*="Accept"], button[aria-label*="동의"]');
        if (acceptButton) {
          await acceptButton.click();
          await this.delay(2000);
        }
      } catch (error) {
        // 동의 버튼이 없으면 무시
      }

      const content = await this.page.content();
      const $ = cheerio.load(content);

      // 비디오 ID 추출
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        scrapingLogger.error('유튜브 비디오 ID 추출 실패');
        return null;
      }

      // 제목 추출
      let title = '';
      const titleSelectors = [
        'h1.ytd-video-primary-info-renderer',
        'h1.title',
        'h1[class*="title"]',
        'meta[property="og:title"]'
      ];

      for (const selector of titleSelectors) {
        if (selector.startsWith('meta')) {
          title = $(selector).attr('content') || '';
        } else {
          title = $(selector).text().trim();
        }
        if (title) break;
      }

      // 채널명 추출
      let channelName = '';
      const channelSelectors = [
        '#channel-name #text',
        '.ytd-channel-name a',
        '#owner-name a',
        'meta[property="og:site_name"]'
      ];

      for (const selector of channelSelectors) {
        if (selector.startsWith('meta')) {
          channelName = $(selector).attr('content') || '';
        } else {
          channelName = $(selector).text().trim();
        }
        if (channelName) break;
      }

      // 썸네일 URL 생성 (YouTube 표준 썸네일 URL)
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      // 조회수 추출
      let viewCount = 0;
      const viewSelectors = [
        '#info-contents #count',
        '.view-count',
        'meta[itemprop="interactionCount"]'
      ];

      for (const selector of viewSelectors) {
        let viewText = '';
        if (selector.startsWith('meta')) {
          viewText = $(selector).attr('content') || '';
        } else {
          viewText = $(selector).text().trim();
        }
        if (viewText) {
          viewCount = this.parseViewCount(viewText);
          break;
        }
      }

      // 업로드 날짜 추출
      let publishedAt = new Date();
      const dateSelectors = [
        '#info-strings yt-formatted-string',
        '.date',
        'meta[itemprop="datePublished"]'
      ];

      for (const selector of dateSelectors) {
        let dateText = '';
        if (selector.startsWith('meta')) {
          dateText = $(selector).attr('content') || '';
          if (dateText) {
            publishedAt = new Date(dateText);
            break;
          }
        } else {
          dateText = $(selector).text().trim();
          if (dateText && (dateText.includes('전') || dateText.includes('년') || dateText.includes('월'))) {
            publishedAt = this.parsePublishedDate(dateText);
            break;
          }
        }
      }

      // 영상 길이 추출 (선택사항)
      let duration = '';
      const durationSelectors = [
        '.ytp-time-duration',
        'meta[itemprop="duration"]'
      ];

      for (const selector of durationSelectors) {
        if (selector.startsWith('meta')) {
          duration = $(selector).attr('content') || '';
        } else {
          duration = $(selector).text().trim();
        }
        if (duration) break;
      }

      // 데이터 검증
      if (!title || !channelName) {
        scrapingLogger.error('필수 데이터 추출 실패');
        scrapingLogger.error(`제목: ${title}, 채널: ${channelName}`);
        return null;
      }

      const videoData: YouTubeVideoData = {
        id: videoId,
        title: title,
        thumbnailUrl: thumbnailUrl,
        channelName: channelName,
        publishedAt: publishedAt,
        duration: duration || undefined,
        viewCount: viewCount || undefined
      };

      scrapingLogger.info('유튜브 영상 스크래핑 완료');
      return videoData;

    } catch (error) {
      scrapingLogger.error('유튜브 영상 스크래핑 실패:', error as Error);
      return null;
    }
  }

  // 전체 스크래핑 프로세스
  async scrapeVideo(videoUrl: string): Promise<YouTubeVideoData | null> {
    try {
      await this.initBrowser();
      const result = await this.scrapeVideoDetails(videoUrl);
      return result;
    } catch (error) {
      scrapingLogger.error('유튜브 스크래핑 프로세스 실패', error as Error);
      return null;
    } finally {
      await this.closeBrowser();
    }
  }
} 
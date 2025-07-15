import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { scrapingLogger } from '../utils/logger';
import { SCRAPING_CONFIG } from '../config';
import { YouTubeVideoData } from '../utils/save-youtube-videos';
import { filterNewVideoIds, extractVideoIdFromUrl, calculatePerformanceMetrics } from '../utils/duplicate-checker';

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

  // 여러 영상 스크래핑 (중복 체크 포함)
  async scrapeMultipleVideos(videoUrls: string[]): Promise<YouTubeVideoData[]> {
    const allVideos: YouTubeVideoData[] = [];
    
    if (videoUrls.length === 0) {
      scrapingLogger.warn('스크래핑할 영상 URL이 없습니다');
      return allVideos;
    }

    try {
      await this.initBrowser();

      console.log(`📋 총 ${videoUrls.length}개 영상 URL 받음`);
      
      // 1단계: 비디오 ID 추출 및 중복 체크
      const allVideoIds = videoUrls.map(url => extractVideoIdFromUrl(url)).filter(id => id !== null) as string[];
      
      if (allVideoIds.length === 0) {
        console.log('❌ 유효한 영상 ID를 찾을 수 없습니다');
        return allVideos;
      }

      console.log('🔍 기존 데이터 중복 체크 중...');
      const newVideoIds = await filterNewVideoIds(allVideoIds);
      
      if (newVideoIds.length === 0) {
        console.log('✅ 새로운 영상이 없습니다 (모든 영상이 이미 수집됨)');
        return allVideos;
      }

      // 2단계: 성능 메트릭 계산 및 표시
      const metrics = calculatePerformanceMetrics(allVideoIds.length, newVideoIds.length);
      console.log(`📊 효율성 리포트:`);
      console.log(`   전체 영상: ${metrics.totalItems}개`);
      console.log(`   새로운 영상: ${metrics.newItems}개`);
      console.log(`   중복 제외: ${metrics.duplicateItems}개`);
      console.log(`   ⚡ 효율성: ${metrics.efficiencyPercentage}% 작업량 절약`);
      console.log(`   ⏱️ 시간 절약: ${metrics.timeSaved}`);
      console.log(`   💰 비용 절약: ${metrics.costSaved}`);
      scrapingLogger.info(`효율성 - 새로운 영상 ${newVideoIds.length}/${allVideoIds.length}개, ${metrics.efficiencyPercentage}% 절약`);

      // 3단계: 새로운 영상들만 상세 스크래핑
      const newVideoUrls = videoUrls.filter(url => {
        const videoId = extractVideoIdFromUrl(url);
        return videoId && newVideoIds.includes(videoId);
      });

      console.log(`📊 실제 처리할 영상: ${newVideoUrls.length}개`);
      
      for (let i = 0; i < newVideoUrls.length; i++) {
        const url = newVideoUrls[i];
        scrapingLogger.info(`영상 ${i + 1}/${newVideoUrls.length} 스크래핑 중...`);
        
        try {
          const videoData = await this.scrapeVideoDetails(url);
          
          if (videoData) {
            allVideos.push(videoData);
            scrapingLogger.info(`영상 추가: ${videoData.title.substring(0, 50)}...`);
          }
        } catch (error) {
          scrapingLogger.error(`영상 스크래핑 실패 (${url}):`, error);
        }

        // 요청 간 지연
        await this.delay(SCRAPING_CONFIG.delayBetweenRequests);
      }
      
      scrapingLogger.info(`전체 스크래핑 완료: 총 ${allVideos.length}개의 영상 수집`);
      return allVideos;
      
    } catch (error) {
      scrapingLogger.error('다중 영상 스크래핑 실패:', error as Error);
      return allVideos;
    } finally {
      await this.closeBrowser();
    }
  }

  // 전체 스크래핑 프로세스 (단일 영상)
  async scrapeVideo(videoUrl: string): Promise<YouTubeVideoData | null> {
    try {
      // 단일 영상도 중복 체크를 통과
      const videoId = extractVideoIdFromUrl(videoUrl);
      if (!videoId) {
        scrapingLogger.error('유효하지 않은 유튜브 URL입니다');
        return null;
      }

      console.log('🔍 기존 데이터 중복 체크 중...');
      const newVideoIds = await filterNewVideoIds([videoId]);
      
      if (newVideoIds.length === 0) {
        console.log('✅ 이미 수집된 영상입니다');
        scrapingLogger.info('중복 영상 - 이미 존재함');
        return null;
      }

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
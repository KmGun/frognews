import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { scrapingLogger } from '../utils/logger';
import { translateTweetToKorean, canTranslate } from '../utils/translation';
import { detectAIContent, canDetectAIContent, detectTweetCategory } from '../utils/ai-content-detector';
import { filterNewTweetIds, extractTweetIdFromUrl, calculatePerformanceMetrics } from '../utils/duplicate-checker';
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
  category?: number; // 1~5 카테고리 태깅
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
        // 리스너 정리
        this.page.removeAllListeners('framenavigated');
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
      
      // analytics 페이지 이동 방지를 위한 간단한 방법
      this.page.on('framenavigated', async (frame) => {
        if (frame === this.page!.mainFrame()) {
          const currentUrl = frame.url();
          if (currentUrl.includes('/analytics') || currentUrl.includes('analytics.twitter.com')) {
            scrapingLogger.warn(`Analytics 페이지로 이동 감지, 원래 URL로 복귀: ${currentUrl}`);
            await this.page!.goto(tweetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          }
        }
      });
      
      // 트위터 페이지 로드
      await this.page.goto(tweetUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 페이지 로딩 대기
      await this.delay(3000);

      // 현재 URL 확인 - analytics 페이지로 이동했는지 체크
      const currentUrl = this.page.url();
      if (currentUrl.includes('/analytics') || currentUrl.includes('analytics.twitter.com')) {
        scrapingLogger.warn('Analytics 페이지로 이동됨, 원래 URL로 복귀');
        await this.page.goto(tweetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.delay(2000);
      }

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

      // 게시물 텍스트와 링크 추출
      let tweetText = '';
      let links: { shortUrl: string; fullUrl: string }[] = [];
      
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
          // 링크 정보 추출
          textElement.find('a[href]').each((i, linkEl) => {
            const $link = $(linkEl);
            const href = $link.attr('href');
            const linkText = $link.text().trim();
            
            if (href && linkText) {
              // t.co 링크나 단축 링크를 전체 URL로 변환
              let fullUrl = href;
              if (href.startsWith('/')) {
                fullUrl = `https://x.com${href}`;
              } else if (href.startsWith('http')) {
                fullUrl = href;
              }
              
              links.push({
                shortUrl: linkText,
                fullUrl: fullUrl
              });
            }
          });
          
          // 텍스트 추출 (HTML 태그 제거하지만 링크는 유지)
          tweetText = textElement.text().trim();
          if (tweetText) break;
        }
      }

      // 텍스트에서 단축된 링크를 전체 URL로 치환
      if (links.length > 0) {
        for (const link of links) {
          // 단축된 링크 패턴을 전체 URL로 치환
          if (link.shortUrl.includes('...') || link.shortUrl.includes('…')) {
            // … 기호 제거한 링크로 치환
            const cleanFullUrl = link.fullUrl.replace(/…$/, '').replace(/\.\.\.$/, '');
            tweetText = tweetText.replace(link.shortUrl, cleanFullUrl);
          }
        }
      }

      // 추가적으로 t.co 링크들을 실제 페이지에서 추출
      try {
        const expandedLinks = await this.extractExpandedLinks($);
        for (const expandedLink of expandedLinks) {
          // 텍스트에서 t.co 링크를 실제 URL로 치환
          const cleanFullUrl = expandedLink.fullUrl.replace(/…$/, '').replace(/\.\.\.$/, '');
          tweetText = tweetText.replace(expandedLink.shortUrl, cleanFullUrl);
        }
      } catch (error) {
        scrapingLogger.warn('확장된 링크 추출 실패:', error);
      }

      // 최종적으로 남은 … 기호들 정리
      tweetText = tweetText.replace(/https?:\/\/[^\s]+…/g, (match) => {
        return match.replace(/…$/, '');
      });

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

      // AI 관련 게시물인지 먼저 판단
      let isAIRelated = false;
      if (canDetectAIContent()) {
        const aiResult = await detectAIContent(tweetText);
        isAIRelated = aiResult.isAIRelated;
      }
      if (!isAIRelated) {
        scrapingLogger.info('AI 관련 게시물이 아니므로 저장하지 않습니다.');
        return null;
      }

      // 카테고리 태깅
      let category = 5;
      try {
        category = await detectTweetCategory(tweetText);
        scrapingLogger.info(`카테고리 태깅 결과: ${category}`);
      } catch (e) {
        scrapingLogger.warn('카테고리 태깅 실패, 기본값 5로 저장');
      }
      tweetData.category = category;

      // 여기까지 왔다면 AI 관련 게시물이므로 번역 진행
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

      scrapingLogger.info('AI 관련 트위터 게시물 스크래핑 완료');
      return tweetData;

    } catch (error) {
      scrapingLogger.error('트위터 게시물 스크래핑 실패:', error as Error);
      return null;
    }
  }

  // 확장된 링크 추출 메서드
  private async extractExpandedLinks($: any): Promise<{ shortUrl: string; fullUrl: string }[]> {
    const expandedLinks: { shortUrl: string; fullUrl: string }[] = [];
    
    try {
      // 트위터에서 t.co 링크의 실제 URL을 찾는 방법들
      const linkSelectors = [
        '[data-testid="tweetText"] a[href*="t.co"]',
        '[data-testid="tweetText"] a[title]',
        'a[data-focusable="true"][href*="t.co"]'
      ];

      for (const selector of linkSelectors) {
        $(selector).each((_i: number, linkEl: any) => {
          const $link = $(linkEl);
          const href = $link.attr('href');
          const title = $link.attr('title');
          const linkText = $link.text().trim();
          
          // title 속성에 실제 URL이 있는 경우가 많음
          if (href && title && title.startsWith('http')) {
            expandedLinks.push({
              shortUrl: linkText,
              fullUrl: title
            });
          }
          // aria-label에도 실제 URL이 있을 수 있음
          else if (href) {
            const ariaLabel = $link.attr('aria-label');
            if (ariaLabel && ariaLabel.includes('http')) {
              const urlMatch = ariaLabel.match(/https?:\/\/[^\s]+/);
              if (urlMatch) {
                expandedLinks.push({
                  shortUrl: linkText,
                  fullUrl: urlMatch[0]
                });
              }
            }
          }
        });
      }

      return expandedLinks;
    } catch (error) {
      scrapingLogger.warn('확장된 링크 추출 중 오류:', error);
      return [];
    }
  }

  // 사용자 타임라인에서 최신 트윗들 스크래핑
  async scrapeUserTimeline(username: string, maxTweets: number = 10): Promise<TwitterPostData[]> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      scrapingLogger.info(`@${username} 타임라인 스크래핑 시작 (최대 ${maxTweets}개)`);
      
      // 사용자 프로필 페이지로 이동
      const profileUrl = `https://x.com/${username}`;
      await this.page.goto(profileUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 페이지 로딩 대기
      await this.delay(3000);

      // 트윗 링크들 수집
      const tweetUrls: string[] = [];
      let retryCount = 0;
      const maxRetries = 3;

      while (tweetUrls.length < maxTweets && retryCount < maxRetries) {
        try {
          // 트윗 링크 추출
          const newUrls = await this.page.evaluate(() => {
            const tweetElements = document.querySelectorAll('article[data-testid="tweet"] a[href*="/status/"]');
            return Array.from(tweetElements)
              .map(el => (el as HTMLAnchorElement).href)
              .filter(url => url.includes('/status/'));
          });

          // 중복 제거하고 새로운 URL만 추가
          for (const url of newUrls) {
            if (!tweetUrls.includes(url) && tweetUrls.length < maxTweets) {
              tweetUrls.push(url);
            }
          }

          scrapingLogger.info(`현재 수집된 트윗 URL: ${tweetUrls.length}개`);

          // 더 많은 트윗을 위해 스크롤
          if (tweetUrls.length < maxTweets) {
            await this.page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
            });
            await this.delay(2000);
            retryCount++;
          }
        } catch (error) {
          scrapingLogger.warn('트윗 URL 수집 중 오류:', error);
          retryCount++;
        }
      }

      scrapingLogger.info(`총 ${tweetUrls.length}개의 트윗 URL 수집 완료`);

      // 각 트윗 상세 정보 스크래핑
      const tweets: TwitterPostData[] = [];
      
      for (let i = 0; i < tweetUrls.length; i++) {
        const url = tweetUrls[i];
        scrapingLogger.info(`트윗 ${i + 1}/${tweetUrls.length} 스크래핑 중...`);
        
        try {
          const tweetData = await this.scrapeTweetDetails(url);
          
          if (tweetData) {
            // scrapeTweetDetails에서 이미 AI 관련 게시물만 반환하므로 바로 추가
            tweets.push(tweetData);
            scrapingLogger.info(`AI 관련 트윗 추가: ${tweetData.text.substring(0, 50)}...`);
          }
        } catch (error) {
          scrapingLogger.error(`트윗 스크래핑 실패 (${url}):`, error);
        }

        // 요청 간 지연
        await this.delay(SCRAPING_CONFIG.delayBetweenRequests);
      }

      scrapingLogger.info(`@${username} 타임라인 스크래핑 완료: AI 관련 트윗 ${tweets.length}개 수집`);
      return tweets;

    } catch (error) {
      scrapingLogger.error(`@${username} 타임라인 스크래핑 실패:`, error as Error);
      return [];
    }
  }

  // 여러 계정의 타임라인 스크래핑 (중복 체크 포함)
  async scrapeMultipleAccounts(usernames: string[], maxTweetsPerUser: number = 10): Promise<TwitterPostData[]> {
    const allTweets: TwitterPostData[] = [];
    let totalTweetUrls: string[] = [];
    
    try {
      await this.initBrowser();
      
      console.log('🔍 모든 계정에서 트윗 URL 수집 중...');
      
      // 1단계: 모든 계정에서 트윗 URL만 먼저 수집
      for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        scrapingLogger.info(`계정 ${i + 1}/${usernames.length}: @${username} URL 수집 중`);
        
        try {
          const tweetUrls = await this.getUserTweetUrls(username, maxTweetsPerUser);
          totalTweetUrls.push(...tweetUrls);
          
          scrapingLogger.info(`@${username}: ${tweetUrls.length}개 트윗 URL 수집`);
        } catch (error) {
          scrapingLogger.error(`@${username} URL 수집 실패:`, error);
        }

        // 계정 간 지연 (차단 방지)
        if (i < usernames.length - 1) {
          const delayMs = SCRAPING_CONFIG.delayBetweenRequests * 2;
          await this.delay(delayMs);
        }
      }

      console.log(`📋 총 ${totalTweetUrls.length}개 트윗 URL 수집 완료`);
      
      // 2단계: 트윗 ID 추출 및 중복 체크
      const allTweetIds = totalTweetUrls.map(url => extractTweetIdFromUrl(url)).filter(id => id !== null) as string[];
      
      if (allTweetIds.length === 0) {
        console.log('❌ 유효한 트윗 ID를 찾을 수 없습니다');
        return allTweets;
      }

      console.log('🔍 기존 데이터 중복 체크 중...');
      const newTweetIds = await filterNewTweetIds(allTweetIds);
      
      if (newTweetIds.length === 0) {
        console.log('✅ 새로운 트윗이 없습니다 (모든 트윗이 이미 수집됨)');
        return allTweets;
      }

      // 3단계: 성능 메트릭 계산 및 표시
      const metrics = calculatePerformanceMetrics(allTweetIds.length, newTweetIds.length);
      console.log(`📊 효율성 리포트:`);
      console.log(`   전체 트윗: ${metrics.totalItems}개`);
      console.log(`   새로운 트윗: ${metrics.newItems}개`);
      console.log(`   중복 제외: ${metrics.duplicateItems}개`);
      console.log(`   ⚡ 효율성: ${metrics.efficiencyPercentage}% 작업량 절약`);
      console.log(`   ⏱️ 시간 절약: ${metrics.timeSaved}`);
      console.log(`   💰 비용 절약: ${metrics.costSaved}`);
      scrapingLogger.info(`효율성 - 새로운 트윗 ${newTweetIds.length}/${allTweetIds.length}개, ${metrics.efficiencyPercentage}% 절약`);

      // 4단계: 새로운 트윗들만 상세 스크래핑
      const newTweetUrls = totalTweetUrls.filter(url => {
        const tweetId = extractTweetIdFromUrl(url);
        return tweetId && newTweetIds.includes(tweetId);
      });

      console.log(`📊 실제 처리할 트윗: ${newTweetUrls.length}개`);
      
      for (let i = 0; i < newTweetUrls.length; i++) {
        const url = newTweetUrls[i];
        scrapingLogger.info(`트윗 ${i + 1}/${newTweetUrls.length} 스크래핑 중...`);
        
        try {
          const tweetData = await this.scrapeTweetDetails(url);
          
          if (tweetData) {
            // scrapeTweetDetails에서 이미 AI 관련 게시물만 반환하므로 바로 추가
            allTweets.push(tweetData);
            scrapingLogger.info(`AI 관련 트윗 추가: ${tweetData.text.substring(0, 50)}...`);
          }
        } catch (error) {
          scrapingLogger.error(`트윗 스크래핑 실패 (${url}):`, error);
        }

        // 요청 간 지연
        await this.delay(SCRAPING_CONFIG.delayBetweenRequests);
      }
      
      scrapingLogger.info(`전체 스크래핑 완료: 총 ${allTweets.length}개의 AI 관련 트윗 수집`);
      return allTweets;
      
    } catch (error) {
      scrapingLogger.error('다중 계정 스크래핑 실패:', error as Error);
      return allTweets;
    } finally {
      await this.closeBrowser();
    }
  }

  // 사용자 타임라인에서 트윗 URL만 수집 (빠른 수집용)
  async getUserTweetUrls(username: string, maxTweets: number = 10): Promise<string[]> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      // 사용자 프로필 페이지로 이동
      const profileUrl = `https://x.com/${username}`;
      await this.page.goto(profileUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 페이지 로딩 대기
      await this.delay(2000);

      // 트윗 링크들 수집
      const tweetUrls: string[] = [];
      let retryCount = 0;
      const maxRetries = 3;

      while (tweetUrls.length < maxTweets && retryCount < maxRetries) {
        try {
          // 트윗 링크 추출
          const newUrls = await this.page.evaluate(() => {
            const tweetElements = document.querySelectorAll('article[data-testid="tweet"] a[href*="/status/"]');
            return Array.from(tweetElements)
              .map(el => (el as HTMLAnchorElement).href)
              .filter(url => url.includes('/status/'));
          });

          // 중복 제거하고 새로운 URL만 추가
          for (const url of newUrls) {
            if (!tweetUrls.includes(url) && tweetUrls.length < maxTweets) {
              tweetUrls.push(url);
            }
          }

          // 더 많은 트윗을 위해 스크롤
          if (tweetUrls.length < maxTweets) {
            await this.page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
            });
            await this.delay(1000);
            retryCount++;
          }
        } catch (error) {
          scrapingLogger.warn('트윗 URL 수집 중 오류:', error);
          retryCount++;
        }
      }

      return tweetUrls;
    } catch (error) {
      scrapingLogger.error(`@${username} 트윗 URL 수집 실패:`, error as Error);
      return [];
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
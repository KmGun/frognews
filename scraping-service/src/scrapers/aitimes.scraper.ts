import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { Article, NewsSource, ScrapingResult } from '../types';
import { SCRAPING_CONFIG } from '../config';
import { scrapingLogger } from '../utils/logger';

// OpenAI 클라이언트 추가
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ArticleData {
  title: string;
  content: string;
  imageUrls: string[];
  originalUrl: string;
}

export class AiTimesScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = 'https://www.aitimes.kr';
  private listPageUrl: string;
  private openaiApiKey: string;

  constructor(listPageUrl: string, openaiApiKey: string) {
    this.listPageUrl = listPageUrl;
    this.openaiApiKey = openaiApiKey;
  }

  // 브라우저 초기화
  async initBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: false,  // 디버깅을 위해 보이게
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // 시스템 Chrome 사용
        devtools: true,   // 개발자 도구 자동 열기
        slowMo: 250,      // 동작을 천천히
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--start-maximized'
        ]
      });

      this.page = await this.browser.newPage();
      
      // User Agent 설정
      await this.page.setUserAgent(SCRAPING_CONFIG.userAgent);
      
      // 뷰포트 설정
      await this.page.setViewport({ width: 1280, height: 720 });
      
      // 요청 차단 (이미지, 스타일시트 등은 일부만 차단)
      await this.page.setRequestInterception(true);
      this.page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        if (['stylesheet', 'font'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      scrapingLogger.info('AI타임즈 브라우저 초기화 완료');
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
      scrapingLogger.info('AI타임즈 브라우저 종료 완료');
    } catch (error) {
      scrapingLogger.error('브라우저 종료 실패', error as Error);
    }
  }

  // 기사 링크 목록 수집 (수정된 버전)
  async getArticleLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      scrapingLogger.info(`기사 목록 페이지 로드 중: ${this.listPageUrl}`);
      
      // 더 안전한 페이지 로드
      await this.page.goto(this.listPageUrl, {
        waitUntil: ['load', 'domcontentloaded'], // 여러 조건
        timeout: 60000 // 타임아웃 늘리기
      });

      // 페이지 상태 확인
      await this.page.waitForSelector('body', { timeout: 10000 });
      
      // 추가 대기
      await this.page.waitForTimeout(3000);
      
      // 안전한 content 호출
      let content;
      try {
        content = await this.page.content();
      } catch (error) {
        // 재시도
        await this.page.waitForTimeout(2000);
        content = await this.page.content();
      }
      
      const $ = cheerio.load(content);
      
      const links: string[] = [];
      
      // AI타임즈 기사 링크 선택자 (section-body 내의 기사 링크들)
      // 실제 사이트 구조에 맞게 조정 필요
      const selectors = [
        '.section-body a[href*="/news/articleView.html"]',
        '.article-list a[href*="/news/articleView.html"]',
        '.news-list a[href*="/news/articleView.html"]',
        'a[href*="/news/articleView.html"]'
      ];

      for (const selector of selectors) {
        $(selector).each((_: any, element: any) => {
          const href = $(element).attr('href');
          if (href) {
            const fullUrl = href.startsWith('http') 
              ? href 
              : `${this.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
            
            if (!links.includes(fullUrl)) {
              links.push(fullUrl);
            }
          }
        });
        
        if (links.length > 0) break; // 링크를 찾으면 중단
      }

      scrapingLogger.info(`발견된 기사 링크 수: ${links.length}`);
      return links;
    } catch (error) {
      scrapingLogger.error('기사 링크 수집 실패', error as Error);
      throw error;
    }
  }

  // 개별 기사 스크래핑
  
  async scrapeArticleDetails(articleUrl: string): Promise<ArticleData | null> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      scrapingLogger.debug(`기사 상세 페이지 로드 중: ${articleUrl}`);
      
      await this.page.goto(articleUrl, {
        waitUntil: 'networkidle2',
        timeout: SCRAPING_CONFIG.timeout
      });

      await this.page.waitForTimeout(2000);
      
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      // 제목 추출
      const titleSelectors = [
        '.article-header h1',
        '.news-title h1',
        '.article-title',
        '.headline',
        'h1'
      ];
      
      let title = '';
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title) break;
      }
      
      // 본문 추출
      const contentSelectors = [
        '.article-body',
        '.news-content', 
        '.article-content',
        '.story-news',
        '.news-body'
      ];
      
      let articleContent = '';
      for (const selector of contentSelectors) {
        const contentElem = $(selector).first();
        if (contentElem.length > 0) {
          // 광고나 관련 기사 제거
          contentElem.find('.ad, .related, .recommend, .social').remove();
          articleContent = contentElem.text().trim();
          if (articleContent) break;
        }
      }
      
      // 이미지 URL 수집
      const imageUrls: string[] = [];
      const imageSelectors = [
        '.article-body img',
        '.news-content img',
        '.article-photo img',
        '.story-photo img'
      ];
      
      for (const selector of imageSelectors) {
        $(selector).each((_: any, element: any) => {
          const src = $(element).attr('src');
          if (src) {
            const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
            if (!imageUrls.includes(fullUrl)) {
              imageUrls.push(fullUrl);
            }
          }
        });
      }

      if (!title || !articleContent) {
        scrapingLogger.warn(`필수 정보 누락: ${articleUrl}`);
        return null;
      }

      return {
        title: title.trim(),
        content: articleContent.trim(),
        imageUrls,
        originalUrl: articleUrl
      };

    } catch (error) {
      scrapingLogger.error(`기사 스크래핑 실패: ${articleUrl}`, error as Error);
      return null;
    }
  }

  // OpenAI API로 요약 생성
  async generateSummary(title: string, content: string): Promise<string> {
    try {
      // 테스트 모드인 경우 가짜 요약 반환
      if (this.openaiApiKey === 'test-key') {
        const testSummary = `[테스트 모드] ${title}에 대한 자동 생성된 요약입니다. 본문 길이: ${content.length}자`;
        scrapingLogger.debug(`테스트 요약 생성: ${title.substring(0, 50)}...`);
        return testSummary;
      }

      const prompt = `다음 AI 관련 뉴스 기사를 한국어로 간결하게 요약해주세요. 핵심 내용과 중요한 포인트만 포함해주세요.

제목: ${title}

본문: ${content}

요약:`;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        timeout: 30000
      });

      const data: OpenAIResponse = response.data;
      const summary = data.choices[0]?.message?.content?.trim() || '';
      
      scrapingLogger.debug(`요약 생성 완료: ${title.substring(0, 50)}...`);
      return summary;

    } catch (error) {
      scrapingLogger.error('OpenAI 요약 생성 실패', error as Error);
      return '요약 생성에 실패했습니다.';
    }
  }

  // 전체 스크래핑 프로세스 (비동기 처리)
  async scrapeArticles(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      articles: [],
      errors: [],
      source: 'AI타임즈',
      scrapedAt: new Date(),
      totalCount: 0
    };

    try {
      await this.initBrowser();
      
      // 1. 기사 링크 목록 수집
      const articleLinks = await this.getArticleLinks();
      result.totalCount = articleLinks.length;
      
      if (articleLinks.length === 0) {
        result.errors.push('기사 링크를 찾을 수 없습니다');
        return result;
      }

      scrapingLogger.info(`총 ${articleLinks.length}개 기사 처리 시작`);

      // 2. 각 기사 비동기 처리 (동시 처리 수 제한)
      const maxConcurrent = 3; // 동시 처리 수 제한
      const articles: Article[] = [];
      
      for (let i = 0; i < articleLinks.length; i += maxConcurrent) {
        const batch = articleLinks.slice(i, i + maxConcurrent);
        
        const batchPromises = batch.map(async (url) => {
          try {
            // 각 기사 스크래핑
            const articleData = await this.scrapeArticleDetails(url);
            if (!articleData) return null;

            // OpenAI 요약 생성
            const summary = await this.generateSummary(articleData.title, articleData.content);

            const article: Article = {
              title: articleData.title,
              content: articleData.content,
              summary,
              url: articleData.originalUrl,
              source: 'AI타임즈',
              publishedAt: new Date(),
              imageUrl: articleData.imageUrls[0], // 첫 번째 이미지만 저장
              createdAt: new Date()
            };

            scrapingLogger.info(`처리 완료: ${article.title.substring(0, 30)}...`);
            return article;

          } catch (error) {
            const errorMsg = `기사 처리 실패: ${url} - ${(error as Error).message}`;
            scrapingLogger.error(errorMsg);
            result.errors.push(errorMsg);
            return null;
          }
        });

        // 배치 단위로 처리
        const batchResults = await Promise.all(batchPromises);
        
        // null이 아닌 결과만 추가
        for (const article of batchResults) {
          if (article) {
            articles.push(article);
          }
        }

        // 요청 간 지연
        if (i + maxConcurrent < articleLinks.length) {
          await this.delay(2000); // 2초 대기
        }
      }

      result.articles = articles;
      result.success = articles.length > 0;
      
      scrapingLogger.info(`스크래핑 완료: ${articles.length}/${articleLinks.length}개 성공`);

    } catch (error) {
      const errorMsg = `전체 스크래핑 실패: ${(error as Error).message}`;
      scrapingLogger.error(errorMsg);
      result.errors.push(errorMsg);
    } finally {
      await this.closeBrowser();
    }

    return result;
  }

  // 지연 함수
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 사용 예시 함수
export async function scrapeAiTimesNews(openaiApiKey: string): Promise<ScrapingResult> {
  const listPageUrl = 'https://www.aitimes.kr/news/articleList.html?sc_sub_section_code=S2N8&view_type=sm';
  const scraper = new AiTimesScraper(listPageUrl, openaiApiKey);
  
  return await scraper.scrapeArticles();
} 
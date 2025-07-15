import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { Article, ScrapingResult } from '../types';
import { SCRAPING_CONFIG } from '../config';
import { scrapingLogger } from '../utils/logger';
import { getTitleSummaryPrompt, getContentSummaryPrompt, getCategoryTaggingPrompt, getDetailForSummaryLinePrompt } from '../prompts/aitimes.summary.prompt';
import OpenAI from "openai";

// OpenAI 클라이언트 생성
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ArticleData {
  title: string;
  content: string;
  shortSummary?: string;
  imageUrls: string[];
  originalUrl: string;
  publishedAt?: Date;
}

// 3줄 요약 한 줄에 대한 세부 설명 요청 함수
async function requestDetailForSummaryLine(summaryLine: string, content: string): Promise<string> {
  try {
    const prompt = getDetailForSummaryLinePrompt(summaryLine, content);
    
    console.log(`      🤖 세부 설명 API 호출 중...`);
    const response = await client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.3
    });
    
    const detail = response.choices[0]?.message?.content?.trim();
    if (!detail) {
      console.log(`      ⚠️  API 응답이 비어있음`);
      return `세부 설명 생성 실패: ${summaryLine}`;
    }
    
    console.log(`      ✅ 세부 설명 생성 성공`);
    return detail;
  } catch (error) {
    console.error(`      ❌ 세부 설명 생성 실패: ${(error as Error).message}`);
    return `세부 설명 생성 실패: ${(error as Error).message}`;
  }
}

export class BBCScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = 'https://www.bbc.com';
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
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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
      
      // 페이지 로드 타임아웃 설정
      await this.page.setDefaultNavigationTimeout(30000);
      
      scrapingLogger.info('BBC 스크래퍼 브라우저 초기화 완료');
    } catch (error) {
      scrapingLogger.error('BBC 스크래퍼 브라우저 초기화 실패:', error);
      throw error;
    }
  }

  // 기사 목록 수집
  async collectArticleList(): Promise<{ title: string; url: string; imageUrl?: string; publishedAt?: string }[]> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다.');
    }

    try {
      scrapingLogger.info(`BBC 기사 목록 페이지 로딩: ${this.listPageUrl}`);
      await this.page.goto(this.listPageUrl, { waitUntil: 'networkidle2' });

      // 페이지가 완전히 로드될 때까지 대기
      await this.page.waitForSelector('#main-wrapper', { timeout: 10000 });

      const html = await this.page.content();
      const $ = cheerio.load(html);

      const articles: { title: string; url: string; imageUrl?: string; publishedAt?: string }[] = [];

      // 기사 목록 선택자 - 여러 패턴 시도
      const selectors = [
        'ul[data-testid="topic-promos"] li',
        'ul.bbc-k6wdzo li',
        'main li'
      ];

             let articleElements: cheerio.Cheerio<any> = $();
      
      for (const selector of selectors) {
        articleElements = $(selector);
        if (articleElements.length > 0) {
          scrapingLogger.info(`선택자 "${selector}"로 ${articleElements.length}개 기사 발견`);
          break;
        }
      }

      if (articleElements.length === 0) {
        scrapingLogger.warn('기사 목록을 찾을 수 없습니다.');
        return [];
      }

      articleElements.each((index, element) => {
        try {
          const $item = $(element);
          
          // 제목과 링크 추출 - 여러 패턴 시도
          let title = '';
          let url = '';
          
          // 패턴 1: h2.bbc-766agx a
          const titleLink1 = $item.find('h2.bbc-766agx a');
          if (titleLink1.length > 0) {
            title = titleLink1.text().trim();
            url = titleLink1.attr('href') || '';
          }
          
          // 패턴 2: a.bbc-1i4ie53
          if (!title || !url) {
            const titleLink2 = $item.find('a.bbc-1i4ie53');
            if (titleLink2.length > 0) {
              title = titleLink2.text().trim();
              url = titleLink2.attr('href') || '';
            }
          }
          
          // 패턴 3: 일반적인 h2 a 또는 h3 a
          if (!title || !url) {
            const titleLink3 = $item.find('h2 a, h3 a').first();
            if (titleLink3.length > 0) {
              title = titleLink3.text().trim();
              url = titleLink3.attr('href') || '';
            }
          }

          if (!title || !url) {
            return; // continue
          }

          // 절대 URL로 변환
          if (url.startsWith('/')) {
            url = this.baseUrl + url;
          } else if (!url.startsWith('http')) {
            url = this.baseUrl + '/' + url;
          }

          // 이미지 추출
          let imageUrl = '';
          const imgElement = $item.find('img.bbc-139onq, img').first();
          if (imgElement.length > 0) {
            // srcSet에서 가장 큰 이미지 추출
            const srcSet = imgElement.attr('srcset');
            if (srcSet) {
              const srcSetArray = srcSet.split(',').map(s => s.trim());
              const largestSrc = srcSetArray[srcSetArray.length - 1]?.split(' ')[0];
              imageUrl = largestSrc || imgElement.attr('src') || '';
            } else {
              imageUrl = imgElement.attr('src') || '';
            }
            
            // 절대 URL로 변환
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = this.baseUrl + imageUrl;
            }
          }

          // 발행일 추출
          let publishedAt = '';
          const timeElement = $item.find('time');
          if (timeElement.length > 0) {
            publishedAt = timeElement.attr('datetime') || timeElement.text().trim();
          }

          // 비디오 콘텐츠 스킵 (필요한 경우)
          const hasVideo = $item.find('.bbc-7oeaib').length > 0;
          
          articles.push({
            title,
            url,
            imageUrl: imageUrl || undefined,
            publishedAt: publishedAt || undefined
          });

          scrapingLogger.info(`기사 수집: ${title}`);
        } catch (error) {
          scrapingLogger.error(`기사 파싱 중 오류:`, error);
        }
      });

      scrapingLogger.info(`총 ${articles.length}개 기사 수집 완료`);
      return articles;
    } catch (error) {
      scrapingLogger.error('BBC 기사 목록 수집 실패:', error);
      throw error;
    }
  }

  // 개별 기사 상세 내용 스크래핑
  async scrapeArticleDetail(url: string): Promise<ArticleData | null> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다.');
    }

    try {
      scrapingLogger.info(`기사 상세 페이지 로딩: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle2' });

      // 페이지 로드 대기
      await this.page.waitForSelector('#main-wrapper', { timeout: 10000 });

      const html = await this.page.content();
      const $ = cheerio.load(html);

      // 제목 추출
      let title = '';
      const titleSelectors = [
        'h1#content.article-heading',
        'h1.bbc-nhoxgg',
        'h1.article-heading',
        'h1',
        '.article-heading'
      ];

      for (const selector of titleSelectors) {
        const titleElement = $(selector);
        if (titleElement.length > 0) {
          title = titleElement.text().trim();
          break;
        }
      }

      if (!title) {
        scrapingLogger.warn(`제목을 찾을 수 없습니다: ${url}`);
        return null;
      }

      // 본문 추출
      let content = '';
      const contentSelectors = [
        'div.bbc-19j92fr.ebmt73l0 p',
        'div[data-component="text-block"] p',
        'div.bbc-19j92fr p',
        'article p',
        'main p'
      ];

      for (const selector of contentSelectors) {
        const paragraphs = $(selector);
        if (paragraphs.length > 0) {
          const contentParts: string[] = [];
          paragraphs.each((_, element) => {
            const text = $(element).text().trim();
            if (text) {
              contentParts.push(text);
            }
          });
          content = contentParts.join('\n\n');
          break;
        }
      }

      if (!content) {
        scrapingLogger.warn(`본문을 찾을 수 없습니다: ${url}`);
        return null;
      }

      // 이미지 URL 수집
      const imageUrls: string[] = [];
      $('img').each((_, element) => {
        const imgSrc = $(element).attr('src');
        if (imgSrc && !imgSrc.includes('data:image')) {
          let fullUrl = imgSrc;
          if (imgSrc.startsWith('//')) {
            fullUrl = 'https:' + imgSrc;
          } else if (imgSrc.startsWith('/')) {
            fullUrl = this.baseUrl + imgSrc;
          }
          if (!imageUrls.includes(fullUrl)) {
            imageUrls.push(fullUrl);
          }
        }
      });

      // 발행일 추출
      let publishedAt: Date | undefined;
      const timeElement = $('time[datetime]');
      if (timeElement.length > 0) {
        const dateTimeStr = timeElement.attr('datetime');
        if (dateTimeStr) {
          const parsedDate = new Date(dateTimeStr);
          // 유효한 날짜인지 확인
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate;
          }
        }
      }

      return {
        title,
        content,
        imageUrls,
        originalUrl: url,
        publishedAt
      };
    } catch (error) {
      scrapingLogger.error(`기사 상세 스크래핑 실패 (${url}):`, error);
      return null;
    }
  }

  // 제목 요약 생성
  async generateTitleSummary(title: string): Promise<string> {
    try {
      const prompt = getTitleSummaryPrompt(title);
      const response = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3
      });
      
      return response.choices[0]?.message?.content?.trim() || '제목 요약 생성에 실패했습니다.';
    } catch (error) {
      scrapingLogger.error('제목 요약 생성 실패:', error);
      return '제목 요약 생성에 실패했습니다.';
    }
  }

  // 본문 요약 생성
  async generateContentSummary(content: string): Promise<string> {
    try {
      const prompt = getContentSummaryPrompt(content);
      const response = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3
      });
      
      return response.choices[0]?.message?.content?.trim() || '본문 요약 생성에 실패했습니다.';
    } catch (error) {
      scrapingLogger.error('본문 요약 생성 실패:', error);
      return '본문 요약 생성에 실패했습니다.';
    }
  }

  // 카테고리 태깅
  async generateCategoryTags(title: string, content: string): Promise<string[]> {
    try {
      const prompt = getCategoryTaggingPrompt(title, content);
      const response = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3
      });
      
      const tagsText = response.choices[0]?.message?.content?.trim() || '';
      return tagsText.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    } catch (error) {
      scrapingLogger.error('카테고리 태깅 실패:', error);
      return [];
    }
  }

  // 전체 스크래핑 프로세스 실행
  async scrape(): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    try {
      await this.initBrowser();
      
      const articleList = await this.collectArticleList();
      const articles: Article[] = [];
      
      for (const articleInfo of articleList.slice(0, 10)) { // 최대 10개 기사만 처리
        try {
          const articleDetail = await this.scrapeArticleDetail(articleInfo.url);
          
          if (!articleDetail) {
            continue;
          }

          // AI 요약 생성
          const [titleSummary, contentSummary, categoryTags] = await Promise.all([
            this.generateTitleSummary(articleDetail.title),
            this.generateContentSummary(articleDetail.content),
            this.generateCategoryTags(articleDetail.title, articleDetail.content)
          ]);

          // 3줄 요약 분리 및 세부 설명 생성
          const summaryLines = contentSummary.split(/\n|\r|\r\n/).filter(line => line.trim().match(/^\d+\./));
          const details: string[] = [];
          
          for (let j = 0; j < summaryLines.length; j++) {
            const line = summaryLines[j];
            scrapingLogger.info(`세부 설명 생성 중... (${j+1}/${summaryLines.length})`);
            const detail = await requestDetailForSummaryLine(line, articleDetail.content);
            details.push(detail);
          }

          const article: Article = {
            titleSummary,
            url: articleDetail.originalUrl,
            imageUrls: articleDetail.imageUrls,
            summaryLines: summaryLines,
            details: details,
            publishedAt: articleDetail.publishedAt || new Date(),
            category: 5 // 기타 카테고리로 설정
          };

                     articles.push(article);
           scrapingLogger.info(`기사 처리 완료: ${articleDetail.title}`);
          
          // 요청 간 지연
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          scrapingLogger.error(`기사 처리 실패 (${articleInfo.url}):`, error);
        }
      }

             const endTime = Date.now();
       const result: ScrapingResult = {
         success: true,
         articles,
         errors: [],
         source: 'bbc',
         scrapedAt: new Date(),
         totalCount: articles.length
       };

       scrapingLogger.info(`BBC 스크래핑 완료: ${articles.length}개 기사, ${endTime - startTime}ms`);
      return result;
    } catch (error) {
      scrapingLogger.error('BBC 스크래핑 실패:', error);
      
             const endTime = Date.now();
       return {
         success: false,
         articles: [],
         errors: [error instanceof Error ? error.message : '알 수 없는 오류'],
         source: 'bbc',
         scrapedAt: new Date(),
         totalCount: 0
       };
    } finally {
      await this.closeBrowser();
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
      
      scrapingLogger.info('BBC 스크래퍼 브라우저 종료 완료');
    } catch (error) {
      scrapingLogger.error('BBC 스크래퍼 브라우저 종료 실패:', error);
    }
  }
}

// 메인 스크래핑 함수
export async function scrapeBBCNews(): Promise<ScrapingResult> {
  const bbcScraper = new BBCScraper(
    'https://www.bbc.com/korean/topics/cg726kv2879t', // BBC 한국어 인공지능 주제 페이지
    process.env.OPENAI_API_KEY || ''
  );
  
  return await bbcScraper.scrape();
}

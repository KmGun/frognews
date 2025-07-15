import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { Article, NewsSource, ScrapingResult } from '../types';
import { SCRAPING_CONFIG } from '../config';
import { scrapingLogger } from '../utils/logger';
import { getAiTimesSummaryPrompt, getTitleSummaryPrompt, getContentSummaryPrompt, getDetailForSummaryLinePrompt, getCategoryTaggingPrompt } from '../prompts/aitimes.summary.prompt';
import OpenAI from "openai";

// OpenAI 클라이언트 생성 (API 키 필요)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function requestTitleSummary(title: string): Promise<string> {
  const prompt = getTitleSummaryPrompt(title);

  const response = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.3
  });

  return response.choices[0]?.message?.content?.trim() || '제목 요약 생성에 실패했습니다.';
}

export async function requestContentSummary(content: string): Promise<string> {
  const prompt = getContentSummaryPrompt(content);

  const response = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.3
  });

  return response.choices[0]?.message?.content?.trim() || '본문 요약 생성에 실패했습니다.';
}

interface ArticleData {
  title: string;
  content: string;
  imageUrls: string[];
  originalUrl: string;
  publishedAt?: Date;
}

// 3줄 요약 한 줄에 대한 세부 설명 요청 함수
async function requestDetailForSummaryLine(summaryLine: string, content: string): Promise<string> {
  try {
    const prompt = getDetailForSummaryLinePrompt(summaryLine, content);
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.3
    });
    return response.choices[0]?.message?.content?.trim() || `세부 설명 생성 실패: ${summaryLine}`;
  } catch (error) {
    console.error(`❌ 세부 설명 생성 실패: ${(error as Error).message}`);
    return `세부 설명 생성 실패: ${(error as Error).message}`;
  }
}

export class VentureBeatScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = 'https://venturebeat.com';
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

      scrapingLogger.info('VentureBeat 브라우저 초기화 완료');
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
      scrapingLogger.info('VentureBeat 브라우저 종료 완료');
    } catch (error) {
      scrapingLogger.error('브라우저 종료 실패', error as Error);
    }
  }

  // 기사 링크 목록 수집
  async getArticleLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      scrapingLogger.info(`기사 목록 페이지 로드 중: ${this.listPageUrl}`);
      
      await this.page.goto(this.listPageUrl, {
        waitUntil: ['load', 'domcontentloaded'],
        timeout: 60000
      });

      await this.page.waitForSelector('body', { timeout: 10000 });
      await this.page.waitForTimeout(3000);
      
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const links: string[] = [];
      
      // 1. FeaturedArticles 섹션의 기사 링크들
      $('.FeaturedArticles article a').each((_: any, element: any) => {
        const href = $(element).attr('href');
        if (href && (href.includes('/ai/') || href.includes('/programming-development/'))) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });

      // 2. primary 섹션의 article 태그들
      $('#primary article.ArticleListing a.ArticleListing__title-link').each((_: any, element: any) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });

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
        '.Article__header-top h1.article-title',
        'h1.article-title',
        '.Article__header h1',
        'h1'
      ];
      
      let title = '';
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title) break;
      }
      
      // 본문 추출
      const contentSelectors = [
        '#content .article-content',
        '.article-content',
        '#content',
        '.MainBlock--article .article-content'
      ];
      
      let articleContent = '';
      for (const selector of contentSelectors) {
        const contentElem = $(selector).first();
        if (contentElem.length > 0) {
          // 광고나 관련 기사 제거
          contentElem.find('.ad, .related, .recommend, .social, .share, .jobbioapp, script, style').remove();
          articleContent = contentElem.text().trim();
          if (articleContent) break;
        }
      }
      
      // 이미지 URL 수집
      const imageUrls: string[] = [];
      
      // 헤더 이미지
      const headerImageSelectors = [
        '.article-media-header img',
        '.Article__header img'
      ];
      
      for (const selector of headerImageSelectors) {
        $(selector).each((_: any, element: any) => {
          const src = $(element).attr('src');
          if (src && !src.includes('facebook') && !src.includes('twitter') && !src.includes('linkedin')) {
            const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
            if (!imageUrls.includes(fullUrl)) {
              imageUrls.push(fullUrl);
            }
          }
        });
      }
      
      // 본문 내 이미지 (광고성 제외)
      $('#content .article-content img').each((_: any, element: any) => {
        const src = $(element).attr('src');
        if (src && !src.includes('ad') && !src.includes('banner') && !src.includes('sponsor')) {
          const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          if (!imageUrls.includes(fullUrl)) {
            imageUrls.push(fullUrl);
          }
        }
      });

      // 작성일 추출
      let publishedAt: Date | undefined = undefined;
      const dateSelectors = [
        '.article-time-container time',
        'time.the-time',
        '.Article__meta time'
      ];
      
      for (const selector of dateSelectors) {
        const dateElem = $(selector).first();
        const datetime = dateElem.attr('datetime') || dateElem.attr('title');
        if (datetime) {
          publishedAt = new Date(datetime);
          if (!isNaN(publishedAt.getTime())) {
            break;
          }
          publishedAt = undefined;
        }
      }

      if (!title || !articleContent) {
        scrapingLogger.warn(`필수 정보 누락: ${articleUrl}`);
        return null;
      }

      return {
        title: title.trim(),
        content: articleContent.trim(),
        imageUrls,
        originalUrl: articleUrl,
        publishedAt
      };

    } catch (error) {
      scrapingLogger.error(`기사 스크래핑 실패: ${articleUrl}`, error as Error);
      return null;
    }
  }

  // 제목 요약 생성
  async generateTitleSummary(title: string): Promise<string> {
    try {
      if (this.openaiApiKey === 'test-key') {
        const testSummary = `[테스트 모드] ${title}에 대한 제목 요약`;
        scrapingLogger.debug(`테스트 제목 요약 생성: ${title.substring(0, 50)}...`);
        return testSummary;
      }

      const prompt = getTitleSummaryPrompt(title);

      const response = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3
      });

      const summary = response.choices[0]?.message?.content?.trim() || '제목 요약 생성에 실패했습니다.';
      
      scrapingLogger.debug(`제목 요약 생성 완료: ${title.substring(0, 50)}...`);
      return summary;

    } catch (error) {
      scrapingLogger.error('OpenAI 제목 요약 생성 실패', error as Error);
      return '제목 요약 생성에 실패했습니다.';
    }
  }

  // 본문 요약 생성
  async generateContentSummary(content: string): Promise<string> {
    try {
      if (this.openaiApiKey === 'test-key') {
        const testSummary = `[테스트 모드] 본문 요약 (길이: ${content.length}자)`;
        scrapingLogger.debug(`테스트 본문 요약 생성`);
        return testSummary;
      }

      const prompt = getContentSummaryPrompt(content);

      const response = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3
      });

      const summary = response.choices[0]?.message?.content?.trim() || '본문 요약 생성에 실패했습니다.';
      
      scrapingLogger.debug(`본문 요약 생성 완료`);
      return summary;

    } catch (error) {
      scrapingLogger.error('OpenAI 본문 요약 생성 실패', error as Error);
      return '본문 요약 생성에 실패했습니다.';
    }
  }

  // 카테고리 분류 생성
  async generateCategoryTag(title: string, summary: string): Promise<number> {
    try {
      if (this.openaiApiKey === 'test-key') {
        const testCategory = Math.floor(Math.random() * 5) + 1; // 1-5 랜덤
        scrapingLogger.debug(`테스트 카테고리 분류 생성: ${testCategory}`);
        return testCategory;
      }

      const prompt = getCategoryTaggingPrompt(title, summary);

      const response = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.1
      });

      const categoryText = response.choices[0]?.message?.content?.trim() || '5';
      
      // 숫자 추출 (1-5 범위)
      const categoryMatch = categoryText.match(/[1-5]/);
      const category = categoryMatch ? parseInt(categoryMatch[0]) : 5; // 기본값은 5 (기타)
      
      scrapingLogger.debug(`카테고리 분류 생성 완료: ${category}`);
      return category;

    } catch (error) {
      scrapingLogger.error('OpenAI 카테고리 분류 생성 실패', error as Error);
      return 5; // 실패 시 기본값 5 (기타)
    }
  }

  // 전체 스크래핑 프로세스
  async scrapeArticles(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      articles: [],
      errors: [],
      source: 'VentureBeat',
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

      console.log(`📊 총 ${articleLinks.length}개 기사 발견`);
      scrapingLogger.info(`총 ${articleLinks.length}개 기사 처리 시작`);

      // 2. 각 기사를 순차적으로 처리
      const articles: Article[] = [];
      
      // 테스트를 위해 최대 3개 기사만 처리
      const maxArticles = Math.min(3, articleLinks.length);
      console.log(`📊 테스트 모드: ${maxArticles}개 기사만 처리`);
      scrapingLogger.info(`테스트 모드: ${maxArticles}개 기사만 처리`);
      
      for (let i = 0; i < maxArticles; i++) {
        const url = articleLinks[i];
        
        try {
          console.log(`\n🔄 [${i + 1}/${maxArticles}] 기사 처리 중...`);
          scrapingLogger.info(`처리 중: ${i + 1}/${maxArticles} - ${url}`);
          
          // 각 기사 스크래핑
          console.log(`  📖 기사 스크래핑 중...`);
          const articleData = await this.scrapeArticleDetails(url);
          if (!articleData) {
            console.log(`  ⚠️  기사 데이터 없음`);
            scrapingLogger.warn(`기사 데이터 없음: ${url}`);
            continue;
          }

          // 제목과 본문 요약 생성
          console.log(`  🤖 제목 요약 생성 중...`);
          const titleSummary = await this.generateTitleSummary(articleData.title);
          console.log(`  🤖 본문 요약 생성 중...`);
          const contentSummary = await this.generateContentSummary(articleData.content);

          // 카테고리 분류
          console.log(`  🤖 카테고리 분류 생성 중...`);
          const category = await this.generateCategoryTag(articleData.title, contentSummary);

          // 3줄 요약 분리 및 세부 설명 생성
          const summaryLines = contentSummary.split(/\n|\r|\r\n/).filter(line => line.trim().match(/^\d+\./));
          const details: string[] = [];
          for (let j = 0; j < summaryLines.length; j++) {
            const line = summaryLines[j];
            console.log(`    🔍 세부 설명 생성 중... (${j+1}/${summaryLines.length})`);
            const detail = await requestDetailForSummaryLine(line, articleData.content);
            details.push(detail);
            console.log(`    📑 세부 설명: ${detail.replace(/\n/g, ' ')}`);
          }

          const article: Article = {
            titleSummary: titleSummary,
            publishedAt: articleData.publishedAt,
            url: articleData.originalUrl,
            imageUrls: articleData.imageUrls,
            summaryLines: summaryLines,
            details: details,
            category: category,
            createdAt: new Date()
          };

          articles.push(article);
          console.log(`  ✅ 처리 완료: ${article.titleSummary.substring(0, 40)}...`);
          scrapingLogger.info(`처리 완료: ${article.titleSummary.substring(0, 30)}...`);

          // 기사 간 지연 (일반 사용자처럼)
          if (i < maxArticles - 1) {
            const delayTime = Math.random() * 3000 + 2000; // 2-5초 랜덤 지연
            console.log(`  ⏳ 다음 기사까지 ${Math.round(delayTime/1000)}초 대기...`);
            scrapingLogger.debug(`다음 기사까지 ${Math.round(delayTime/1000)}초 대기`);
            await this.delay(delayTime);
          }

        } catch (error) {
          const errorMsg = `기사 처리 실패: ${url} - ${(error as Error).message}`;
          scrapingLogger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.articles = articles;
      result.success = articles.length > 0;
      
      console.log(`\n🎉 스크래핑 완료: ${articles.length}/${maxArticles}개 성공`);
      scrapingLogger.info(`스크래핑 완료: ${articles.length}/${maxArticles}개 성공`);

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
export async function scrapeVentureBeatNews(openaiApiKey: string): Promise<ScrapingResult> {
  const listPageUrl = 'https://venturebeat.com/category/ai/';
  const scraper = new VentureBeatScraper(listPageUrl, openaiApiKey);
  
  return await scraper.scrapeArticles();
} 
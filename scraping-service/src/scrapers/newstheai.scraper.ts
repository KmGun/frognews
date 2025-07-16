import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import axios from "axios";
import { Article, NewsSource, ScrapingResult } from "../types";
import { SCRAPING_CONFIG } from "../config";
import { scrapingLogger } from "../utils/logger";
import {
  getAiTimesSummaryPrompt,
  getTitleSummaryPrompt,
  getContentSummaryPrompt,
  getDetailForSummaryLinePrompt,
  getCategoryTaggingPrompt,
} from "../prompts/aitimes.summary.prompt";
import {
  filterNewUrls,
  calculatePerformanceMetrics,
} from "../utils/duplicate-checker";
import {
  callOpenAIWithQueue,
  getQueueStatus,
} from "../utils/openai-rate-limiter";
import { saveArticleToSupabase } from "../utils/save-articles";
import OpenAI from "openai";

// OpenAI 클라이언트 생성 (API 키 필요)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function requestTitleSummary(title: string): Promise<string> {
  const prompt = getTitleSummaryPrompt(title);

  const response = await callOpenAIWithQueue(
    async () => {
      return await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      });
    },
    prompt,
    300,
    2
  );

  // 응답에서 요약 텍스트 추출
  return (
    response.choices[0]?.message?.content?.trim() ||
    "제목 요약 생성에 실패했습니다."
  );
}

export async function requestContentSummary(content: string): Promise<string> {
  const prompt = getContentSummaryPrompt(content);

  const response = await callOpenAIWithQueue(
    async () => {
      return await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });
    },
    prompt,
    800,
    3
  );

  return (
    response.choices[0]?.message?.content?.trim() ||
    "본문 요약 생성에 실패했습니다."
  );
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ArticleData {
  title: string;
  content: string; // ← 전체 본문 텍스트
  imageUrls: string[];
  originalUrl: string;
  publishedAt?: Date; // 작성일 추가
}

// 3줄 요약 한 줄에 대한 세부 설명 요청 함수
async function requestDetailForSummaryLine(
  summaryLine: string,
  content: string
): Promise<string> {
  try {
    const prompt = getDetailForSummaryLinePrompt(summaryLine, content);
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    });
    return (
      response.choices[0]?.message?.content?.trim() ||
      "세부 설명 생성에 실패했습니다."
    );
  } catch (error) {
    console.error(`❌ 세부 설명 생성 실패: ${(error as Error).message}`);
    return `세부 설명 생성 실패: ${(error as Error).message}`;
  }
}

export class NewsTheAiScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = "https://www.newstheai.com";
  private listPageUrl: string;
  private openaiApiKey: string;

  constructor(listPageUrl: string, openaiApiKey: string) {
    this.listPageUrl = listPageUrl;
    this.openaiApiKey = openaiApiKey;
  }

  // 날짜가 2개월 이내인지 확인하는 함수
  private isWithinTwoMonths(publishedDate: Date): boolean {
    const now = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(now.getMonth() - 2);

    return publishedDate >= twoMonthsAgo;
  }

  // 기사 링크에서 날짜 추출 (게시판 목록에서)
  private async extractDateFromListItem(
    element: any,
    $: any
  ): Promise<Date | null> {
    // 게시판 목록에서 날짜 정보 추출 시도
    const dateSelectors = [
      ".byline",
      ".date",
      ".time",
      'em:contains("입력")',
      'span:contains("입력")',
    ];

    for (const selector of dateSelectors) {
      const dateElem = $(element).find(selector);
      if (dateElem.length > 0) {
        const dateText = dateElem.text().trim();
        if (dateText.includes("입력")) {
          // "입력 2025.07.13 07:00" 형태 파싱
          const match = dateText.match(/입력\s+(\d{4}\.\d{2}\.\d{2})/);
          if (match) {
            const dateStr = match[1];
            const parts = dateStr.split(".");
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1; // JavaScript month is 0-based
              const day = parseInt(parts[2]);
              return new Date(year, month, day);
            }
          }
        }
      }
    }

    return null;
  }

  // 브라우저 초기화
  async initBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: false, // 디버깅을 위해 보이게
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        // devtools: true,   // 개발자 도구 자동 열기
        // slowMo: 250,      // 동작을 천천히
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--start-maximized",
        ],
      });

      this.page = await this.browser.newPage();

      // User Agent 설정
      await this.page.setUserAgent(SCRAPING_CONFIG.userAgent);

      // 뷰포트 설정
      await this.page.setViewport({ width: 1280, height: 720 });

      // 요청 차단 완전 제거 (일반 브라우저처럼 모든 리소스 로드)
      // await this.page.setRequestInterception(true);
      // this.page.on('request', (req: any) => { ... });

      scrapingLogger.info("NewsTheAI 브라우저 초기화 완료");
    } catch (error) {
      scrapingLogger.error("브라우저 초기화 실패", error as Error);
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
      scrapingLogger.info("NewsTheAI 브라우저 종료 완료");
    } catch (error) {
      scrapingLogger.error("브라우저 종료 실패", error as Error);
    }
  }

  // 기사 링크 목록 수집 (동적 로딩 지원)
  async getArticleLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    try {
      scrapingLogger.info(`기사 목록 페이지 로드 중: ${this.listPageUrl}`);
      console.log(`📖 NewsTheAI 페이지 스크래핑 중...`);

      // 더 안전한 페이지 로드
      await this.page.goto(this.listPageUrl, {
        waitUntil: ["load", "domcontentloaded"], // 여러 조건
        timeout: 60000, // 타임아웃 늘리기
      });

      // 페이지 상태 확인
      await this.page.waitForSelector("body", { timeout: 10000 });
      await this.page.waitForTimeout(3000);

      const allLinks: string[] = [];
      let clickCount = 0;
      const maxClicks = 15; // 최대 클릭 횟수 제한
      let foundOldArticles = false;

      console.log(`🔄 동적 기사 로딩 시작 (최대 ${maxClicks}번 클릭)`);

      while (clickCount < maxClicks && !foundOldArticles) {
        // 현재 페이지에서 기사 링크 수집
        const content = await this.page.content();
        const $ = cheerio.load(content);

        console.log(
          `  📊 [${clickCount + 1}/${maxClicks}] 현재 페이지 기사 수집 중...`
        );

        // 기사 리스트에서 링크 추출
        const currentPageLinks: string[] = [];
        let oldArticleCount = 0;

        // NewsTheAI 기사 링크 선택자들
        const linkSelectors = [
          "#section-list > ul > li",
          ".article-list > li",
          'ul > li:has(a[href*="/news/articleView.html"])',
        ];

        for (const listSelector of linkSelectors) {
          const listItems = $(listSelector);

          for (let i = 0; i < listItems.length; i++) {
            const element = listItems[i];

            // 각 리스트 아이템에서 기사 링크 찾기
            const linkElement = $(element).find(
              'a[href*="/news/articleView.html"]'
            );
            const href = linkElement.attr("href");

            if (href) {
              let fullUrl = href.startsWith("http")
                ? href
                : `${this.baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;

              if (
                !allLinks.includes(fullUrl) &&
                !currentPageLinks.includes(fullUrl)
              ) {
                // 날짜 확인 (동기적으로 처리)
                const articleDate = await this.extractDateFromListItem(
                  element,
                  $
                );

                if (articleDate) {
                  if (this.isWithinTwoMonths(articleDate)) {
                    currentPageLinks.push(fullUrl);
                    allLinks.push(fullUrl);
                  } else {
                    oldArticleCount++;
                    console.log(
                      `    ⏰ 2개월 이후 기사 발견: ${articleDate.toLocaleDateString()}`
                    );
                  }
                } else {
                  // 날짜를 확인할 수 없는 경우 일단 포함
                  currentPageLinks.push(fullUrl);
                  allLinks.push(fullUrl);
                }
              }
            }
          }

          if (currentPageLinks.length > 0) break; // 링크를 찾으면 중단
        }

        console.log(
          `    📋 이번 로드에서 ${currentPageLinks.length}개 새 기사 발견 (총 ${allLinks.length}개)`
        );
        if (oldArticleCount > 3) {
          console.log(
            `    ⏰ 2개월 이후 기사 ${oldArticleCount}개 발견 - 로딩 중단`
          );
          foundOldArticles = true;
          break;
        }

        // 새로운 기사가 없으면 중단
        if (currentPageLinks.length === 0) {
          console.log(`    ⏹️ 새로운 기사가 없어서 로딩 중단`);
          break;
        }

        // "더보기" 버튼 찾기 및 클릭
        try {
          const moreButton = await this.page.$("#sections > section > a");

          if (!moreButton) {
            console.log(`    ⏹️ "더보기" 버튼을 찾을 수 없어서 중단`);
            break;
          }

          // 버튼이 보이도록 스크롤
          await this.page.evaluate((btn) => {
            if (btn)
              btn.scrollIntoView({ behavior: "smooth", block: "center" });
          }, moreButton);

          await this.page.waitForTimeout(2000); // 스크롤 완료 대기

          console.log(`    🔄 "더보기" 버튼 클릭 중...`);
          await moreButton.click();

          // 새 콘텐츠 로딩 대기
          await this.page.waitForTimeout(4000);

          clickCount++;
        } catch (error) {
          console.log(
            `    ⚠️ "더보기" 버튼 클릭 실패: ${(error as Error).message}`
          );
          break;
        }
      }

      console.log(
        `📊 최종 수집된 기사 링크: ${allLinks.length}개 (${clickCount}번 클릭)`
      );
      scrapingLogger.info(`발견된 기사 링크 수: ${allLinks.length}`);

      return allLinks;
    } catch (error) {
      scrapingLogger.error("기사 링크 수집 실패", error as Error);
      throw error;
    }
  }

  // 개별 기사 스크래핑
  async scrapeArticleDetails(articleUrl: string): Promise<ArticleData | null> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    try {
      scrapingLogger.debug(`기사 상세 페이지 로드 중: ${articleUrl}`);

      await this.page.goto(articleUrl, {
        waitUntil: "networkidle2",
        timeout: SCRAPING_CONFIG.timeout,
      });

      await this.page.waitForTimeout(2000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      // 제목 추출 (NewsTheAI 실제 구조에 맞게 수정)
      const titleSelectors = [
        "h1.heading",
        "h1",
        ".article-header h1",
        ".article-title",
        ".news-title",
      ];

      let title = "";
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title) break;
      }

      // 본문 추출 (NewsTheAI 실제 구조에 맞게 수정)
      const contentSelectors = [
        "#article-view-content-div",
        ".article-veiw-body",
        ".article-content",
        ".article-body",
        ".news-content",
      ];

      let articleContent = "";
      for (const selector of contentSelectors) {
        const contentElem = $(selector).first();
        if (contentElem.length > 0) {
          // 광고나 관련 기사 제거
          contentElem
            .find(
              ".ad-template, .ad-view, .related, .recommend, .social, .quick-tool, .writer, .article-copy, script, style"
            )
            .remove();
          articleContent = contentElem.text().trim();
          if (articleContent) break;
        }
      }

      // 이미지 URL 수집 (NewsTheAI 실제 구조에 맞게 수정)
      const imageUrls: string[] = [];
      const imageSelectors = [
        "#article-view-content-div img",
        ".article-veiw-body img",
        ".article-content img",
        ".article-body img",
        ".news-content img",
        ".photo-layout img",
      ];

      for (const selector of imageSelectors) {
        $(selector).each((_: any, element: any) => {
          const src = $(element).attr("src");
          if (src) {
            const fullUrl = src.startsWith("http")
              ? src
              : `${this.baseUrl}${src}`;
            if (!imageUrls.includes(fullUrl)) {
              imageUrls.push(fullUrl);
            }
          }
        });
      }

      // 작성일 추출 (NewsTheAI 실제 구조에 맞게 수정)
      let publishedAt: Date | undefined = undefined;

      // 먼저 메타 태그에서 시도
      const metaDate = $('meta[property="article:published_time"]').attr(
        "content"
      );
      if (metaDate) {
        publishedAt = new Date(metaDate);
        if (isNaN(publishedAt.getTime())) publishedAt = undefined;
      }

      // 메타 태그가 없으면 본문에서 찾기
      if (!publishedAt) {
        const dateSelectors = [
          'li:contains("입력")',
          ".byline em",
          ".byline",
          ".article-date",
          ".news-date",
          "time",
        ];

        for (const selector of dateSelectors) {
          const dateElem = $(selector);
          let dateText = dateElem.text().trim();
          if (dateText && dateText.includes("입력")) {
            // "입력 2025.07.13 07:00" 형태 파싱
            const match = dateText.match(
              /입력\s+(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2})/
            );
            if (match) {
              const dateStr = match[1];
              // 2025.07.13 07:00 -> 2025-07-13T07:00:00 변환
              const parts = dateStr.split(" ");
              const datePart = parts[0].replace(/\./g, "-");
              const timePart = parts[1];
              const isoDate = `${datePart}T${timePart}:00`;
              publishedAt = new Date(isoDate);
              if (isNaN(publishedAt.getTime())) publishedAt = undefined;
              break;
            }
          }
        }
      }

      if (!title || !articleContent) {
        scrapingLogger.warn(`필수 정보 누락: ${articleUrl}`);
        scrapingLogger.warn(
          `제목: ${title ? "있음" : "없음"}, 본문: ${
            articleContent ? "있음" : "없음"
          }`
        );
        return null;
      }

      return {
        title: title.trim(),
        content: articleContent.trim(),
        imageUrls,
        originalUrl: articleUrl,
        publishedAt,
      };
    } catch (error) {
      scrapingLogger.error(`기사 스크래핑 실패: ${articleUrl}`, error as Error);
      return null;
    }
  }

  // 제목 요약 생성
  async generateTitleSummary(title: string): Promise<string> {
    try {
      // 테스트 모드인 경우 가짜 요약 반환
      if (this.openaiApiKey === "test-key") {
        const testSummary = `[테스트 모드] ${title}에 대한 제목 요약`;
        scrapingLogger.debug(
          `테스트 제목 요약 생성: ${title.substring(0, 50)}...`
        );
        return testSummary;
      }

      const prompt = getTitleSummaryPrompt(title);

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      });

      const summary =
        response.choices[0]?.message?.content?.trim() ||
        "제목 요약 생성에 실패했습니다.";

      scrapingLogger.debug(`제목 요약 생성 완료: ${title.substring(0, 50)}...`);
      return summary;
    } catch (error) {
      scrapingLogger.error("OpenAI 제목 요약 생성 실패", error as Error);
      return "제목 요약 생성에 실패했습니다.";
    }
  }

  // 본문 요약 생성
  async generateContentSummary(content: string): Promise<string> {
    try {
      // 테스트 모드인 경우 가짜 요약 반환
      if (this.openaiApiKey === "test-key") {
        const testSummary = `[테스트 모드] 본문 요약 (길이: ${content.length}자)`;
        scrapingLogger.debug(`테스트 본문 요약 생성`);
        return testSummary;
      }

      const prompt = getContentSummaryPrompt(content);

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });

      const summary =
        response.choices[0]?.message?.content?.trim() ||
        "본문 요약 생성에 실패했습니다.";

      scrapingLogger.debug(`본문 요약 생성 완료`);
      return summary;
    } catch (error) {
      scrapingLogger.error("OpenAI 본문 요약 생성 실패", error as Error);
      return "본문 요약 생성에 실패했습니다.";
    }
  }

  // 카테고리 분류 생성
  async generateCategoryTag(title: string, summary: string): Promise<number> {
    try {
      // 테스트 모드인 경우 랜덤 카테고리 반환
      if (this.openaiApiKey === "test-key") {
        const testCategory = Math.floor(Math.random() * 5) + 1; // 1-5 랜덤
        scrapingLogger.debug(`테스트 카테고리 분류 생성: ${testCategory}`);
        return testCategory;
      }

      const prompt = getCategoryTaggingPrompt(title, summary);

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.1,
      });

      const categoryText = response.choices[0]?.message?.content?.trim() || "5";

      // 숫자 추출 (1-5 범위)
      const categoryMatch = categoryText.match(/[1-5]/);
      const category = categoryMatch ? parseInt(categoryMatch[0]) : 5; // 기본값은 5 (기타)

      scrapingLogger.debug(`카테고리 분류 생성 완료: ${category}`);
      return category;
    } catch (error) {
      scrapingLogger.error("OpenAI 카테고리 분류 생성 실패", error as Error);
      return 5; // 실패 시 기본값 5 (기타)
    }
  }

  // 기존 요약 함수 (하위 호환성을 위해 유지)
  async generateSummary(title: string, content: string): Promise<string> {
    try {
      // 테스트 모드인 경우 가짜 요약 반환
      if (this.openaiApiKey === "test-key") {
        const testSummary = `[테스트 모드] ${title}에 대한 자동 생성된 요약입니다. 본문 길이: ${content.length}자`;
        scrapingLogger.debug(`테스트 요약 생성: ${title.substring(0, 50)}...`);
        return testSummary;
      }

      const prompt = getAiTimesSummaryPrompt(title, content);

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });

      const summary =
        response.choices[0]?.message?.content?.trim() ||
        "요약 생성에 실패했습니다.";

      scrapingLogger.debug(`요약 생성 완료: ${title.substring(0, 50)}...`);
      return summary;
    } catch (error) {
      scrapingLogger.error("OpenAI 요약 생성 실패", error as Error);
      return "요약 생성에 실패했습니다.";
    }
  }

  // 전체 스크래핑 프로세스 (순차 처리로 변경)
  async scrapeArticles(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      articles: [],
      errors: [],
      source: "NewsTheAI",
      scrapedAt: new Date(),
      totalCount: 0,
    };

    try {
      await this.initBrowser();

      // 1. 기사 링크 목록 수집
      const allArticleLinks = await this.getArticleLinks();
      result.totalCount = allArticleLinks.length;

      if (allArticleLinks.length === 0) {
        result.errors.push("기사 링크를 찾을 수 없습니다");
        return result;
      }

      console.log(`📊 총 ${allArticleLinks.length}개 기사 발견`);
      scrapingLogger.info(`총 ${allArticleLinks.length}개 기사 발견`);

      // 2. 중복 URL 필터링 (새로운 URL만 추출)
      console.log("🔍 기존 데이터 중복 체크 중...");
      const articleLinks = await filterNewUrls(allArticleLinks);

      if (articleLinks.length === 0) {
        console.log("✅ 새로운 기사가 없습니다 (모든 기사가 이미 수집됨)");
        scrapingLogger.info("새로운 기사 없음 - 모든 기사가 이미 존재");
        return { ...result, success: true };
      }

      // 3. 성능 메트릭 계산 및 표시
      const metrics = calculatePerformanceMetrics(
        allArticleLinks.length,
        articleLinks.length
      );
      console.log(
        `📊 효율성: ${metrics.efficiencyPercentage}% 절약 (${metrics.newItems}/${metrics.totalItems}개 처리)`
      );

      console.log(`📊 실제 처리할 기사: ${articleLinks.length}개`);
      scrapingLogger.info(`실제 처리할 기사: ${articleLinks.length}개`);

      // 4. 각 기사를 순차적으로 처리
      const articles: Article[] = [];

      for (let i = 0; i < articleLinks.length; i++) {
        const url = articleLinks[i];

        try {
          console.log(`\n🔄 [${i + 1}/${articleLinks.length}] 기사 처리 중...`);
          scrapingLogger.info(
            `처리 중: ${i + 1}/${articleLinks.length} - ${url}`
          );

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
          const titleSummary = await this.generateTitleSummary(
            articleData.title
          );
          console.log(`  🤖 본문 요약 생성 중...`);
          const contentSummary = await this.generateContentSummary(
            articleData.content
          );

          // 카테고리 분류
          console.log(`  🤖 카테고리 분류 생성 중...`);
          const category = await this.generateCategoryTag(
            articleData.title,
            contentSummary
          );

          // 3줄 요약 분리 및 세부 설명 생성
          const summaryLines = contentSummary
            .split(/\n|\r|\r\n/)
            .filter((line) => line.trim().match(/^\d+\./));
          const details: string[] = [];
          for (let j = 0; j < summaryLines.length; j++) {
            const line = summaryLines[j];
            console.log(
              `    🔍 세부 설명 생성 중... (${j + 1}/${summaryLines.length})`
            );
            const detail = await requestDetailForSummaryLine(
              line,
              articleData.content
            );
            details.push(detail);
            console.log(`    📑 세부 설명: ${detail.replace(/\n/g, " ")}`);
          }

          const article: Article = {
            titleSummary: titleSummary,
            publishedAt: articleData.publishedAt,
            url: articleData.originalUrl,
            imageUrls: articleData.imageUrls,
            summaryLines: summaryLines,
            details: details,
            category: category,
            createdAt: new Date(),
          };

          // 즉시 DB에 저장
          try {
            console.log(`  💾 DB 저장 중...`);
            await saveArticleToSupabase(article);
            articles.push(article);
            console.log(
              `  ✅ 처리 및 저장 완료: ${article.titleSummary.substring(
                0,
                40
              )}...`
            );
            scrapingLogger.info(
              `처리 및 저장 완료: ${article.titleSummary.substring(0, 30)}...`
            );
          } catch (saveError) {
            const saveErrorMsg = `DB 저장 실패: ${articleData.originalUrl} - ${
              (saveError as Error).message
            }`;
            console.log(`  ❌ ${saveErrorMsg}`);
            scrapingLogger.error(saveErrorMsg);
            result.errors.push(saveErrorMsg);
            // 저장에 실패해도 articles 배열에는 추가하지 않음
          }

          // 기사 간 지연 (일반 사용자처럼)
          if (i < articleLinks.length - 1) {
            const delayTime = Math.random() * 3000 + 2000; // 2-5초 랜덤 지연
            console.log(
              `  ⏳ 다음 기사까지 ${Math.round(delayTime / 1000)}초 대기...`
            );
            scrapingLogger.debug(
              `다음 기사까지 ${Math.round(delayTime / 1000)}초 대기`
            );
            await this.delay(delayTime);
          }
        } catch (error) {
          const errorMsg = `기사 처리 실패: ${url} - ${
            (error as Error).message
          }`;
          scrapingLogger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.articles = articles;
      result.success = articles.length > 0;

      console.log(
        `\n🎉 스크래핑 완료: ${articles.length}/${articleLinks.length}개 성공`
      );
      scrapingLogger.info(
        `스크래핑 완료: ${articles.length}/${articleLinks.length}개 성공`
      );
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 사용 예시 함수
export async function scrapeNewsTheAiNews(
  openaiApiKey: string
): Promise<ScrapingResult> {
  const listPageUrl =
    "https://www.newstheai.com/news/articleList.html?page=2&total=7043&box_idxno=&sc_section_code=&sc_sub_section_code=&sc_serial_code=&sc_area=&sc_level=&sc_article_type=&sc_view_level=&sc_sdate=&sc_edate=&sc_serial_number=&sc_word=&sc_multi_code=&sc_is_image=&sc_is_movie=&sc_user_name=&sc_order_by=E";
  const scraper = new NewsTheAiScraper(listPageUrl, openaiApiKey);

  return await scraper.scrapeArticles();
}

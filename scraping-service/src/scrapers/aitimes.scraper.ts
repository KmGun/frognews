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
  ); // 우선순위 2 (제목 요약은 높은 우선순위)

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
  ); // 우선순위 3 (본문 요약)

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
    const response = await callOpenAIWithQueue(
      async () => {
        return await client.chat.completions.create({
          model: "gpt-4.1",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
          temperature: 0.3,
        });
      },
      prompt,
      200,
      5
    ); // 우선순위 5 (세부 설명은 낮은 우선순위)
    return (
      response.choices[0]?.message?.content?.trim() ||
      `세부 설명 생성 실패: ${summaryLine}`
    );
  } catch (error) {
    console.error(`❌ 세부 설명 생성 실패: ${(error as Error).message}`);
    return `세부 설명 생성 실패: ${(error as Error).message}`;
  }
}

export class AiTimesScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = "https://www.aitimes.kr";
  private listPageUrls: string[];
  private openaiApiKey: string;

  constructor(listPageUrls: string | string[], openaiApiKey: string) {
    // 하위 호환성을 위해 string도 받지만 배열로 변환
    this.listPageUrls = Array.isArray(listPageUrls)
      ? listPageUrls
      : [listPageUrls];
    this.openaiApiKey = openaiApiKey;
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

      scrapingLogger.info("AI타임즈 브라우저 초기화 완료");
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
      scrapingLogger.info("AI타임즈 브라우저 종료 완료");
    } catch (error) {
      scrapingLogger.error("브라우저 종료 실패", error as Error);
    }
  }

  // 기사 링크 목록 수집 (여러 URL 지원 버전)
  async getArticleLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    try {
      const allLinks: string[] = [];

      // 모든 listPageUrls를 순차적으로 처리
      for (let i = 0; i < this.listPageUrls.length; i++) {
        const listPageUrl = this.listPageUrls[i];

        scrapingLogger.info(
          `[${i + 1}/${
            this.listPageUrls.length
          }] 기사 목록 페이지 로드 중: ${listPageUrl}`
        );
        console.log(
          `📖 [${i + 1}/${
            this.listPageUrls.length
          }] 카테고리 페이지 스크래핑 중...`
        );

        // 더 안전한 페이지 로드
        await this.page.goto(listPageUrl, {
          waitUntil: ["load", "domcontentloaded"], // 여러 조건
          timeout: 60000, // 타임아웃 늘리기
        });

        // 페이지 상태 확인
        await this.page.waitForSelector("body", { timeout: 10000 });

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

        const pageLinks: string[] = [];

        // AI타임즈 기사 링크 선택자 (section-body 내의 기사 링크들)
        // 실제 사이트 구조에 맞게 조정 필요
        const selectors = [
          '.section-body a[href*="/news/articleView.html"]',
          '.article-list a[href*="/news/articleView.html"]',
          '.news-list a[href*="/news/articleView.html"]',
          'a[href*="/news/articleView.html"]',
        ];

        for (const selector of selectors) {
          $(selector).each((_: any, element: any) => {
            const href = $(element).attr("href");
            if (href) {
              const fullUrl = href.startsWith("http")
                ? href
                : `${this.baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;

              if (!pageLinks.includes(fullUrl) && !allLinks.includes(fullUrl)) {
                pageLinks.push(fullUrl);
                allLinks.push(fullUrl);
              }
            }
          });

          if (pageLinks.length > 0) break; // 링크를 찾으면 중단
        }

        console.log(`   📊 이 카테고리에서 ${pageLinks.length}개 기사 발견`);
        scrapingLogger.info(
          `카테고리 ${i + 1}에서 ${pageLinks.length}개 기사 발견`
        );

        // 페이지 간 지연
        if (i < this.listPageUrls.length - 1) {
          const delayTime = Math.random() * 2000 + 1000; // 1-3초 랜덤 지연
          console.log(
            `   ⏳ 다음 카테고리까지 ${Math.round(delayTime / 1000)}초 대기...`
          );
          await this.delay(delayTime);
        }
      }

      console.log(
        `📊 총 ${allLinks.length}개 기사 링크 수집 완료 (${this.listPageUrls.length}개 카테고리)`
      );
      scrapingLogger.info(`총 ${allLinks.length}개 기사 링크 수집 완료`);
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

      // 제목 추출 (AI타임즈 실제 구조에 맞게 수정)
      const titleSelectors = [
        "h3.heading", // AI타임즈 실제 제목 selector
        ".article-view-header h3",
        ".aht-title-view",
        "h1",
        ".article-header h1",
      ];

      let title = "";
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title) break;
      }

      // 본문 추출 (AI타임즈 실제 구조에 맞게 수정)
      const contentSelectors = [
        "#article-view-content-div", // AI타임즈 실제 본문 selector
        ".article-veiw-body",
        ".article-body",
        ".article-content",
        ".news-content",
      ];

      let articleContent = "";
      for (const selector of contentSelectors) {
        const contentElem = $(selector).first();
        if (contentElem.length > 0) {
          // 광고나 관련 기사 제거
          contentElem
            .find(
              ".ad, .related, .recommend, .social, .quick-tool, .writer, .article-copy"
            )
            .remove();
          articleContent = contentElem.text().trim();
          if (articleContent) break;
        }
      }

      // 이미지 URL 수집 (AI타임즈 실제 구조에 맞게 수정)
      const imageUrls: string[] = [];
      const imageSelectors = [
        ".photo-layout img", // AI타임즈 실제 이미지 selector
        ".article-veiw-body img",
        ".article-body img",
        ".article-content img",
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

      // 작성일 추출
      let publishedAt: Date | undefined = undefined;
      // clock 아이콘이 있는 li에서 텍스트 추출
      const dateElem = $("li i.icon-clock-o").parent();
      let dateText = dateElem.text().trim();
      // 예시: '입력 2025.06.24 08:43'
      if (dateText) {
        const match = dateText.match(/(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2})/);
        if (match) {
          const dateStr = match[1].replace(/\./g, "-"); // 2025-06-24 08:43
          publishedAt = new Date(dateStr.replace(" ", "T") + ":00"); // ISO 포맷
          if (isNaN(publishedAt.getTime())) publishedAt = undefined;
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
      ); // 우선순위 2 (제목 요약은 높은 우선순위)

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

      const response = await callOpenAIWithQueue(
        async () => {
          return await client.chat.completions.create({
            model: "gpt-4.1",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 50,
            temperature: 0.1,
          });
        },
        prompt,
        50,
        4
      );

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
      source: "AI타임즈",
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

      // 큐 상태 로깅
      const queueStatus = getQueueStatus();
      console.log(
        `📊 OpenAI API 큐 상태: 대기 ${
          queueStatus.queueLength
        }개, 토큰 사용량: ${queueStatus.currentTokenUsage}/${Math.floor(
          30000 * 0.9
        )}`
      );
      scrapingLogger.info(
        `큐 상태 - 대기: ${queueStatus.queueLength}, 토큰: ${queueStatus.currentTokenUsage}`
      );

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
      console.log(`📊 효율성 리포트:`);
      console.log(`   전체 기사: ${metrics.totalItems}개`);
      console.log(`   새로운 기사: ${metrics.newItems}개`);
      console.log(`   중복 제외: ${metrics.duplicateItems}개`);
      console.log(`   ⚡ 효율성: ${metrics.efficiencyPercentage}% 작업량 절약`);
      console.log(`   ⏱️ 시간 절약: ${metrics.timeSaved}`);
      console.log(`   💰 비용 절약: ${metrics.costSaved}`);
      scrapingLogger.info(
        `효율성 - 새로운 기사 ${articleLinks.length}/${allArticleLinks.length}개, ${metrics.efficiencyPercentage}% 절약`
      );

      console.log(`📊 실제 처리할 기사: ${articleLinks.length}개`);
      scrapingLogger.info(`실제 처리할 기사: ${articleLinks.length}개`);

      // 2. 각 기사를 순차적으로 처리
      const articles: Article[] = [];

      console.log(`📊 전체 ${articleLinks.length}개 기사 처리 시작`);
      scrapingLogger.info(`전체 ${articleLinks.length}개 기사 처리 시작`);

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
export async function scrapeAiTimesNews(
  openaiApiKey: string
): Promise<ScrapingResult> {
  const listPageUrls = [
    "https://www.aitimes.kr/news/articleList.html?sc_section_code=S1N4&view_type=sm", // 기존 URL
    "https://www.aitimes.kr/news/articleList.html?sc_section_code=S1N2&view_type=sm", // 추가된 URL들
    "https://www.aitimes.kr/news/articleList.html?sc_section_code=S1N5&view_type=sm",
    "https://www.aitimes.kr/news/articleList.html?sc_section_code=S1N3&view_type=sm",
    "https://www.aitimes.kr/news/articleList.html?view_type=sm",
  ];
  const scraper = new AiTimesScraper(listPageUrls, openaiApiKey);

  return await scraper.scrapeArticles();
}

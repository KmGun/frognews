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
import { saveArticleToSupabase } from "../utils/save-articles";
import OpenAI from "openai";

// OpenAI 클라이언트 생성 (API 키 필요)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function requestTitleSummary(title: string): Promise<string> {
  const prompt = getTitleSummaryPrompt(title);

  const response = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
  });

  // 응답에서 요약 텍스트 추출
  return (
    response.choices[0]?.message?.content?.trim() ||
    "제목 요약 생성에 실패했습니다."
  );
}

export async function requestContentSummary(content: string): Promise<string> {
  const prompt = getContentSummaryPrompt(content);

  const response = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800,
    temperature: 0.3,
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    "본문 요약 생성에 실패했습니다."
  );
}

interface ArticleData {
  title: string;
  content: string;
  imageUrls: string[];
  originalUrl: string;
  publishedAt?: Date;
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
      `세부 설명 생성 실패: ${summaryLine}`
    );
  } catch (error) {
    console.error(`❌ 세부 설명 생성 실패: ${(error as Error).message}`);
    return `세부 설명 생성 실패: ${(error as Error).message}`;
  }
}

export class TechCrunchScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = "https://techcrunch.com";
  private listPageUrls: string[];
  private openaiApiKey: string;

  constructor(listPageUrls: string | string[], openaiApiKey: string) {
    // 문자열이면 배열로 변환, 배열이면 그대로 사용 (하위 호환성)
    this.listPageUrls = Array.isArray(listPageUrls)
      ? listPageUrls
      : [listPageUrls];
    this.openaiApiKey = openaiApiKey;
  }

  // 2개월 이내 체크 함수
  private isWithinTwoMonths(date: Date): boolean {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    return date >= twoMonthsAgo;
  }

  // URL에서 날짜 추출 (TechCrunch URL 패턴: /2024/12/15/)
  private extractDateFromUrl(url: string): Date | null {
    const dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  }

  // 브라우저 초기화
  async initBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
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

      scrapingLogger.info("TechCrunch 브라우저 초기화 완료");
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
      scrapingLogger.info("TechCrunch 브라우저 종료 완료");
    } catch (error) {
      scrapingLogger.error("브라우저 종료 실패", error as Error);
    }
  }

  // 기사 링크 목록 수집 (다중 페이지 지원)
  async getArticleLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    const allLinks: string[] = [];
    let oldArticleCount = 0; // 2개월 이전 기사 카운터

    for (let pageIndex = 0; pageIndex < this.listPageUrls.length; pageIndex++) {
      const pageUrl = this.listPageUrls[pageIndex];

      try {
        console.log(
          `\n📖 [${pageIndex + 1}/${
            this.listPageUrls.length
          }] 페이지 스크래핑 중...`
        );
        console.log(`   📄 URL: ${pageUrl}`);
        scrapingLogger.info(
          `[${pageIndex + 1}/${
            this.listPageUrls.length
          }] 페이지 로드: ${pageUrl}`
        );

        await this.page.goto(pageUrl, {
          waitUntil: ["load", "domcontentloaded"],
          timeout: 60000,
        });

        await this.page.waitForSelector("body", { timeout: 10000 });
        await this.page.waitForTimeout(3000);

        const content = await this.page.content();
        const $ = cheerio.load(content);

        const pageLinks: string[] = [];

        // TechCrunch 기사 링크 선택자들
        const selectors = [
          ".wp-block-post-template li .loop-card__title-link",
          '.wp-block-post-template li a[href*="/20"]',
          "ul.wp-block-post-template li h3 a",
          ".loop-card__title-link",
          'a[href*="techcrunch.com/20"]',
        ];

        for (const selector of selectors) {
          $(selector).each((_: any, element: any) => {
            const href = $(element).attr("href");
            if (href) {
              const fullUrl = href.startsWith("http")
                ? href
                : `${this.baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;

              // TechCrunch 기사 URL 패턴 확인 (날짜 포함)
              if (
                fullUrl.includes("techcrunch.com/20") &&
                !pageLinks.includes(fullUrl)
              ) {
                pageLinks.push(fullUrl);
              }
            }
          });

          if (pageLinks.length > 0) break;
        }

        // 날짜 필터링 적용
        let filteredPageLinks = 0;
        let currentPageOldCount = 0;

        for (const link of pageLinks) {
          const articleDate = this.extractDateFromUrl(link);

          if (articleDate) {
            if (this.isWithinTwoMonths(articleDate)) {
              if (!allLinks.includes(link)) {
                allLinks.push(link);
                filteredPageLinks++;
              }
            } else {
              currentPageOldCount++;
            }
          } else {
            // 날짜를 추출할 수 없는 경우 일단 포함
            if (!allLinks.includes(link)) {
              allLinks.push(link);
              filteredPageLinks++;
            }
          }
        }

        oldArticleCount += currentPageOldCount;

        console.log(`   📊 발견된 기사: ${pageLinks.length}개`);
        console.log(`   ✅ 최근 2개월 내: ${filteredPageLinks}개`);
        console.log(`   📅 2개월 이전: ${currentPageOldCount}개`);

        scrapingLogger.info(
          `페이지 ${pageIndex + 1} - 전체: ${
            pageLinks.length
          }, 필터됨: ${filteredPageLinks}, 오래됨: ${currentPageOldCount}`
        );

        // 만약 이 페이지에서 2개월 이전 기사가 많다면 (70% 이상) 스크래핑 중단 고려
        if (
          pageLinks.length > 5 &&
          currentPageOldCount / pageLinks.length > 0.7
        ) {
          console.log(
            `   ⚠️  이 페이지의 ${Math.round(
              (currentPageOldCount / pageLinks.length) * 100
            )}%가 2개월 이전 기사입니다.`
          );
          scrapingLogger.info(
            `페이지 ${pageIndex + 1}에서 오래된 기사 비율이 높음: ${Math.round(
              (currentPageOldCount / pageLinks.length) * 100
            )}%`
          );
        }

        // 페이지 간 지연
        if (pageIndex < this.listPageUrls.length - 1) {
          const delayTime = Math.random() * 2000 + 1000; // 1-3초 랜덤 지연
          console.log(
            `   ⏳ 다음 페이지까지 ${Math.round(delayTime / 1000)}초 대기...`
          );
          await this.delay(delayTime);
        }
      } catch (error) {
        scrapingLogger.error(
          `페이지 ${pageIndex + 1} 스크래핑 실패: ${pageUrl}`,
          error as Error
        );
        console.log(`   ❌ 페이지 스크래핑 실패: ${(error as Error).message}`);
      }
    }

    console.log(`\n📊 전체 수집 완료:`);
    console.log(`   🔗 총 유효 기사: ${allLinks.length}개`);
    console.log(`   📅 필터링된 오래된 기사: ${oldArticleCount}개`);

    scrapingLogger.info(
      `전체 수집 완료 - 유효: ${allLinks.length}개, 필터됨: ${oldArticleCount}개`
    );
    return allLinks;
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

      // 제목 추출
      const titleSelectors = [
        "body > div.wp-site-blocks > div.seamless-scroll-container.wp-block-techcrunch-seamless-scroll-container > div.article-hero.article-hero--image-and-text.has-green-500-background-color.wp-block-techcrunch-article-hero > div.article-hero__second-section > div.article-hero__content > div.article-hero__middle > h1",
        ".article-hero__middle h1",
        "h1.article-hero__title",
        "h1",
        ".entry-title",
      ];

      let title = "";
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title) break;
      }

      // 본문 추출
      const contentSelectors = [
        "#wp--skip-link--target > div > div:nth-child(1)",
        ".entry-content.wp-block-post-content",
        ".article-content",
        ".post-content",
      ];

      let articleContent = "";
      for (const selector of contentSelectors) {
        const contentElem = $(selector).first();
        if (contentElem.length > 0) {
          // 광고 및 불필요한 요소 제거
          contentElem
            .find(
              ".wp-block-techcrunch-inline-cta, .ad-unit, .social-share, .inline-cta, .wp-block-tc-ads-ad-slot"
            )
            .remove();
          articleContent = contentElem.text().trim();
          if (articleContent) break;
        }
      }

      // 이미지 URL 수집
      const imageUrls: string[] = [];
      const imageSelectors = [
        "body > div.wp-site-blocks > div.seamless-scroll-container.wp-block-techcrunch-seamless-scroll-container > div.article-hero.article-hero--image-and-text.has-green-500-background-color.wp-block-techcrunch-article-hero > div.article-hero__first-section > figure > img",
        ".article-hero__first-section figure img",
        ".loop-card__figure img",
        ".entry-content img",
        'img[src*="wp-content/uploads"]',
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
      const dateSelectors = [
        "body > div.wp-site-blocks > div.seamless-scroll-container.wp-block-techcrunch-seamless-scroll-container > div.article-hero.article-hero--image-and-text.has-green-500-background-color.wp-block-techcrunch-article-hero > div.article-hero__second-section > div.article-hero__content > div.article-hero__bottom > div.article-hero__date > div > time",
        ".article-hero__date time",
        ".wp-block-post-date time",
        "time[datetime]",
      ];

      for (const selector of dateSelectors) {
        const dateElem = $(selector).first();
        if (dateElem.length > 0) {
          const dateTimeAttr = dateElem.attr("datetime");
          const dateText = dateElem.text().trim();

          if (dateTimeAttr) {
            publishedAt = new Date(dateTimeAttr);
            if (!isNaN(publishedAt.getTime())) break;
          } else if (dateText) {
            publishedAt = new Date(dateText);
            if (!isNaN(publishedAt.getTime())) break;
          }
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
      if (this.openaiApiKey === "test-key") {
        const testCategory = Math.floor(Math.random() * 5) + 1;
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

      const categoryMatch = categoryText.match(/[1-5]/);
      const category = categoryMatch ? parseInt(categoryMatch[0]) : 5;

      scrapingLogger.debug(`카테고리 분류 생성 완료: ${category}`);
      return category;
    } catch (error) {
      scrapingLogger.error("OpenAI 카테고리 분류 생성 실패", error as Error);
      return 5;
    }
  }

  // 전체 스크래핑 프로세스
  async scrapeArticles(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      articles: [],
      errors: [],
      source: "TechCrunch",
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

      // 4. 각 기사를 순차적으로 처리
      const articles: Article[] = [];
      const maxArticles = articleLinks.length; // 모든 새로운 기사 처리

      for (let i = 0; i < maxArticles; i++) {
        const url = articleLinks[i];

        try {
          console.log(`\n🔄 [${i + 1}/${maxArticles}] 기사 처리 중...`);
          scrapingLogger.info(`처리 중: ${i + 1}/${maxArticles} - ${url}`);

          console.log(`  📖 기사 스크래핑 중...`);
          const articleData = await this.scrapeArticleDetails(url);
          if (!articleData) {
            console.log(`  ⚠️  기사 데이터 없음`);
            scrapingLogger.warn(`기사 데이터 없음: ${url}`);
            continue;
          }

          console.log(`  🤖 제목 요약 생성 중...`);
          const titleSummary = await this.generateTitleSummary(
            articleData.title
          );
          console.log(`  🤖 본문 요약 생성 중...`);
          const contentSummary = await this.generateContentSummary(
            articleData.content
          );

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

          // 기사 간 지연
          if (i < maxArticles - 1) {
            const delayTime = Math.random() * 3000 + 2000;
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
        `\n🎉 스크래핑 완료: ${articles.length}/${maxArticles}개 성공`
      );
      scrapingLogger.info(
        `스크래핑 완료: ${articles.length}/${maxArticles}개 성공`
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
export async function scrapeTechCrunchNews(
  openaiApiKey: string
): Promise<ScrapingResult> {
  const listPageUrls = [
    "https://techcrunch.com/category/artificial-intelligence/",
    "https://techcrunch.com/category/artificial-intelligence/page/2/",
  ];
  const scraper = new TechCrunchScraper(listPageUrls, openaiApiKey);

  return await scraper.scrapeArticles();
}

import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import { Article, ScrapingResult } from "../types";
import { SCRAPING_CONFIG } from "../config";
import { scrapingLogger } from "../utils/logger";
import {
  getTitleSummaryPrompt,
  getContentSummaryPrompt,
  getCategoryTaggingPrompt,
  getDetailForSummaryLinePrompt,
} from "../prompts/aitimes.summary.prompt";
import {
  filterNewUrls,
  calculatePerformanceMetrics,
} from "../utils/duplicate-checker";
import { saveArticleToSupabase } from "../utils/save-articles";
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
async function requestDetailForSummaryLine(
  summaryLine: string,
  content: string
): Promise<string> {
  try {
    const prompt = getDetailForSummaryLinePrompt(summaryLine, content);

    console.log(`      🤖 세부 설명 API 호출 중...`);
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200, // 토큰 수 증가
      temperature: 0.3,
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

export class ArsTechnicaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = "https://arstechnica.com";
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

      scrapingLogger.info("Ars Technica 브라우저 초기화 완료");
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
      scrapingLogger.info("Ars Technica 브라우저 종료 완료");
    } catch (error) {
      scrapingLogger.error("브라우저 종료 실패", error as Error);
    }
  }

  // 기사 링크 목록 수집 (여러 페이지 지원 버전)
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
          `📖 [${i + 1}/${this.listPageUrls.length}] 페이지 스크래핑 중...`
        );

        await this.page.goto(listPageUrl, {
          waitUntil: ["load", "domcontentloaded"],
          timeout: 60000,
        });

        // 페이지 상태 확인
        await this.page.waitForSelector("body", { timeout: 10000 });

        // 추가 대기
        await this.page.waitForTimeout(3000);

        const content = await this.page.content();
        const $ = cheerio.load(content);

        const pageLinks: string[] = [];

        // card-숫자 패턴으로 기사 카드 찾기
        $('article[id^="card-"]').each((_, element) => {
          const cardElement = $(element);

          // 기사 제목 링크 찾기
          const titleLink = cardElement.find("h2 a").first();
          const href = titleLink.attr("href");

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

        console.log(`   📊 이 페이지에서 ${pageLinks.length}개 기사 발견`);
        scrapingLogger.info(
          `페이지 ${i + 1}에서 ${pageLinks.length}개 기사 발견`
        );

        // 페이지 간 지연
        if (i < this.listPageUrls.length - 1) {
          const delayTime = Math.random() * 2000 + 1000; // 1-3초 랜덤 지연
          console.log(
            `   ⏳ 다음 페이지까지 ${Math.round(delayTime / 1000)}초 대기...`
          );
          await this.delay(delayTime);
        }
      }

      console.log(
        `📊 총 ${allLinks.length}개 기사 링크 수집 완료 (${this.listPageUrls.length}개 페이지)`
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

      // 제목 추출
      const titleSelectors = ["h1", "header h1", ".article-header h1"];

      let title = "";
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title) break;
      }

      // 짧은 요약문 추출 (새로 추가)
      let shortSummary = "";
      const shortSummaryElement = $(
        "#main > article > header > div > div > div:nth-child(1) > p"
      );
      if (shortSummaryElement.length > 0) {
        shortSummary = shortSummaryElement.text().trim();
      }

      // 본문 추출 - #main > article 내부에서 ad-wrapper 제외하고 모든 텍스트 추출
      let articleContent = "";
      const mainArticle = $("#main > article");
      if (mainArticle.length > 0) {
        // article 복사본 생성
        const articleClone = mainArticle.clone();

        // 광고 및 불필요한 요소 제거
        articleClone
          .find(
            ".ad-wrapper, .ad, .related, .recommend, .social, .teads-adCall, .ars-interlude-container, header, .comments, .sidebar, nav, footer"
          )
          .remove();

        // 본문 텍스트 추출
        const textParts: string[] = [];

        // 모든 p, div, span 태그에서 텍스트 추출
        articleClone.find("p, div").each((_, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length > 20) {
            // 너무 짧은 텍스트는 제외
            textParts.push(text);
          }
        });

        // 중복 제거 및 정리
        const uniqueTexts = [...new Set(textParts)];
        articleContent = uniqueTexts.join("\n\n");

        // 만약 위 방법으로 추출이 안 되면 기존 방식 사용
        if (!articleContent || articleContent.length < 100) {
          const contentSelectors = [
            ".post-content",
            ".post-content-double",
            ".article-content",
            ".entry-content",
          ];

          for (const selector of contentSelectors) {
            const contentElements = $(selector);
            if (contentElements.length > 0) {
              const textParts: string[] = [];
              contentElements.each((_, elem) => {
                const contentElem = $(elem);
                contentElem
                  .find(
                    ".ad-wrapper, .ad, .related, .recommend, .social, .teads-adCall, .ars-interlude-container"
                  )
                  .remove();
                const text = contentElem.text().trim();
                if (text) {
                  textParts.push(text);
                }
              });
              articleContent = textParts.join("\n\n");
              if (articleContent) break;
            }
          }
        }
      }

      // 이미지 URL 수집
      const imageUrls: string[] = [];
      const imageSelectors = [
        ".intro-image",
        ".post-content img",
        "article img",
        ".wp-post-image",
      ];

      for (const selector of imageSelectors) {
        $(selector).each((_, element) => {
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
      const timeElement = $("time[datetime]");
      if (timeElement.length > 0) {
        const datetime = timeElement.attr("datetime");
        if (datetime) {
          publishedAt = new Date(datetime);
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
        shortSummary: shortSummary.trim(),
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

      // 본문 길이 제한 (토큰 제한 회피)
      const maxContentLength = 10000; // 약 10,000자로 제한
      const truncatedContent =
        content.length > maxContentLength
          ? content.substring(0, maxContentLength) + "..."
          : content;

      console.log(
        `    📏 본문 길이: ${content.length}자 -> ${truncatedContent.length}자로 제한`
      );
      scrapingLogger.debug(
        `본문 길이 제한: ${content.length}자 -> ${truncatedContent.length}자`
      );

      const prompt = getContentSummaryPrompt(truncatedContent);

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });

      const summary =
        response.choices[0]?.message?.content?.trim() ||
        "본문 요약 생성에 실패했습니다.";

      console.log(`    📝 생성된 요약: ${summary.substring(0, 200)}...`);
      scrapingLogger.debug(
        `본문 요약 생성 완료: ${summary.substring(0, 100)}...`
      );
      return summary;
    } catch (error) {
      console.error(`    ❌ 본문 요약 생성 실패: ${(error as Error).message}`);
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

  // 전체 스크래핑 프로세스
  async scrapeArticles(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      articles: [],
      errors: [],
      source: "Ars Technica",
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

          // 디버깅: 추출된 데이터 확인
          console.log(`  📄 제목: ${articleData.title.substring(0, 50)}...`);
          console.log(
            `  📝 짧은 요약: ${
              articleData.shortSummary?.substring(0, 100) || "없음"
            }...`
          );
          console.log(`  📋 본문 길이: ${articleData.content.length}자`);
          console.log(`  📸 이미지 수: ${articleData.imageUrls.length}개`);

          // 제목과 본문 요약 생성
          console.log(`  🤖 제목 요약 생성 중...`);
          const titleSummary = await this.generateTitleSummary(
            articleData.title
          );
          console.log(`  🤖 본문 요약 생성 중...`);

          // 짧은 요약문이 있으면 우선 활용
          const contentForSummary =
            articleData.shortSummary && articleData.shortSummary.length > 50
              ? `${articleData.shortSummary}\n\n${articleData.content}`
              : articleData.content;

          const contentSummary = await this.generateContentSummary(
            contentForSummary
          );

          // 카테고리 분류
          console.log(`  🤖 카테고리 분류 생성 중...`);
          const category = await this.generateCategoryTag(
            articleData.title,
            contentSummary
          );

          // 3줄 요약 분리 및 세부 설명 생성
          console.log(`    🔍 요약 파싱 중...`);
          const summaryLines = contentSummary
            .split(/\n|\r|\r\n/)
            .map((line) => line.trim())
            .filter((line) => line && line.match(/^\d+\./));

          console.log(`    📋 파싱된 요약 줄 수: ${summaryLines.length}`);
          summaryLines.forEach((line, index) => {
            console.log(`    ${index + 1}. ${line}`);
          });

          const details: string[] = [];
          for (let j = 0; j < summaryLines.length; j++) {
            const line = summaryLines[j];
            console.log(
              `    🔍 세부 설명 생성 중... (${j + 1}/${summaryLines.length})`
            );
            const detail = await requestDetailForSummaryLine(
              line,
              articleData.content.substring(0, 5000)
            ); // 세부 설명도 길이 제한
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
export async function scrapeArsTechnicaNews(
  openaiApiKey: string
): Promise<ScrapingResult> {
  const listPageUrls = [
    "https://arstechnica.com/ai/", // 첫 번째 페이지
    "https://arstechnica.com/ai/page/2/", // 두 번째 페이지
  ];
  const scraper = new ArsTechnicaScraper(listPageUrls, openaiApiKey);

  return await scraper.scrapeArticles();
}

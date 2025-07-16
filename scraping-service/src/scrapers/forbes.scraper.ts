import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import { Article, ScrapingResult } from "../types";
import { SCRAPING_CONFIG } from "../config";
import { scrapingLogger } from "../utils/logger";
import { saveArticleToSupabase } from "../utils/save-articles";
import {
  filterNewUrls,
  calculatePerformanceMetrics,
} from "../utils/duplicate-checker";
import OpenAI from "openai";

// OpenAI 클라이언트 생성 (API 키 필요)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ArticleData {
  title: string;
  content: string;
  imageUrls: string[];
  originalUrl: string;
  publishedAt?: Date;
  author?: string;
}

export class ForbesScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = "https://www.forbes.com";
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

      scrapingLogger.info("Forbes 브라우저 초기화 완료");
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
      scrapingLogger.info("Forbes 브라우저 종료 완료");
    } catch (error) {
      scrapingLogger.error("브라우저 종료 실패", error as Error);
    }
  }

  // 날짜가 2개월 이내인지 확인하는 함수
  private isWithinTwoMonths(publishedDate: Date): boolean {
    const now = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(now.getMonth() - 2);

    return publishedDate >= twoMonthsAgo;
  }

  // URL에서 날짜 추출 함수
  private extractDateFromUrl(url: string): Date | null {
    // Forbes URL 패턴에서 날짜 추출: /2024/12/15/
    const dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // JavaScript month is 0-based
      const day = parseInt(dateMatch[3]);
      return new Date(year, month, day);
    }
    return null;
  }

  // 기사 링크 목록 수집 (동적 로딩 지원)
  async getArticleLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    try {
      scrapingLogger.info(`기사 목록 페이지 로드 중: ${this.listPageUrl}`);
      console.log(`📖 Forbes AI 페이지 스크래핑 중...`);

      await this.page.goto(this.listPageUrl, {
        waitUntil: ["load", "domcontentloaded"],
        timeout: 60000,
      });

      // 페이지 상태 확인
      await this.page.waitForSelector("body", { timeout: 10000 });
      await this.page.waitForTimeout(3000);

      const allLinks: string[] = [];
      let clickCount = 0;
      const maxClicks = 10; // 최대 클릭 횟수 제한

      console.log(`🔄 동적 기사 로딩 시작 (최대 ${maxClicks}번 클릭)`);

      while (clickCount < maxClicks) {
        // 현재 페이지에서 기사 링크 수집
        const content = await this.page.content();
        const $ = cheerio.load(content);

        console.log(
          `  📊 [${clickCount + 1}/${maxClicks}] 현재 페이지 기사 수집 중...`
        );

        // 기사 div들에서 링크 추출
        const currentPageLinks: string[] = [];

        // Forbes AI 페이지의 기사 링크 선택자들
        const linkSelectors = [
          "#row-2 > div > div > div > div.Xo3nL > div.ZQt9W a",
          'a[href*="/sites/"]',
          'a[href*="/2024/"]',
          'a[href*="/2025/"]',
        ];

        for (const selector of linkSelectors) {
          $(selector).each((_: any, element: any) => {
            const href = $(element).attr("href");
            if (href) {
              let fullUrl = href;
              if (href.startsWith("/")) {
                fullUrl = `${this.baseUrl}${href}`;
              }

              // Forbes 기사 URL 패턴 확인 및 날짜 검증
              if (
                fullUrl.includes("forbes.com") &&
                (fullUrl.includes("/sites/") ||
                  fullUrl.match(/\/\d{4}\/\d{2}\/\d{2}\//))
              ) {
                // 기자 프로필 페이지 제외
                const isAuthorProfile = fullUrl.match(/\/sites\/[^\/]+\/?$/);

                if (
                  !isAuthorProfile &&
                  !allLinks.includes(fullUrl) &&
                  !currentPageLinks.includes(fullUrl)
                ) {
                  // URL에서 날짜 추출하여 2개월 이내인지 확인
                  const urlDate = this.extractDateFromUrl(fullUrl);
                  if (!urlDate || this.isWithinTwoMonths(urlDate)) {
                    currentPageLinks.push(fullUrl);
                    allLinks.push(fullUrl);
                  } else {
                    console.log(`    ⏰ 2개월 이후 기사 제외: ${fullUrl}`);
                  }
                }
              }
            }
          });
        }

        console.log(
          `    📋 이번 로드에서 ${currentPageLinks.length}개 새 기사 발견 (총 ${allLinks.length}개)`
        );

        // 2개월 이후 기사를 만나면 중단
        if (currentPageLinks.length === 0) {
          console.log(`    ⏹️ 새로운 기사가 없어서 로딩 중단`);
          break;
        }

        // "다음" 버튼 찾기 및 클릭
        try {
          const nextButton = await this.page.$(
            "#row-2 > div > div > div > div.Xo3nL > div.ZQt9W > div.aWBvPyEW > button"
          );

          if (!nextButton) {
            console.log(`    ⏹️ "다음" 버튼을 찾을 수 없어서 중단`);
            break;
          }

          // 버튼이 보이도록 스크롤
          await this.page.evaluate((btn) => {
            if (btn)
              btn.scrollIntoView({ behavior: "smooth", block: "center" });
          }, nextButton);

          await this.page.waitForTimeout(2000); // 스크롤 완료 대기

          console.log(`    🔄 "다음" 버튼 클릭 중...`);
          await nextButton.click();

          // 새 콘텐츠 로딩 대기
          await this.page.waitForTimeout(3000);

          clickCount++;
        } catch (error) {
          console.log(
            `    ⚠️ "다음" 버튼 클릭 실패: ${(error as Error).message}`
          );
          break;
        }
      }

      // 중복 제거 및 최종 필터링
      const uniqueLinks = [...new Set(allLinks)].filter(
        (link) =>
          !link.includes("#") &&
          !link.includes("newsletter") &&
          !link.includes("subscribe") &&
          !link.includes("coupons") &&
          !link.includes("advisor") &&
          !link.includes("profile") &&
          !link.includes("author") &&
          !link.match(/\/sites\/[^\/]+\/?$/) && // 기자 프로필 페이지 제외
          link.length > 30
      );

      console.log(
        `📊 최종 수집된 기사 링크: ${uniqueLinks.length}개 (${clickCount}번 클릭)`
      );
      scrapingLogger.info(`발견된 기사 링크 수: ${uniqueLinks.length}`);

      return uniqueLinks;
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
        timeout: 60000,
      });

      await this.page.waitForTimeout(2000);

      const content = await this.page.content();
      const $ = cheerio.load(content);

      // 제목 추출
      const titleSelectors = [
        "h1",
        ".headline",
        ".article-title",
        'h1[data-module="ArticleHeader"]',
        ".fs-headline",
        ".article-headline",
        "title",
      ];

      let title = "";
      for (const selector of titleSelectors) {
        title = $(selector).first().text().trim();
        if (title && title.length > 10) break;
      }

      // 본문 추출
      const contentSelectors = [
        ".article-body",
        ".article-content",
        ".fs-body",
        ".body-text",
        'div[data-module="ArticleBody"]',
        ".articleBody",
        ".entry-content",
      ];

      let articleContent = "";
      for (const selector of contentSelectors) {
        const contentElem = $(selector).first();
        if (contentElem.length > 0) {
          // 광고나 관련 기사 제거
          contentElem
            .find(
              ".ad, .advertisement, .related, .recommend, .social, .newsletter, .subscribe"
            )
            .remove();
          articleContent = contentElem.text().trim();
          if (articleContent && articleContent.length > 100) break;
        }
      }

      // 본문이 충분하지 않으면 p 태그들에서 추출
      if (!articleContent || articleContent.length < 100) {
        const paragraphs: string[] = [];
        $("p").each((_, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length > 20) {
            paragraphs.push(text);
          }
        });
        articleContent = paragraphs.join("\n\n");
      }

      // 이미지 URL 추출 - 메타 태그 우선, 그 다음 본문 이미지
      const imageUrls: string[] = [];

      // 1. 메타 태그에서 이미지 추출 (더 포괄적으로)
      const metaImageSelectors = [
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[property="twitter:image"]',
        'meta[name="twitter:image"]',
        'meta[itemprop="image"]',
      ];

      for (const selector of metaImageSelectors) {
        const imageContent = $(selector).attr("content");
        if (
          imageContent &&
          (imageContent.startsWith("http") || imageContent.startsWith("//"))
        ) {
          let fullImageUrl = imageContent;
          if (imageContent.startsWith("//")) {
            fullImageUrl = `https:${imageContent}`;
          }
          // 중복 제거
          if (!imageUrls.includes(fullImageUrl)) {
            imageUrls.push(fullImageUrl);
          }
        }
      }

      // 2. 본문에서 추가 이미지 추출
      const imgSelectors = [
        'img[src*="imageio.forbes.com"]',
        'img[src*="forbesimg.com"]',
        'img[src*="forbes.com"]',
        "img",
      ];

      for (const selector of imgSelectors) {
        $(selector).each((_, elem) => {
          const src = $(elem).attr("src");
          if (src && (src.startsWith("http") || src.startsWith("//"))) {
            let fullImageUrl = src;
            if (src.startsWith("//")) {
              fullImageUrl = `https:${src}`;
            }
            // 중복 제거 및 유효성 검사
            if (
              !imageUrls.includes(fullImageUrl) &&
              !fullImageUrl.includes("data:") &&
              !fullImageUrl.includes("placeholder") &&
              !fullImageUrl.includes("loading")
            ) {
              imageUrls.push(fullImageUrl);
            }
          }
        });

        // 이미지를 찾았으면 다음 선택자는 건너뛰기
        if (imageUrls.length > 0) break;
      }

      // 작성자 추출 (메타 태그 우선)
      let author = "";

      // 1. 메타 태그에서 작성자 추출
      const metaAuthorSelectors = [
        'meta[property="article:author"]',
        'meta[name="author"]',
        'meta[itemprop="author"]',
      ];

      for (const selector of metaAuthorSelectors) {
        const authorContent = $(selector).attr("content");
        if (authorContent && authorContent.trim()) {
          author = authorContent.trim();
          break;
        }
      }

      // 2. 본문에서 작성자 추출 (백업)
      if (!author) {
        const authorSelectors = [
          ".author-name",
          ".byline",
          ".author",
          '[data-module="AuthorInfo"]',
          ".fs-author",
        ];

        for (const selector of authorSelectors) {
          const authorText = $(selector).first().text().trim();
          if (authorText) {
            author = authorText;
            break;
          }
        }
      }

      // 발행일 추출 - JSON-LD 우선, 그 다음 메타 태그
      let publishedAt: Date | undefined;

      // 1. JSON-LD 구조에서 발행일 추출 (가장 정확한 정보)
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonLdText = $(jsonLdScripts[i]).html();
          if (jsonLdText) {
            const jsonLdData = JSON.parse(jsonLdText);

            // 단일 객체 또는 배열 처리
            const dataArray = Array.isArray(jsonLdData)
              ? jsonLdData
              : [jsonLdData];

            for (const data of dataArray) {
              if (data.datePublished) {
                const parsedDate = new Date(data.datePublished);
                if (!isNaN(parsedDate.getTime())) {
                  publishedAt = parsedDate;
                  break;
                }
              }
            }

            if (publishedAt) break;
          }
        } catch (error) {
          // JSON 파싱 실패 시 무시하고 계속
        }
      }

      // 2. 메타 태그에서 발행일 추출 (백업)
      if (!publishedAt) {
        const metaDateSelectors = [
          'meta[property="article:published"]',
          'meta[property="article:published_time"]',
          'meta[itemprop="datePublished"]',
          'meta[name="datePublished"]',
          'meta[property="og:published_time"]',
        ];

        for (const selector of metaDateSelectors) {
          const dateContent = $(selector).attr("content");
          if (dateContent) {
            const parsedDate = new Date(dateContent);
            if (!isNaN(parsedDate.getTime())) {
              publishedAt = parsedDate;
              break;
            }
          }
        }
      }

      // 2. 본문 선택자에서 발행일 추출 (백업)
      if (!publishedAt) {
        const dateSelectors = [
          "time[datetime]",
          "time",
          ".date",
          ".published-date",
          ".fs-timestamp",
          "[data-timestamp]",
        ];

        for (const selector of dateSelectors) {
          const dateElem = $(selector).first();
          const dateText =
            dateElem.attr("datetime") ||
            dateElem.attr("data-timestamp") ||
            dateElem.text().trim();
          if (dateText) {
            const parsedDate = new Date(dateText);
            if (!isNaN(parsedDate.getTime())) {
              publishedAt = parsedDate;
              break;
            }
          }
        }
      }

      if (!title || !articleContent) {
        scrapingLogger.warn(`필수 데이터 누락: ${articleUrl}`);
        return null;
      }

      if (articleContent.length < 100) {
        scrapingLogger.warn(`본문이 너무 짧음: ${articleUrl}`);
        return null;
      }

      return {
        title,
        content: articleContent,
        imageUrls: imageUrls.slice(0, 3), // 최대 3개 이미지
        originalUrl: articleUrl,
        publishedAt,
        author,
      };
    } catch (error) {
      scrapingLogger.error(
        `기사 상세 스크래핑 실패: ${articleUrl}`,
        error as Error
      );
      return null;
    }
  }

  // 제목 번역
  async translateTitle(title: string): Promise<string> {
    try {
      if (this.openaiApiKey === "test-key") {
        return `[테스트 모드] ${title}의 한국어 번역`;
      }

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "user",
            content: `다음 영어 제목을 한국어로 번역해주세요: "${title}"`,
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const translatedTitle =
        response.choices[0]?.message?.content?.trim() || title;
      scrapingLogger.debug(`제목 번역 완료: ${title} -> ${translatedTitle}`);
      return translatedTitle;
    } catch (error) {
      scrapingLogger.error("제목 번역 실패", error as Error);
      return title;
    }
  }

  // 본문 요약 생성
  async generateSummary(content: string): Promise<string[]> {
    try {
      if (this.openaiApiKey === "test-key") {
        return [
          "[테스트 모드] 첫 번째 요약",
          "[테스트 모드] 두 번째 요약",
          "[테스트 모드] 세 번째 요약",
        ];
      }

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "user",
            content: `다음 기사를 한국어로 3줄 요약해주세요:\n\n${content}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      const summaryText = response.choices[0]?.message?.content?.trim() || "";
      const summaryLines = summaryText
        .split(/\n/)
        .filter((line) => line.trim().match(/^\d+\./));

      scrapingLogger.debug(`본문 요약 생성 완료: ${summaryLines.length}줄`);
      return summaryLines.length > 0
        ? summaryLines
        : ["요약 생성에 실패했습니다."];
    } catch (error) {
      scrapingLogger.error("본문 요약 생성 실패", error as Error);
      return ["요약 생성에 실패했습니다."];
    }
  }

  // 세부 설명 생성
  async generateDetailForSummaryLine(
    summaryLine: string,
    content: string
  ): Promise<string> {
    try {
      if (this.openaiApiKey === "test-key") {
        return `[테스트 모드] ${summaryLine}에 대한 세부 설명`;
      }

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "user",
            content: `다음 요약 문장에 대해 원문을 바탕으로 최대 300자 이내의 상세한 설명을 작성해주세요:\n\n요약: ${summaryLine}\n\n원문: ${content}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const detail =
        response.choices[0]?.message?.content?.trim() ||
        "세부 설명 생성에 실패했습니다.";
      scrapingLogger.debug(`세부 설명 생성 완료`);
      return detail;
    } catch (error) {
      scrapingLogger.error("세부 설명 생성 실패", error as Error);
      return "세부 설명 생성에 실패했습니다.";
    }
  }

  // 카테고리 분류 생성
  async generateCategoryTag(title: string, summary: string): Promise<number> {
    try {
      if (this.openaiApiKey === "test-key") {
        return Math.floor(Math.random() * 5) + 1;
      }

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "user",
            content: `제목: ${title}\n요약: ${summary}\n\n다음 카테고리 중 하나를 선택해주세요:\n1. AI/기술\n2. 비즈니스\n3. 경제/금융\n4. 사회/정치\n5. 기타\n\n숫자만 답변해주세요.`,
          },
        ],
        max_tokens: 50,
        temperature: 0.1,
      });

      const categoryText = response.choices[0]?.message?.content?.trim() || "5";
      const categoryMatch = categoryText.match(/[1-5]/);
      const category = categoryMatch ? parseInt(categoryMatch[0]) : 5;

      scrapingLogger.debug(`카테고리 분류 생성 완료: ${category}`);
      return category;
    } catch (error) {
      scrapingLogger.error("카테고리 분류 생성 실패", error as Error);
      return 5;
    }
  }

  // 전체 스크래핑 프로세스
  async scrapeArticles(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      articles: [],
      errors: [],
      source: "Forbes",
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

      // 2. 각 기사를 순차적으로 처리
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

          // 제목 번역
          console.log(`  🤖 제목 번역 중...`);
          const translatedTitle = await this.translateTitle(articleData.title);

          // 본문 요약 생성
          console.log(`  🤖 본문 요약 생성 중...`);
          const summaryLines = await this.generateSummary(articleData.content);

          // 세부 설명 생성
          const details: string[] = [];
          for (let j = 0; j < summaryLines.length; j++) {
            const line = summaryLines[j];
            console.log(
              `    🔍 세부 설명 생성 중... (${j + 1}/${summaryLines.length})`
            );
            const detail = await this.generateDetailForSummaryLine(
              line,
              articleData.content
            );
            details.push(detail);
          }

          // 카테고리 분류
          console.log(`  🤖 카테고리 분류 생성 중...`);
          const category = await this.generateCategoryTag(
            translatedTitle,
            summaryLines.join(" ")
          );

          const article: Article = {
            titleSummary: translatedTitle,
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

          // 기사 간 지연 (2초)
          if (i < articleLinks.length - 1) {
            console.log(`  ⏳ 다음 기사까지 2초 대기...`);
            await this.delay(2000);
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
export async function scrapeForbesNews(
  openaiApiKey: string
): Promise<ScrapingResult> {
  const listPageUrl = "https://www.forbes.com/ai/";
  const scraper = new ForbesScraper(listPageUrl, openaiApiKey);

  const result = await scraper.scrapeArticles();

  // 개별 저장이므로 여기서는 저장 과정이 이미 완료됨
  console.log(`✅ 모든 기사가 실시간으로 데이터베이스에 저장되었습니다.`);

  return result;
}

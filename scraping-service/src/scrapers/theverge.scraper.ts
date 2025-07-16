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

// OpenAI 클라이언트 생성
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ArticleData {
  title: string;
  content: string;
  imageUrls: string[];
  originalUrl: string;
  publishedAt?: Date;
}

// 세부 설명 생성 함수 추가
async function requestDetailForSummaryLine(
  summaryLine: string,
  content: string
): Promise<string> {
  try {
    const prompt = `아래는 뉴스 기사 본문과, 그 본문을 요약한 한 문장입니다.

[기사 본문]
${content}

[요약 문장]
${summaryLine}

위 요약 문장에 대해, 본문 내용을 바탕으로 요약적으로 세부설명을 붙여라.
세부설명은 본문 내용에 무조건적으로 기반해야한다.
내용은 최대 300자로만 해야한다.
또 원어가 영어일 경우 한국어로 번역된 자연스러운 결과를 출력할것.
"제목:", "상세설명:", 따옴표(""), 번호(1,2,3) 등의 포맷팅은 절대 포함하지 말고 오직 설명 텍스트만 출력해라.`;

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
    scrapingLogger.error(`❌ 세부 설명 생성 실패: ${(error as Error).message}`);
    return `세부 설명 생성 실패: ${(error as Error).message}`;
  }
}

export class TheVergeScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = "https://www.theverge.com";
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

  // URL에서 날짜 추출 (The Verge URL 패턴: /2024/12/15/)
  private extractDateFromUrl(url: string): Date | null {
    const dateMatch = url.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
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
        headless: true,
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
        ],
      });

      this.page = await this.browser.newPage();

      // User Agent 설정
      await this.page.setUserAgent(SCRAPING_CONFIG.userAgent);

      // 뷰포트 설정
      await this.page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      scrapingLogger.info("✅ The Verge 스크래퍼 브라우저 초기화 완료");
    } catch (error) {
      scrapingLogger.error("❌ 브라우저 초기화 실패:", error);
      throw error;
    }
  }

  // 브라우저 종료
  async closeBrowser(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        scrapingLogger.info("✅ 브라우저 종료 완료");
      }
    } catch (error) {
      scrapingLogger.error("❌ 브라우저 종료 실패:", error);
    }
  }

  // 기사 링크 수집 (다중 페이지 지원)
  async getArticleLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error("페이지가 초기화되지 않았습니다.");
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
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        // 페이지 로딩 대기
        await this.delay(2000);

        const html = await this.page.content();
        const $ = cheerio.load(html);

        const pageLinks: string[] = [];

        // 메인 히어로 기사 링크 수집
        const heroSelector =
          "#content > div._1ymtmqp0 > div > div.duet--article--hero._1ymtmqph";
        $(heroSelector)
          .find('a[href*="/ai-artificial-intelligence/"]')
          .each((index, element) => {
            const href = $(element).attr("href");
            if (href) {
              const fullUrl = href.startsWith("http")
                ? href
                : `${this.baseUrl}${href}`;
              if (!pageLinks.includes(fullUrl)) {
                pageLinks.push(fullUrl);
              }
            }
          });

        // 리버 레이아웃의 기사 링크 수집 (5번째부터)
        const riverSelector =
          "#content > div._1ymtmqp0 > div > div.duet--layout--river-container._1ibrbus0 > div > div.duet--layout--river.hp1qhq2.hp1qhq1 > div.hp1qhq3 > div > div";
        $(riverSelector).each((index, element) => {
          // 5번째 요소부터 처리 (0-based index이므로 4부터)
          if (index >= 4) {
            $(element)
              .find('a[href*="/ai-artificial-intelligence/"]')
              .each((_, linkElement) => {
                const href = $(linkElement).attr("href");
                if (href) {
                  const fullUrl = href.startsWith("http")
                    ? href
                    : `${this.baseUrl}${href}`;
                  if (!pageLinks.includes(fullUrl)) {
                    pageLinks.push(fullUrl);
                  }
                }
              });
          }
        });

        // 일반적인 기사 링크도 수집 (fallback)
        $('a[href*="/ai-artificial-intelligence/"]').each((index, element) => {
          const href = $(element).attr("href");
          if (
            href &&
            href.includes("/ai-artificial-intelligence/") &&
            !href.includes("#")
          ) {
            const fullUrl = href.startsWith("http")
              ? href
              : `${this.baseUrl}${href}`;
            if (!pageLinks.includes(fullUrl) && pageLinks.length < 20) {
              pageLinks.push(fullUrl);
            }
          }
        });

        // 중복 제거 (댓글 링크 제거)
        const uniquePageLinks = pageLinks.filter(
          (link) => !link.includes("#comments")
        );

        // 날짜 필터링 적용
        let filteredPageLinks = 0;
        let currentPageOldCount = 0;

        for (const link of uniquePageLinks) {
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

        console.log(`   📊 발견된 기사: ${uniquePageLinks.length}개`);
        console.log(`   ✅ 최근 2개월 내: ${filteredPageLinks}개`);
        console.log(`   📅 2개월 이전: ${currentPageOldCount}개`);

        scrapingLogger.info(
          `페이지 ${pageIndex + 1} - 전체: ${
            uniquePageLinks.length
          }, 필터됨: ${filteredPageLinks}, 오래됨: ${currentPageOldCount}`
        );

        // 만약 이 페이지에서 2개월 이전 기사가 많다면 (70% 이상) 스크래핑 중단 고려
        if (
          uniquePageLinks.length > 5 &&
          currentPageOldCount / uniquePageLinks.length > 0.7
        ) {
          console.log(
            `   ⚠️  이 페이지의 ${Math.round(
              (currentPageOldCount / uniquePageLinks.length) * 100
            )}%가 2개월 이전 기사입니다.`
          );
          scrapingLogger.info(
            `페이지 ${pageIndex + 1}에서 오래된 기사 비율이 높음: ${Math.round(
              (currentPageOldCount / uniquePageLinks.length) * 100
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
    return allLinks.slice(0, 10); // 최대 10개만 처리
  }

  // 개별 기사 상세 정보 스크래핑
  async scrapeArticleDetails(articleUrl: string): Promise<ArticleData | null> {
    if (!this.page) {
      throw new Error("페이지가 초기화되지 않았습니다.");
    }

    try {
      scrapingLogger.info(`📖 기사 상세 정보 스크래핑: ${articleUrl}`);

      await this.page.goto(articleUrl, {
        waitUntil: "networkidle2",
        timeout: 45000,
      });

      await this.delay(2000);

      const html = await this.page.content();
      const $ = cheerio.load(html);

      // 제목 추출
      let title = $("h1").first().text().trim();
      if (!title) {
        title = $("title").text().replace(" | The Verge", "").trim();
      }

      // 본문 내용 추출
      let content = "";

      // The Verge의 기사 본문 셀렉터들
      const contentSelectors = [
        ".duet--article--article-body-component",
        ".c-entry-content",
        ".entry-content",
        'div[data-module="ArticleBody"]',
        ".article-body",
      ];

      for (const selector of contentSelectors) {
        const contentElements = $(selector);
        if (contentElements.length > 0) {
          contentElements
            .find("p, h2, h3, h4, h5, h6")
            .each((index, element) => {
              const text = $(element).text().trim();
              if (text && text.length > 10) {
                content += text + "\n\n";
              }
            });
          break;
        }
      }

      // 본문이 없으면 전체 텍스트에서 추출
      if (!content) {
        $("p").each((index, element) => {
          const text = $(element).text().trim();
          if (text && text.length > 20) {
            content += text + "\n\n";
          }
        });
      }

      // 이미지 URL 수집
      const imageUrls: string[] = [];
      $("img").each((index, element) => {
        const src = $(element).attr("src");
        if (src && (src.startsWith("http") || src.startsWith("//"))) {
          const fullUrl = src.startsWith("//") ? `https:${src}` : src;
          if (!imageUrls.includes(fullUrl)) {
            imageUrls.push(fullUrl);
          }
        }
      });

      // 발행일 추출
      let publishedAt: Date | undefined;
      const dateSelectors = [
        "time[datetime]",
        "[datetime]",
        ".publish-date",
        ".article-date",
      ];

      for (const selector of dateSelectors) {
        const dateElement = $(selector).first();
        if (dateElement.length > 0) {
          const datetime = dateElement.attr("datetime") || dateElement.text();
          if (datetime) {
            const date = new Date(datetime);
            if (!isNaN(date.getTime())) {
              publishedAt = date;
              break;
            }
          }
        }
      }

      if (!title || !content) {
        scrapingLogger.warn(`⚠️ 기사 정보 부족: ${articleUrl}`);
        return null;
      }

      return {
        title,
        content: content.trim(),
        imageUrls,
        originalUrl: articleUrl,
        publishedAt,
      };
    } catch (error) {
      scrapingLogger.error(
        `❌ 기사 상세 정보 스크래핑 실패: ${articleUrl}`,
        error
      );
      return null;
    }
  }

  // 제목 요약 생성
  async generateTitleSummary(title: string): Promise<string> {
    try {
      const prompt = `{${title}} <- 들어갈 문장

위 문장을 아주 짧게, 핵심 위주로 요약해줘.
원어가 영어일 경우 한국어로 번역된 자연스러운 결과를 출력해주세요.
"제목:", "상세설명:", 따옴표(""), 번호(1,2,3) 등의 포맷팅은 절대 포함하지 말고 오직 요약된 텍스트만 출력해라.
기존 틀에서 벗어난 문장 제목 (예 : 고유명사) 의 경우에도 무조건 제목에 해당하는 문장을 출력해라.`;

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || title;
    } catch (error) {
      scrapingLogger.error("❌ 제목 요약 생성 실패:", error);
      return title;
    }
  }

  // 본문 요약 생성
  async generateContentSummary(content: string): Promise<string> {
    try {
      const prompt = `{${content.substring(0, 3000)}}
위 글을 딱 3줄로만 요약해줘.
테크 업계에서 일어나는 일을 좋아하는 기술 매니아를 위한 요약이야.
문장이 너무 길지 않고 잘 읽히게, 핵심을 담아서 써줘야해.
원어가 영어일 경우 한국어로 번역된 자연스러운 결과를 출력해주세요.

다음 형식으로 정확히 출력해주세요:
1. 첫 번째 요약 문장
2. 두 번째 요약 문장  
3. 세 번째 요약 문장`;

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });

      return (
        response.choices[0]?.message?.content?.trim() ||
        "요약을 생성할 수 없습니다."
      );
    } catch (error) {
      scrapingLogger.error("❌ 본문 요약 생성 실패:", error);
      return "요약을 생성할 수 없습니다.";
    }
  }

  // 카테고리 태그 생성
  async generateCategoryTag(title: string, summary: string): Promise<number> {
    try {
      const prompt = `아래는 AI 뉴스 기사 제목과 요약입니다. 이 기사가 어떤 카테고리에 속하는지 1~5 중 하나의 숫자만 골라서 답변해줘. 반드시 숫자만 출력해야 해. 원어가 영어일 경우 한국어로 번역된 자연스러운 결과를 출력해주세요.

[카테고리 정의]
1. 오픈소스 : 개발자들이 실제로 사용할 수 있는, 경량 모델 공개, 오픈소스 모델공개 등에 대한 것들.
2. 서비스 : 일반인이 사용할 수 있는 상용 AI 서비스에 대한 이야기. 예) Claude 신규 기능 출시, X에서 Grok4 신규 공개 등
3. 연구 : 대학원이나 기업에서 연구 수준에 그친 느낌.
4. 비즈니스 / 산업 : 정부 투자, AI 법/정책, 대기업/산업/계약/투자/시장/정책 등
5. 기타 : 위 1~4에 해당하지 않는 경우

포괄적으로 생각해서 분류하지말고, 좁고 깐깐하게 1~4를 분류해줘. 1~4에 확실히 해당되지 않으면 5번이야.

[기사 제목]
${title}

[기사 요약]
${summary}

카테고리 번호(1~5)만 답변: `;

      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.1,
      });

      const categoryText = response.choices[0]?.message?.content?.trim() || "5";
      const categoryMatch = categoryText.match(/[1-5]/);
      const category = categoryMatch ? parseInt(categoryMatch[0]) : 5;

      return category;
    } catch (error) {
      scrapingLogger.error("❌ 카테고리 태그 생성 실패:", error);
      return 5;
    }
  }

  // 전체 스크래핑 실행
  async scrapeArticles(): Promise<ScrapingResult> {
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;
    const articles: Article[] = [];

    try {
      await this.initBrowser();

      // 기사 링크 수집
      const allArticleLinks = await this.getArticleLinks();

      if (allArticleLinks.length === 0) {
        scrapingLogger.warn("⚠️ 수집된 기사 링크가 없습니다.");
        return {
          success: false,
          articles: [],
          errors: ["수집된 기사 링크가 없습니다."],
          source: "THEVERGE",
          scrapedAt: new Date(),
          totalCount: 0,
        };
      }

      console.log(`📊 총 ${allArticleLinks.length}개 기사 발견`);
      scrapingLogger.info(`총 ${allArticleLinks.length}개 기사 발견`);

      // 중복 URL 필터링 (새로운 URL만 추출)
      console.log("🔍 기존 데이터 중복 체크 중...");
      const articleLinks = await filterNewUrls(allArticleLinks);

      if (articleLinks.length === 0) {
        console.log("✅ 새로운 기사가 없습니다 (모든 기사가 이미 수집됨)");
        scrapingLogger.info("새로운 기사 없음 - 모든 기사가 이미 존재");
        return {
          success: true,
          articles: [],
          errors: [],
          source: "THEVERGE",
          scrapedAt: new Date(),
          totalCount: allArticleLinks.length,
        };
      }

      // 성능 메트릭 계산 및 표시
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
      scrapingLogger.info(`🔄 ${articleLinks.length}개 기사 처리 시작`);

      // 각 기사 처리
      for (const [index, articleUrl] of articleLinks.entries()) {
        try {
          scrapingLogger.info(
            `📰 [${index + 1}/${articleLinks.length}] 처리 중: ${articleUrl}`
          );

          const articleData = await this.scrapeArticleDetails(articleUrl);

          if (!articleData) {
            failCount++;
            continue;
          }

          // 제목 요약 생성
          const titleSummary = await this.generateTitleSummary(
            articleData.title
          );

          // 본문 요약 생성
          const contentSummary = await this.generateContentSummary(
            articleData.content
          );

          // 카테고리 태그 생성
          const categoryTag = await this.generateCategoryTag(
            titleSummary,
            contentSummary
          );

          // 3줄 요약 분리 및 세부 설명 생성
          const summaryLines = contentSummary
            .split(/\n|\r|\r\n/)
            .filter((line) => line.trim().match(/^\d+\./));
          const details: string[] = [];

          for (let j = 0; j < summaryLines.length; j++) {
            const line = summaryLines[j];
            scrapingLogger.info(
              `    🔍 세부 설명 생성 중... (${j + 1}/${summaryLines.length})`
            );
            const detail = await requestDetailForSummaryLine(
              line,
              articleData.content
            );
            details.push(detail);
            scrapingLogger.info(
              `    📑 세부 설명: ${detail.replace(/\n/g, " ")}`
            );
          }

          const article: Article = {
            titleSummary: titleSummary,
            publishedAt: articleData.publishedAt || new Date(),
            url: articleData.originalUrl,
            imageUrls: articleData.imageUrls,
            summaryLines: summaryLines,
            details: details,
            category: categoryTag,
          };

          // 즉시 DB에 저장
          try {
            console.log(`  💾 DB 저장 중...`);
            await saveArticleToSupabase(article);
            articles.push(article);
            successCount++;
            console.log(
              `  ✅ 처리 및 저장 완료: ${article.titleSummary.substring(
                0,
                40
              )}...`
            );
            scrapingLogger.info(
              `✅ [${index + 1}/${
                articleLinks.length
              }] 처리 및 저장 완료: ${titleSummary}`
            );
          } catch (saveError) {
            const saveErrorMsg = `DB 저장 실패: ${articleData.originalUrl} - ${
              (saveError as Error).message
            }`;
            console.log(`  ❌ ${saveErrorMsg}`);
            scrapingLogger.error(saveErrorMsg);
            // 에러 배열이 없으므로 로그만 남김
          }

          // 요청 간 딜레이
          await this.delay(1000);
        } catch (error) {
          scrapingLogger.error(
            `❌ [${index + 1}/${articleLinks.length}] 처리 실패: ${articleUrl}`,
            error
          );
          failCount++;
        }
      }

      // 개별 저장이므로 여기서는 저장 과정이 이미 완료됨
      scrapingLogger.info(
        `💾 모든 기사가 실시간으로 데이터베이스에 저장되었습니다.`
      );

      const executionTime = Date.now() - startTime;
      scrapingLogger.info(
        `🎉 The Verge 스크래핑 완료 - 성공: ${successCount}, 실패: ${failCount}, 실행시간: ${executionTime}ms`
      );

      return {
        success: true,
        articles,
        errors: [],
        source: "THEVERGE",
        scrapedAt: new Date(),
        totalCount: articleLinks.length,
      };
    } catch (error) {
      scrapingLogger.error("❌ The Verge 스크래핑 실패:", error);
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export async function scrapeTheVergeNews(
  openaiApiKey: string
): Promise<ScrapingResult> {
  const listPageUrls = [
    "https://www.theverge.com/ai-artificial-intelligence",
    "https://www.theverge.com/ai-artificial-intelligence/archives/2",
  ];
  const scraper = new TheVergeScraper(listPageUrls, openaiApiKey);
  return await scraper.scrapeArticles();
}

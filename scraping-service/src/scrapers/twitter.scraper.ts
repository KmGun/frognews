import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import { scrapingLogger } from "../utils/logger";
import { translateTweetToKorean, canTranslate } from "../utils/translation";
import { detectTweetCategory } from "../utils/ai-content-detector";
import {
  filterNewTweetIds,
  extractTweetIdFromUrl,
  calculatePerformanceMetrics,
} from "../utils/duplicate-checker";
import { SCRAPING_CONFIG, ENV } from "../config";

// 다양한 User Agent 목록
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; Bingbot/2; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (compatible; DuckDuckBot/10; +http://duckduckgo.com/duckduckbot.html)",
];

// 프록시 서비스 목록 (무료 프록시들)
const PROXY_SERVICES = [
  "https://nitter.net",
  "https://nitter.it",
  "https://nitter.unixfox.eu",
  "https://nitter0.14.us",
  "https://nitter.kavin.rocks",
  "https://nitter.pw",
  "https://nitter.moomoo.me",
  "https://nitter.privacydev.net",
  "https://nitter.woodland.cafe",
  "https://nitter.weiler.rocks",
];

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
  // 미디어 정보 - 이미지 URL들만 저장
  media?: string[];
  // 비디오 임베드 정보
  hasVideo?: boolean; // 비디오가 있는지 여부
  videoEmbedInfo?: {
    tweetId: string; // 트위터 게시물 ID
    username: string; // 작성자 username
    embedUrl: string; // 임베드용 URL
  };
  // 외부 링크 정보
  externalLinks?: {
    url: string;
    title?: string;
    description?: string;
    thumbnailUrl?: string;
  }[];
}

export class TwitterScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;
  private isRequestInterceptionEnabled: boolean = false;

  // 브라우저 초기화
  async initBrowser(): Promise<void> {
    try {
      console.log(`🔧 [2-1] Puppeteer 브라우저 시작...`);

      // 랜덤 User Agent 선택
      const randomUserAgent =
        USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

      this.browser = await puppeteer.launch({
        headless: false, // 디버깅을 위해 보이게
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--disable-default-apps",
          "--disable-extensions",
          "--start-maximized",
          "--disable-blink-features=AutomationControlled",
          // Cloudflare 우회를 위한 추가 설정
          "--disable-features=VizDisplayCompositor",
          "--disable-ipc-flooding-protection",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-client-side-phishing-detection",
          "--disable-sync",
          "--disable-translate",
          "--hide-scrollbars",
          "--mute-audio",
          "--no-zygote",
          "--disable-accelerated-2d-canvas",
          "--disable-accelerated-jpeg-decoding",
          "--disable-accelerated-mjpeg-decode",
          "--disable-accelerated-video-decode",
          "--disable-canvas-aa",
          "--disable-2d-canvas-clip-aa",
          "--disable-gl-drawing-for-tests",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--enable-features=NetworkService,NetworkServiceLogging",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-extensions-with-background-pages",
          "--disable-features=TranslateUI,BlinkGenPropertyTrees",
          "--disable-field-trial-config",
          "--disable-hang-monitor",
          "--disable-prompt-on-repost",
          "--disable-web-security",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
          "--no-first-run",
          "--enable-automation",
          "--password-store=basic",
          "--use-mock-keychain",
          // 추가 Cloudflare 우회 설정
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
          "--disable-blink-features=AutomationControlled",
          "--no-default-browser-check",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-client-side-phishing-detection",
          "--disable-default-apps",
          "--disable-extensions-file-access-check",
          "--disable-extensions-http-throttling",
          "--disable-extensions-https-enforcement",
          "--disable-ipc-flooding-protection",
          "--user-data-dir=/tmp/puppeteer_dev_chrome_profile-" + Math.random(),
        ],
        ignoreDefaultArgs: ["--enable-blink-features=IdleDetection"],
      });

      console.log(`🔧 [2-2] 새 페이지 생성...`);
      this.page = await this.browser.newPage();

      console.log(`🔧 [2-3] User Agent 설정...`);
      // 랜덤 User Agent 설정
      await this.page.setUserAgent(randomUserAgent);

      console.log(`🔧 [2-4] 뷰포트 및 헤더 설정...`);
      // 랜덤 뷰포트 설정 (실제 사용자처럼)
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
      ];
      const randomViewport =
        viewports[Math.floor(Math.random() * viewports.length)];

      await this.page.setViewport({
        ...randomViewport,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });

      // 언어 설정 (한국어 우선)
      await this.page.setExtraHTTPHeaders({
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      });

      console.log(`🔧 [2-5] 봇 탐지 우회 설정...`);
      // 강화된 WebDriver 탐지 방지
      await this.page.evaluateOnNewDocument(() => {
        // webdriver 속성 완전 제거
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });

        // languages 설정
        Object.defineProperty(navigator, "languages", {
          get: () => ["ko-KR", "ko", "en-US", "en"],
        });

        // plugins 정보 설정
        Object.defineProperty(navigator, "plugins", {
          get: () => [
            {
              0: {
                type: "application/x-google-chrome-pdf",
                suffixes: "pdf",
                description: "Portable Document Format",
                enabledPlugin: Plugin,
              },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin",
            },
          ],
        });

        // 권한 API 설정
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
          if (parameters.name === "notifications") {
            return Promise.resolve({
              state: Notification.permission,
              name: "notifications" as any,
              onchange: null,
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => false,
            } as PermissionStatus);
          }
          return originalQuery(parameters);
        };

        // 타이밍 정보 숨기기 (connection이 존재하는 경우에만)
        if ("connection" in navigator) {
          Object.defineProperty((navigator as any).connection, "rtt", {
            get: () => 100,
          });
        }

        // Cloudflare 우회를 위한 추가 설정
        // Chrome runtime 정보 조작
        Object.defineProperty(window, "chrome", {
          writable: true,
          enumerable: true,
          configurable: false,
          value: {
            runtime: {},
          },
        });

        // WebGL 정보 조작
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
          if (parameter === 37445) {
            return "Intel Inc.";
          }
          if (parameter === 37446) {
            return "Intel Iris OpenGL Engine";
          }
          return getParameter(parameter);
        };

        // 추가 navigator 속성들 설정
        Object.defineProperty(navigator, "platform", {
          get: () => "MacIntel",
        });

        Object.defineProperty(navigator, "hardwareConcurrency", {
          get: () => 8,
        });
      });

      // JavaScript 활성화 및 이미지 로딩 설정
      await this.page.setJavaScriptEnabled(true);
      await this.page.setCacheEnabled(false);

      // 추가 헤더 설정 (실제 브라우저처럼)
      await this.page.setExtraHTTPHeaders({
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "sec-ch-ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        DNT: "1",
      });

      // 마우스 및 키보드 동작으로 인간적인 행동 시뮬레이션
      await this.page.evaluateOnNewDocument(() => {
        // 마우스 이동 이벤트 시뮬레이션
        let mouseX = Math.random() * 1000;
        let mouseY = Math.random() * 800;

        const simulateMouseMovement = () => {
          mouseX += (Math.random() - 0.5) * 50;
          mouseY += (Math.random() - 0.5) * 50;

          const event = new MouseEvent("mousemove", {
            clientX: mouseX,
            clientY: mouseY,
            bubbles: true,
          });
          document.dispatchEvent(event);
        };

        // 주기적으로 마우스 이동 시뮬레이션
        setInterval(simulateMouseMovement, 2000 + Math.random() * 3000);

        // 스크롤 이벤트 시뮬레이션
        const simulateScrolling = () => {
          window.scrollBy(0, Math.random() * 20 - 10);
        };

        setInterval(simulateScrolling, 8000 + Math.random() * 5000);
      });

      console.log(`✅ [2] 브라우저 초기화 완료`);
    } catch (error) {
      console.log(`❌ [2] 브라우저 초기화 실패: ${(error as Error).message}`);
      throw error;
    }
  }

  // 브라우저 종료
  async closeBrowser(): Promise<void> {
    try {
      if (this.page) {
        // 리스너 정리
        this.page.removeAllListeners("framenavigated");
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      // 상태 초기화
      this.isLoggedIn = false;
      this.isRequestInterceptionEnabled = false;
      scrapingLogger.info("트위터 브라우저 종료 완료");
    } catch (error) {
      scrapingLogger.error("브라우저 종료 실패", error as Error);
    }
  }

  // 지연 함수
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 로그인 상태 확인 및 처리
  private async handleLoginRequirement(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // 로그인 요구 시그널들 확인
      const loginIndicators = [
        '[data-testid="loginButton"]',
        '[data-testid="signup"]',
        'text="Log in"',
        'text="Sign up"',
        ".login-form",
        ".auth-form",
      ];

      for (const selector of loginIndicators) {
        try {
          const element = await this.page.waitForSelector(selector, {
            timeout: 2000,
          });
          if (element) {
            scrapingLogger.warn("로그인 요구 페이지 감지됨");
            return true;
          }
        } catch {
          // 요소가 없으면 계속 진행
        }
      }

      // URL 패턴으로도 확인
      const currentUrl = this.page.url();
      if (
        currentUrl.includes("login") ||
        currentUrl.includes("signin") ||
        currentUrl.includes("auth")
      ) {
        scrapingLogger.warn("로그인 URL 패턴 감지됨");
        return true;
      }

      return false;
    } catch (error) {
      scrapingLogger.error("로그인 상태 확인 중 오류:", error);
      return false;
    }
  }

  // 익명 모드로 트위터 접근 시도
  private async tryAnonymousAccess(url: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log(`🌐 [3-2-1] 기본 접근 시도...`);
      // 1. 기본 접근 시도
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      await this.delay(2000);

      // 2. 로그인 요구되면 다른 방법들 시도
      if (await this.handleLoginRequirement()) {
        console.log(`⚠️ [3-2-1] 기본 접근 실패 - 로그인 요구됨`);
        console.log(`🔄 [3-2-2] 모바일 버전 시도...`);

        // 방법 2: 모바일 버전 시도
        const mobileUrl = url
          .replace("x.com", "mobile.x.com")
          .replace("twitter.com", "mobile.twitter.com");

        try {
          await this.page.goto(mobileUrl, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          await this.delay(2000);

          if (!(await this.handleLoginRequirement())) {
            console.log(`✅ [3-2-2] 모바일 버전 성공`);
            return true;
          } else {
            console.log(`❌ [3-2-2] 모바일 버전도 로그인 요구`);
          }
        } catch {
          console.log(`❌ [3-2-2] 모바일 버전 접근 실패`);
        }

        console.log(`🤖 [3-2-3] 봇 User Agent 시도...`);
        // 방법 3: 사용자 에이전트를 검색 봇으로 변경
        await this.page.setUserAgent(
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        );

        try {
          await this.page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          await this.delay(2000);

          if (!(await this.handleLoginRequirement())) {
            console.log(`✅ [3-2-3] 봇 User Agent 성공`);
            return true;
          } else {
            console.log(`❌ [3-2-3] 봇 User Agent도 로그인 요구`);
          }
        } catch {
          console.log(`❌ [3-2-3] 봇 User Agent 접근 실패`);
        }

        // 사용자 에이전트 복원
        const randomUserAgent =
          USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        await this.page.setUserAgent(randomUserAgent);

        console.log(`❌ [3-2] 모든 접근 방법 실패`);
        return false;
      }

      console.log(`✅ [3-2-1] 기본 접근 성공`);
      return true;
    } catch (error) {
      console.log(`❌ [3-2] 접근 시도 중 오류: ${(error as Error).message}`);
      return false;
    }
  }

  // Analytics 리다이렉트 방지 함수
  private async preventAnalyticsRedirect(): Promise<void> {
    if (!this.page) return;

    try {
      // 페이지에서 analytics 관련 스크립트 차단
      await this.page.evaluateOnNewDocument(() => {
        // analytics 도메인들을 차단
        const blockedDomains = [
          "analytics.twitter.com",
          "analytics.x.com",
          "ads-twitter.com",
          "ads.x.com",
        ];

        // fetch 가로채기
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
          const url = args[0] instanceof Request ? args[0].url : args[0];
          if (typeof url === "string") {
            for (const domain of blockedDomains) {
              if (url.includes(domain)) {
                console.log("Blocked analytics request:", url);
                return Promise.reject(new Error("Blocked analytics request"));
              }
            }
          }
          return originalFetch.apply(this, args);
        };

        // XMLHttpRequest 가로채기
        const originalXHR = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (
          method: string,
          url: string | URL,
          async?: boolean,
          username?: string | null,
          password?: string | null
        ) {
          if (typeof url === "string") {
            for (const domain of blockedDomains) {
              if (url.includes(domain)) {
                console.log("Blocked analytics XHR:", url);
                return;
              }
            }
          }
          return originalXHR.call(
            this,
            method,
            url,
            async || true,
            username,
            password
          );
        };

        // 페이지 이동 감지 및 차단
        let isNavigatingToAnalytics = false;

        const observer = new MutationObserver((mutations) => {
          const currentUrl = window.location.href;
          if (currentUrl.includes("analytics") && !isNavigatingToAnalytics) {
            isNavigatingToAnalytics = true;
            console.log("Analytics navigation detected, preventing...");
            window.history.back();
            setTimeout(() => {
              isNavigatingToAnalytics = false;
            }, 1000);
          }
        });

        observer.observe(document, { childList: true, subtree: true });
      });

      // 네트워크 레벨에서 analytics 요청 차단 (한 번만 설정)
      if (!this.isRequestInterceptionEnabled) {
        await this.page.setRequestInterception(true);
        this.isRequestInterceptionEnabled = true;

        this.page.on("request", (request) => {
          const url = request.url();
          const blockedPatterns = [
            "analytics.twitter.com",
            "analytics.x.com",
            "ads-twitter.com",
            "ads.x.com",
            "/analytics/",
            "analytics",
          ];

          if (blockedPatterns.some((pattern) => url.includes(pattern))) {
            scrapingLogger.debug(`Analytics 요청 차단: ${url}`);
            try {
              if (!request.isInterceptResolutionHandled()) {
                request.abort();
              }
            } catch (error) {
              scrapingLogger.debug(`이미 처리된 요청: ${url}`);
            }
          } else {
            try {
              if (!request.isInterceptResolutionHandled()) {
                request.continue();
              }
            } catch (error) {
              scrapingLogger.debug(`이미 처리된 요청: ${url}`);
            }
          }
        });
      }
    } catch (error) {
      scrapingLogger.error("Analytics 차단 설정 중 오류:", error);
    }
  }

  // 트위터 URL에서 게시물 ID 추출
  private extractTweetId(url: string): string | null {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // 날짜 파싱 함수
  private parseTwitterDate(dateText: string): Date {
    // 트위터 날짜 형식 처리
    try {
      scrapingLogger.debug(`날짜 파싱 시도: "${dateText}"`);

      // 전처리: 공백 정리 및 소문자 변환
      const cleanText = dateText.trim().replace(/\s+/g, " ");

      // 1. 상대 시간 처리 (한국어)
      if (cleanText.includes("초")) {
        const match = cleanText.match(/(\d+)\s*초/);
        if (match) {
          const seconds = parseInt(match[1]);
          const result = new Date(Date.now() - seconds * 1000);
          scrapingLogger.debug(
            `상대 시간 파싱 (초): ${seconds}초 전 -> ${result.toISOString()}`
          );
          return result;
        }
      }
      if (cleanText.includes("분")) {
        const match = cleanText.match(/(\d+)\s*분/);
        if (match) {
          const minutes = parseInt(match[1]);
          const result = new Date(Date.now() - minutes * 60 * 1000);
          scrapingLogger.debug(
            `상대 시간 파싱 (분): ${minutes}분 전 -> ${result.toISOString()}`
          );
          return result;
        }
      }
      if (cleanText.includes("시간")) {
        const match = cleanText.match(/(\d+)\s*시간/);
        if (match) {
          const hours = parseInt(match[1]);
          const result = new Date(Date.now() - hours * 60 * 60 * 1000);
          scrapingLogger.debug(
            `상대 시간 파싱 (시간): ${hours}시간 전 -> ${result.toISOString()}`
          );
          return result;
        }
      }
      if (cleanText.includes("일")) {
        const match = cleanText.match(/(\d+)\s*일/);
        if (match) {
          const days = parseInt(match[1]);
          const result = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          scrapingLogger.debug(
            `상대 시간 파싱 (일): ${days}일 전 -> ${result.toISOString()}`
          );
          return result;
        }
      }

      // 2. 상대 시간 처리 (영어)
      // "now", "just now" 처리
      if (cleanText.toLowerCase().includes("now")) {
        const result = new Date();
        scrapingLogger.debug(
          `현재 시간 파싱: ${cleanText} -> ${result.toISOString()}`
        );
        return result;
      }

      // seconds (1s, 30s)
      if (cleanText.match(/^\d+s$/)) {
        const seconds = parseInt(cleanText.replace("s", ""));
        const result = new Date(Date.now() - seconds * 1000);
        scrapingLogger.debug(
          `상대 시간 파싱 (seconds): ${seconds}s 전 -> ${result.toISOString()}`
        );
        return result;
      }

      // minutes (1m, 30m)
      if (cleanText.match(/^\d+m$/)) {
        const minutes = parseInt(cleanText.replace("m", ""));
        const result = new Date(Date.now() - minutes * 60 * 1000);
        scrapingLogger.debug(
          `상대 시간 파싱 (minutes): ${minutes}m 전 -> ${result.toISOString()}`
        );
        return result;
      }

      // hours (1h, 12h)
      if (cleanText.match(/^\d+h$/)) {
        const hours = parseInt(cleanText.replace("h", ""));
        const result = new Date(Date.now() - hours * 60 * 60 * 1000);
        scrapingLogger.debug(
          `상대 시간 파싱 (hours): ${hours}h 전 -> ${result.toISOString()}`
        );
        return result;
      }

      // days (1d, 5d)
      if (cleanText.match(/^\d+d$/)) {
        const days = parseInt(cleanText.replace("d", ""));
        const result = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        scrapingLogger.debug(
          `상대 시간 파싱 (days): ${days}d 전 -> ${result.toISOString()}`
        );
        return result;
      }

      // 3. 절대 시간 처리 (한국어) - "오후 2:30 · 2024년 1월 10일"
      const koreanDateMatch = cleanText.match(
        /(오전|오후)\s*(\d{1,2}):(\d{2})\s*·\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/
      );
      if (koreanDateMatch) {
        const [, ampm, hour, minute, year, month, day] = koreanDateMatch;
        let hour24 = parseInt(hour);
        if (ampm === "오후" && hour24 !== 12) hour24 += 12;
        if (ampm === "오전" && hour24 === 12) hour24 = 0;

        const result = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hour24,
          parseInt(minute)
        );
        scrapingLogger.debug(
          `한국어 절대 시간 파싱: ${cleanText} -> ${result.toISOString()}`
        );
        return result;
      }

      // 4. 절대 시간 처리 (영어) - "2:30 PM · Jan 10, 2024"
      const englishDateMatch = cleanText.match(
        /(\d{1,2}):(\d{2})\s*(AM|PM)\s*·\s*([A-Za-z]{3})\s*(\d{1,2}),?\s*(\d{4})/
      );
      if (englishDateMatch) {
        const [, hour, minute, ampm, monthAbbr, day, year] = englishDateMatch;
        let hour24 = parseInt(hour);
        if (ampm === "PM" && hour24 !== 12) hour24 += 12;
        if (ampm === "AM" && hour24 === 12) hour24 = 0;

        const monthMap: { [key: string]: number } = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        };
        const monthNum = monthMap[monthAbbr];

        if (monthNum !== undefined) {
          const result = new Date(
            parseInt(year),
            monthNum,
            parseInt(day),
            hour24,
            parseInt(minute)
          );
          scrapingLogger.debug(
            `영어 절대 시간 파싱: ${cleanText} -> ${result.toISOString()}`
          );
          return result;
        }
      }

      // 5. 단순 날짜 형식들 - "Jan 10", "1월 10일"
      const monthDayMatch = cleanText.match(/([A-Za-z]{3})\s*(\d{1,2})/);
      if (monthDayMatch) {
        const [, monthAbbr, day] = monthDayMatch;
        const monthMap: { [key: string]: number } = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        };
        const monthNum = monthMap[monthAbbr];

        if (monthNum !== undefined) {
          const currentYear = new Date().getFullYear();
          const result = new Date(currentYear, monthNum, parseInt(day));
          scrapingLogger.debug(
            `월-일 파싱: ${cleanText} -> ${result.toISOString()}`
          );
          return result;
        }
      }

      // 6. 기타 절대 시간 형식들
      // ISO 8601 형식 처리
      if (cleanText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        const result = new Date(cleanText);
        if (!isNaN(result.getTime())) {
          scrapingLogger.debug(
            `ISO 8601 파싱: ${cleanText} -> ${result.toISOString()}`
          );
          return result;
        }
      }

      // 7. 일반적인 Date 생성자로 파싱 시도
      const parsedDate = new Date(cleanText);
      if (
        !isNaN(parsedDate.getTime()) &&
        parsedDate.getFullYear() > 2000 &&
        parsedDate.getFullYear() < 3000
      ) {
        scrapingLogger.debug(
          `일반 Date 파싱: ${cleanText} -> ${parsedDate.toISOString()}`
        );
        return parsedDate;
      }

      // 8. 모든 파싱 실패 시 경고와 함께 현재 시간 반환
      scrapingLogger.warn(`날짜 파싱 실패, 현재 시간 사용: "${cleanText}"`);
      return new Date();
    } catch (error) {
      scrapingLogger.error(`날짜 파싱 중 오류: ${dateText}`, error as Error);
      return new Date();
    }
  }

  // 숫자 파싱 함수 (1.2K -> 1200)
  private parseMetricNumber(text: string): number {
    if (!text) return 0;

    const cleanText = text.replace(/[,\s]/g, "");
    const match = cleanText.match(/(\d+(?:\.\d+)?)(K|M|만|천)?/i);

    if (!match) return 0;

    const number = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase();

    switch (unit) {
      case "K":
      case "천":
        return Math.round(number * 1000);
      case "M":
        return Math.round(number * 1000000);
      case "만":
        return Math.round(number * 10000);
      default:
        return Math.round(number);
    }
  }

  // 개별 트위터 게시물 스크래핑
  async scrapeTweetDetails(tweetUrl: string): Promise<TwitterPostData | null> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    // 이벤트 리스너 변수를 먼저 선언
    let handleFrameNavigation: any = null;

    try {
      console.log(`🔧 [3-1] Analytics 차단 설정...`);

      // Analytics 리다이렉트 방지 설정
      await this.preventAnalyticsRedirect();

      // 기존 이벤트 리스너 정리
      this.page.removeAllListeners("framenavigated");

      // Analytics 페이지 리다이렉트 방지 플래그
      let isRedirecting = false;
      let redirectCount = 0;
      const maxRedirects = 3;

      // analytics 페이지 이동 방지를 위한 이벤트 리스너
      handleFrameNavigation = async (frame: any) => {
        if (frame === this.page!.mainFrame() && !isRedirecting) {
          const currentUrl = frame.url();

          // Analytics 페이지나 잘못된 페이지로 이동한 경우
          if (
            (currentUrl.includes("/analytics") ||
              currentUrl.includes("analytics.twitter.com")) &&
            !currentUrl.includes(
              tweetUrl
                .replace("https://x.com/", "")
                .replace("https://twitter.com/", "")
            )
          ) {
            if (redirectCount < maxRedirects) {
              console.log(
                `⚠️ [리다이렉트] Analytics 페이지 감지, 복귀 시도...`
              );

              isRedirecting = true;
              redirectCount++;

              try {
                // 잠시 대기 후 원래 URL로 이동
                await this.delay(1000);
                await this.page!.goto(tweetUrl, {
                  waitUntil: "domcontentloaded",
                  timeout: 15000,
                });
                await this.delay(2000);
              } catch (error) {
                console.log(`❌ [리다이렉트] 복귀 실패`);
              } finally {
                isRedirecting = false;
              }
            } else {
              console.log(`❌ [리다이렉트] 최대 리다이렉트 초과`);
              return null;
            }
          }
        }
      };

      // 이벤트 리스너 등록
      this.page.on("framenavigated", handleFrameNavigation);

      console.log(`🌐 [3-2] 페이지 접근 시도...`);

      // 로그인 상태 확인 및 로그인
      if (!this.isLoggedIn) {
        console.log(`🔐 [3-2] 로그인 필요, 로그인 시도...`);
        const loginSuccess = await this.loginToTwitter();
        if (!loginSuccess) {
          console.log(`❌ [3-2] 로그인 실패`);
          return null;
        }
      } else {
        // 이미 로그인되어 있다면 상태 재확인
        const isStillLoggedIn = await this.checkLoginStatus();
        if (!isStillLoggedIn) {
          console.log(`🔐 [3-2] 로그인 상태 만료, 재로그인 시도...`);
          const loginSuccess = await this.loginToTwitter();
          if (!loginSuccess) {
            console.log(`❌ [3-2] 재로그인 실패`);
            return null;
          }
        }
      }

      console.log(`✅ [3-2] 로그인 상태 확인됨`);

      console.log(`🌐 [3-3] 트윗 페이지로 이동...`);
      // 트윗 페이지로 직접 이동
      await this.page.goto(tweetUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await this.delay(2000);

      console.log(`✅ [3-3] 트윗 페이지 접근 성공`);

      // 현재 URL 최종 확인
      const finalUrl = this.page.url();
      if (
        finalUrl.includes("/analytics") ||
        finalUrl.includes("analytics.twitter.com")
      ) {
        console.log(`❌ [3-4] Analytics 페이지에 갇힘`);
        return null;
      }

      console.log(`🔍 [3-4] 트윗 요소 검색 중...`);
      // 로그인 요구 시 처리
      try {
        await this.page.waitForSelector('[data-testid="tweet"]', {
          timeout: 8000,
        });
        console.log(`✅ [3-4] 트윗 요소 발견`);
      } catch {
        // 트윗이 로드되지 않는 경우 다른 셀렉터들도 시도
        try {
          await this.page.waitForSelector('article[data-testid="tweet"]', {
            timeout: 3000,
          });
          console.log(`✅ [3-4] 트윗 요소 발견 (대체 셀렉터)`);
        } catch {
          console.log(`❌ [3-4] 트윗 요소 없음 - 페이지 로딩 실패`);
          return null;
        }
      }

      console.log(`📄 [3-5] 페이지 파싱 중...`);
      const content = await this.page.content();
      const $ = cheerio.load(content);

      // 트위터 게시물 ID 추출
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        scrapingLogger.error("트위터 게시물 ID 추출 실패");
        return null;
      }

      // 게시물 텍스트와 링크 추출
      let tweetText = "";
      let links: { shortUrl: string; fullUrl: string }[] = [];

      const textSelectors = [
        '[data-testid="tweetText"]',
        '[data-testid="tweet"] div[lang]',
        'div[data-testid="tweet"] span',
        ".tweet-text",
        ".TweetTextSize",
      ];

      for (const selector of textSelectors) {
        const textElement = $(selector).first();
        if (textElement.length > 0) {
          // 링크 정보 추출
          textElement.find("a[href]").each((i, linkEl) => {
            const $link = $(linkEl);
            const href = $link.attr("href");
            const linkText = $link.text().trim();

            if (href && linkText) {
              // t.co 링크나 단축 링크를 전체 URL로 변환
              let fullUrl = href;
              if (href.startsWith("/")) {
                fullUrl = `https://x.com${href}`;
              } else if (href.startsWith("http")) {
                fullUrl = href;
              }

              links.push({
                shortUrl: linkText,
                fullUrl: fullUrl,
              });
            }
          });

          // 텍스트 추출 (HTML 태그 제거하지만 링크는 유지)
          tweetText = textElement.text().trim();
          if (tweetText) break;
        }
      }

      // 미디어 정보 추출
      const mediaItems: string[] = [];

      // 이미지 추출
      const imageSelectors = [
        '[data-testid="tweetPhoto"] img',
        '[data-testid="tweet"] img[src*="pbs.twimg.com"]',
        '[data-testid="tweet"] img[src*="media.x.com"]',
        ".media-photo img",
        ".tweet-media img",
      ];

      for (const selector of imageSelectors) {
        $(selector).each((i, imgEl) => {
          const $img = $(imgEl);
          const src = $img.attr("src");
          const alt = $img.attr("alt") || "";

          if (
            src &&
            !src.includes("profile_images") &&
            !src.includes("emoji")
          ) {
            // 고화질 이미지 URL로 변환
            let highQualityUrl = src;
            if (src.includes("&name=")) {
              highQualityUrl = src.replace(/&name=\w+/, "&name=large");
            } else if (src.includes("?format=")) {
              highQualityUrl = src.replace(
                /\?format=\w+&name=\w+/,
                "?format=jpg&name=large"
              );
            }

            mediaItems.push(highQualityUrl);
          }
        });

        if (mediaItems.length > 0) break; // 이미지를 찾았으면 다른 셀렉터는 건너뜀
      }

      // 비디오 감지 및 임베드 정보 추출
      let hasVideo = false;
      let videoEmbedInfo = null;

      const videoSelectors = [
        '[data-testid="videoPlayer"]',
        '[data-testid="tweet"] video',
        ".media-video",
        ".tweet-video",
      ];

      for (const selector of videoSelectors) {
        $(selector).each((i, videoEl) => {
          const $video = $(videoEl);
          let videoUrl = "";
          let thumbnailUrl = "";

          // video 태그에서 직접 추출
          const tagName = (videoEl as any).tagName || (videoEl as any).name;
          if (tagName === "video") {
            videoUrl = $video.attr("src") || "";
            thumbnailUrl = $video.attr("poster") || "";
            hasVideo = true;
          } else {
            // 비디오 컨테이너에서 추출
            const videoTag = $video.find("video").first();
            videoUrl = videoTag.attr("src") || "";
            thumbnailUrl = videoTag.attr("poster") || "";

            if (videoTag.length > 0) {
              hasVideo = true;
            }

            // 썸네일이 없으면 이미지 태그에서 찾기
            if (!thumbnailUrl) {
              const imgTag = $video.find("img").first();
              thumbnailUrl = imgTag.attr("src") || "";
            }
          }

          if (videoUrl || thumbnailUrl) {
            mediaItems.push(videoUrl || thumbnailUrl);
          }
        });

        if (mediaItems.some((item) => item.includes("video")) || hasVideo)
          break;
      }

      // 비디오 임베드 정보는 나중에 작성자 정보 추출 후 생성

      // GIF 추출 (트위터에서 GIF는 보통 video 태그로 처리됨)
      const gifSelectors = ['[data-testid="tweet"] video[loop]', ".gif-video"];

      for (const selector of gifSelectors) {
        $(selector).each((i, gifEl) => {
          const $gif = $(gifEl);
          const gifUrl = $gif.attr("src") || "";
          const thumbnailUrl = $gif.attr("poster") || "";

          if (gifUrl) {
            mediaItems.push(gifUrl);
          }
        });
      }

      // 외부 링크 정보 추출
      const externalLinks: TwitterPostData["externalLinks"] = [];

      const linkCardSelectors = [
        '[data-testid="card.layoutLarge.media"]',
        '[data-testid="card.layoutSmall.media"]',
        ".twitter-card",
        ".link-preview",
      ];

      for (const selector of linkCardSelectors) {
        $(selector).each((i, cardEl) => {
          const $card = $(cardEl);

          // 링크 URL 추출
          const linkEl = $card.find("a[href]").first();
          const linkUrl = linkEl.attr("href") || "";

          // 제목 추출
          const titleSelectors = [
            '[data-testid="card.layoutLarge.detail"] > div:first-child',
            '[data-testid="card.layoutSmall.detail"] > div:first-child',
            ".twitter-card-title",
            ".link-title",
          ];

          let title = "";
          for (const titleSelector of titleSelectors) {
            title = $card.find(titleSelector).text().trim();
            if (title) break;
          }

          // 설명 추출
          const descSelectors = [
            '[data-testid="card.layoutLarge.detail"] > div:nth-child(2)',
            '[data-testid="card.layoutSmall.detail"] > div:nth-child(2)',
            ".twitter-card-description",
            ".link-description",
          ];

          let description = "";
          for (const descSelector of descSelectors) {
            description = $card.find(descSelector).text().trim();
            if (description) break;
          }

          // 썸네일 추출
          const thumbnailSelectors = [
            '[data-testid="card.layoutLarge.media"] img',
            '[data-testid="card.layoutSmall.media"] img',
            ".twitter-card img",
            ".link-thumbnail img",
          ];

          let thumbnailUrl = "";
          for (const thumbSelector of thumbnailSelectors) {
            thumbnailUrl = $card.find(thumbSelector).attr("src") || "";
            if (thumbnailUrl) break;
          }

          if (linkUrl && title) {
            externalLinks.push({
              url: linkUrl,
              title: title || undefined,
              description: description || undefined,
              thumbnailUrl: thumbnailUrl || undefined,
            });
          }
        });
      }

      // 텍스트에서 단축된 링크를 전체 URL로 치환
      if (links.length > 0) {
        for (const link of links) {
          // 단축된 링크 패턴을 전체 URL로 치환
          if (link.shortUrl.includes("...") || link.shortUrl.includes("…")) {
            // … 기호 제거한 링크로 치환
            const cleanFullUrl = link.fullUrl
              .replace(/…$/, "")
              .replace(/\.\.\.$/, "");
            tweetText = tweetText.replace(link.shortUrl, cleanFullUrl);
          }
        }
      }

      // 추가적으로 t.co 링크들을 실제 페이지에서 추출
      try {
        const expandedLinks = await this.extractExpandedLinks($);
        for (const expandedLink of expandedLinks) {
          // 텍스트에서 t.co 링크를 실제 URL로 치환
          const cleanFullUrl = expandedLink.fullUrl
            .replace(/…$/, "")
            .replace(/\.\.\.$/, "");
          tweetText = tweetText.replace(expandedLink.shortUrl, cleanFullUrl);
        }
      } catch (error) {
        scrapingLogger.warn("확장된 링크 추출 실패:", error);
      }

      // 최종적으로 남은 … 기호들 정리
      tweetText = tweetText.replace(/https?:\/\/[^\s]+…/g, (match) => {
        return match.replace(/…$/, "");
      });

      // 작성자 정보 추출
      let authorName = "";
      let authorUsername = "";
      let profileImageUrl = "";

      const authorNameSelectors = [
        '[data-testid="User-Name"] span',
        ".ProfileHeaderCard-nameLink",
        ".ProfileNameTruncated-link",
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
        ".ProfileHeaderCard-screenname",
        ".username",
      ];

      for (const selector of usernameSelectors) {
        const usernameElement = $(selector).first();
        if (usernameElement.length > 0) {
          const href = usernameElement.attr("href");
          if (href) {
            authorUsername = href.replace("/", "").replace("@", "");
            if (authorUsername) break;
          }
        }
      }

      // 프로필 이미지 추출
      const profileImageSelectors = [
        '[data-testid="Tweet-User-Avatar"] img',
        ".ProfileAvatar-image",
        ".avatar img",
      ];

      for (const selector of profileImageSelectors) {
        const imgElement = $(selector).first();
        if (imgElement.length > 0) {
          profileImageUrl = imgElement.attr("src") || "";
          if (profileImageUrl) break;
        }
      }

      // 비디오가 있는 경우 임베드 정보 생성 (작성자 정보 추출 후)
      if (hasVideo && tweetId && authorUsername) {
        videoEmbedInfo = {
          tweetId: tweetId,
          username: authorUsername,
          embedUrl: tweetUrl,
        };
        scrapingLogger.info(`비디오 감지됨 - 임베드 정보 생성: ${tweetId}`);
      }

      // 게시물 날짜 추출
      let createdAt = new Date();
      const dateSelectors = [
        "time[datetime]", // 가장 정확한 datetime 속성
        '[data-testid="Tweet-User-Name"] time',
        '[data-testid="tweet"] time',
        "article time",
        '[data-testid="User-Name"] time', // 최신 트위터 구조
        '[data-testid="Tweet-User-Names"] time',
        '[role="link"] time',
        "a time", // 링크 안의 time 태그
        ".tweet-timestamp",
        ".ProfileTweet-timestamp",
        '[data-testid="tweet"] [role="link"]', // 날짜 링크
        "time",
      ];

      let dateFound = false;
      scrapingLogger.debug(
        `날짜 추출 시도 - 총 ${dateSelectors.length}개 셀렉터 확인`
      );

      for (let i = 0; i < dateSelectors.length; i++) {
        const selector = dateSelectors[i];
        const dateElements = $(selector);

        scrapingLogger.debug(
          `셀렉터 ${i + 1}/${dateSelectors.length}: "${selector}" - ${
            dateElements.length
          }개 요소 발견`
        );

        dateElements.each((index, element) => {
          if (dateFound) return false; // 이미 찾았으면 중단

          const $el = $(element);

          // 1. datetime 속성 우선 확인 (가장 정확함)
          const datetimeAttr = $el.attr("datetime");
          if (datetimeAttr) {
            try {
              const parsedDate = new Date(datetimeAttr);
              if (!isNaN(parsedDate.getTime())) {
                createdAt = parsedDate;
                scrapingLogger.info(
                  `✅ datetime 속성에서 날짜 추출 성공: ${datetimeAttr} -> ${createdAt.toISOString()}`
                );
                dateFound = true;
                return false; // each 루프 중단
              }
            } catch (error) {
              scrapingLogger.warn(`datetime 속성 파싱 실패: ${datetimeAttr}`);
            }
          }

          // 2. title 속성 확인
          const titleAttr = $el.attr("title");
          if (titleAttr && !dateFound) {
            try {
              const parsedDate = new Date(titleAttr);
              if (
                !isNaN(parsedDate.getTime()) &&
                parsedDate.getFullYear() > 2000
              ) {
                createdAt = parsedDate;
                scrapingLogger.info(
                  `✅ title 속성에서 날짜 추출 성공: ${titleAttr} -> ${createdAt.toISOString()}`
                );
                dateFound = true;
                return false; // each 루프 중단
              }
            } catch (error) {
              scrapingLogger.debug(`title 속성이 날짜가 아님: ${titleAttr}`);
            }
          }

          // 3. aria-label 속성 확인 (트위터에서 종종 사용)
          const ariaLabel = $el.attr("aria-label");
          if (ariaLabel && !dateFound) {
            try {
              const parsedDate = new Date(ariaLabel);
              if (
                !isNaN(parsedDate.getTime()) &&
                parsedDate.getFullYear() > 2000
              ) {
                createdAt = parsedDate;
                scrapingLogger.info(
                  `✅ aria-label에서 날짜 추출 성공: ${ariaLabel} -> ${createdAt.toISOString()}`
                );
                dateFound = true;
                return false; // each 루프 중단
              }
            } catch (error) {
              scrapingLogger.debug(`aria-label이 날짜가 아님: ${ariaLabel}`);
            }
          }

          // 4. 텍스트 내용 확인 (마지막 수단)
          const dateText = $el.text().trim();
          if (dateText && !dateFound) {
            const parsedDate = this.parseTwitterDate(dateText);
            // parseTwitterDate가 현재 시간을 반환하지 않았다면 (즉, 실제로 파싱이 성공했다면)
            if (Math.abs(parsedDate.getTime() - Date.now()) > 5000) {
              // 5초 이상 차이나면 실제 파싱 성공
              createdAt = parsedDate;
              scrapingLogger.info(
                `✅ 텍스트에서 날짜 추출 성공: "${dateText}" -> ${createdAt.toISOString()}`
              );
              dateFound = true;
              return false; // each 루프 중단
            } else {
              scrapingLogger.debug(
                `텍스트 파싱 실패 또는 현재 시간 반환: "${dateText}"`
              );
            }
          }
        });

        if (dateFound) break; // 외부 for 루프도 중단
      }

      // 날짜를 찾지 못한 경우 경고 및 추가 디버깅 정보
      if (!dateFound) {
        scrapingLogger.warn(
          `❌ 게시물 날짜를 찾을 수 없어 현재 시간을 사용합니다.`
        );
        scrapingLogger.warn(`URL: ${tweetUrl}`);

        // 디버깅을 위해 페이지의 모든 time 태그 출력
        const allTimeTags = $("time");
        scrapingLogger.debug(
          `페이지에서 발견된 모든 time 태그 (${allTimeTags.length}개):`
        );
        allTimeTags.each((i, el) => {
          const $timeEl = $(el);
          const datetime = $timeEl.attr("datetime");
          const title = $timeEl.attr("title");
          const text = $timeEl.text().trim();
          scrapingLogger.debug(
            `  Time ${
              i + 1
            }: datetime="${datetime}", title="${title}", text="${text}"`
          );
        });
      } else {
        scrapingLogger.info(`✅ 최종 게시물 날짜: ${createdAt.toISOString()}`);
      }

      // 기본 데이터 구성
      const tweetData: TwitterPostData = {
        id: tweetId,
        text: tweetText,
        author: {
          name: authorName,
          username: authorUsername,
          profileImageUrl: profileImageUrl,
        },
        createdAt: createdAt,
        url: tweetUrl,
        // 미디어 정보 추가
        media: mediaItems.length > 0 ? mediaItems : undefined,
        // 비디오 임베드 정보 추가
        hasVideo: hasVideo,
        videoEmbedInfo: videoEmbedInfo || undefined,
        externalLinks: externalLinks.length > 0 ? externalLinks : undefined,
      };

      // 최근 1주일 이내 트윗인지 확인
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      if (createdAt < oneWeekAgo) {
        scrapingLogger.info(
          `1주일 이전 게시물이므로 저장하지 않습니다. 게시일: ${createdAt.toISOString()}`
        );
        return null;
      }

      // 카테고리 태깅
      let category = 5;
      try {
        category = await detectTweetCategory(tweetText);
        scrapingLogger.info(`카테고리 태깅 결과: ${category}`);
      } catch (e) {
        scrapingLogger.warn("카테고리 태깅 실패, 기본값 5로 저장");
      }
      tweetData.category = category;

      // 번역 진행
      if (canTranslate() && tweetText) {
        try {
          scrapingLogger.info("번역 시도 중...");
          const translatedText = await translateTweetToKorean(
            tweetText,
            mediaItems,
            externalLinks
          );

          if (translatedText) {
            tweetData.textKo = translatedText;
            tweetData.isTranslated = true;
            tweetData.translationModel = "gpt-4.1";
            tweetData.translatedAt = new Date();
            scrapingLogger.info("번역 완료");
          } else {
            tweetData.isTranslated = false;
            scrapingLogger.info("번역 불필요 또는 실패");
          }
        } catch (error) {
          scrapingLogger.error("번역 중 오류 발생:", error as Error);
          tweetData.isTranslated = false;
        }
      } else {
        tweetData.isTranslated = false;
        if (!canTranslate()) {
          scrapingLogger.warn(
            "OpenAI API 키가 설정되지 않아 번역을 건너뜁니다."
          );
        }
      }

      // 데이터 검증
      if (!tweetText || !authorName) {
        scrapingLogger.error("필수 데이터 추출 실패");
        return null;
      }

      scrapingLogger.info("AI 관련 트위터 게시물 스크래핑 완료");
      return tweetData;
    } catch (error) {
      scrapingLogger.error("트위터 게시물 스크래핑 실패:", error as Error);
      return null;
    } finally {
      // 이벤트 리스너 정리
      if (handleFrameNavigation) {
        this.page.removeListener("framenavigated", handleFrameNavigation);
      }
    }
  }

  // 확장된 링크 추출 메서드
  private async extractExpandedLinks(
    $: any
  ): Promise<{ shortUrl: string; fullUrl: string }[]> {
    const expandedLinks: { shortUrl: string; fullUrl: string }[] = [];

    try {
      // 트위터에서 t.co 링크의 실제 URL을 찾는 방법들
      const linkSelectors = [
        '[data-testid="tweetText"] a[href*="t.co"]',
        '[data-testid="tweetText"] a[title]',
        'a[data-focusable="true"][href*="t.co"]',
      ];

      for (const selector of linkSelectors) {
        $(selector).each((_i: number, linkEl: any) => {
          const $link = $(linkEl);
          const href = $link.attr("href");
          const title = $link.attr("title");
          const linkText = $link.text().trim();

          // title 속성에 실제 URL이 있는 경우가 많음
          if (href && title && title.startsWith("http")) {
            expandedLinks.push({
              shortUrl: linkText,
              fullUrl: title,
            });
          }
          // aria-label에도 실제 URL이 있을 수 있음
          else if (href) {
            const ariaLabel = $link.attr("aria-label");
            if (ariaLabel && ariaLabel.includes("http")) {
              const urlMatch = ariaLabel.match(/https?:\/\/[^\s]+/);
              if (urlMatch) {
                expandedLinks.push({
                  shortUrl: linkText,
                  fullUrl: urlMatch[0],
                });
              }
            }
          }
        });
      }

      return expandedLinks;
    } catch (error) {
      scrapingLogger.warn("확장된 링크 추출 중 오류:", error);
      return [];
    }
  }

  // 사용자 타임라인에서 최신 트윗들 스크래핑
  async scrapeUserTimeline(
    username: string,
    maxTweets: number = 10
  ): Promise<TwitterPostData[]> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    try {
      scrapingLogger.info(
        `@${username} 타임라인 스크래핑 시작 (최대 ${maxTweets}개)`
      );

      // 사용자 프로필 페이지로 이동
      const profileUrl = `https://x.com/${username}`;
      await this.page.goto(profileUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
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
            const tweetElements = document.querySelectorAll(
              'article[data-testid="tweet"] a[href*="/status/"]'
            );
            return Array.from(tweetElements)
              .map((el) => (el as HTMLAnchorElement).href)
              .filter((url) => url.includes("/status/"));
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
          scrapingLogger.warn("트윗 URL 수집 중 오류:", error);
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
            scrapingLogger.info(
              `AI 관련 트윗 추가: ${tweetData.text.substring(0, 50)}...`
            );
          }
        } catch (error) {
          scrapingLogger.error(`트윗 스크래핑 실패 (${url}):`, error);
        }

        // 요청 간 지연
        await this.delay(SCRAPING_CONFIG.delayBetweenRequests);
      }

      scrapingLogger.info(
        `@${username} 타임라인 스크래핑 완료: AI 관련 트윗 ${tweets.length}개 수집`
      );
      return tweets;
    } catch (error) {
      scrapingLogger.error(
        `@${username} 타임라인 스크래핑 실패:`,
        error as Error
      );
      return [];
    }
  }

  // 여러 계정의 타임라인 스크래핑 (중복 체크 포함)
  async scrapeMultipleAccounts(
    usernames: string[],
    maxTweetsPerUser: number = 10
  ): Promise<TwitterPostData[]> {
    const allTweets: TwitterPostData[] = [];
    let totalTweetUrls: string[] = [];

    try {
      await this.initBrowser();

      console.log("🔍 모든 계정에서 트윗 URL 수집 중...");

      // 1단계: 모든 계정에서 트윗 URL만 먼저 수집
      for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        scrapingLogger.info(
          `계정 ${i + 1}/${usernames.length}: @${username} URL 수집 중`
        );

        try {
          const tweetUrls = await this.getUserTweetUrls(
            username,
            maxTweetsPerUser
          );
          totalTweetUrls.push(...tweetUrls);

          scrapingLogger.info(
            `@${username}: ${tweetUrls.length}개 트윗 URL 수집`
          );
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
      const allTweetIds = totalTweetUrls
        .map((url) => extractTweetIdFromUrl(url))
        .filter((id) => id !== null) as string[];

      if (allTweetIds.length === 0) {
        console.log("❌ 유효한 트윗 ID를 찾을 수 없습니다");
        return allTweets;
      }

      console.log("🔍 기존 데이터 중복 체크 중...");
      const newTweetIds = await filterNewTweetIds(allTweetIds);

      if (newTweetIds.length === 0) {
        console.log("✅ 새로운 트윗이 없습니다 (모든 트윗이 이미 수집됨)");
        return allTweets;
      }

      // 3단계: 성능 메트릭 계산 및 표시
      const metrics = calculatePerformanceMetrics(
        allTweetIds.length,
        newTweetIds.length
      );
      console.log(`📊 효율성 리포트:`);
      console.log(`   전체 트윗: ${metrics.totalItems}개`);
      console.log(`   새로운 트윗: ${metrics.newItems}개`);
      console.log(`   중복 제외: ${metrics.duplicateItems}개`);
      console.log(`   ⚡ 효율성: ${metrics.efficiencyPercentage}% 작업량 절약`);
      console.log(`   ⏱️ 시간 절약: ${metrics.timeSaved}`);
      console.log(`   💰 비용 절약: ${metrics.costSaved}`);
      scrapingLogger.info(
        `효율성 - 새로운 트윗 ${newTweetIds.length}/${allTweetIds.length}개, ${metrics.efficiencyPercentage}% 절약`
      );

      // 4단계: 새로운 트윗들만 상세 스크래핑
      const newTweetUrls = totalTweetUrls.filter((url) => {
        const tweetId = extractTweetIdFromUrl(url);
        return tweetId && newTweetIds.includes(tweetId);
      });

      console.log(`📊 실제 처리할 트윗: ${newTweetUrls.length}개`);

      for (let i = 0; i < newTweetUrls.length; i++) {
        const url = newTweetUrls[i];
        scrapingLogger.info(
          `트윗 ${i + 1}/${newTweetUrls.length} 스크래핑 중...`
        );

        try {
          const tweetData = await this.scrapeTweetDetails(url);

          if (tweetData) {
            // scrapeTweetDetails에서 이미 AI 관련 게시물만 반환하므로 바로 추가
            allTweets.push(tweetData);
            scrapingLogger.info(
              `AI 관련 트윗 추가: ${tweetData.text.substring(0, 50)}...`
            );
          }
        } catch (error) {
          scrapingLogger.error(`트윗 스크래핑 실패 (${url}):`, error);
        }

        // 요청 간 지연
        await this.delay(SCRAPING_CONFIG.delayBetweenRequests);
      }

      scrapingLogger.info(
        `전체 스크래핑 완료: 총 ${allTweets.length}개의 AI 관련 트윗 수집`
      );
      return allTweets;
    } catch (error) {
      scrapingLogger.error("다중 계정 스크래핑 실패:", error as Error);
      return allTweets;
    } finally {
      await this.closeBrowser();
    }
  }

  // 사용자 타임라인에서 트윗 URL만 수집 (빠른 수집용)
  async getUserTweetUrls(
    username: string,
    maxTweets: number = 10
  ): Promise<string[]> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    try {
      // 사용자 프로필 페이지로 이동
      const profileUrl = `https://x.com/${username}`;
      await this.page.goto(profileUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
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
            const tweetElements = document.querySelectorAll(
              'article[data-testid="tweet"] a[href*="/status/"]'
            );
            return Array.from(tweetElements)
              .map((el) => (el as HTMLAnchorElement).href)
              .filter((url) => url.includes("/status/"));
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
          scrapingLogger.warn("트윗 URL 수집 중 오류:", error);
          retryCount++;
        }
      }

      return tweetUrls;
    } catch (error) {
      scrapingLogger.error(`@${username} 트윗 URL 수집 실패:`, error as Error);
      return [];
    }
  }

  // 에러 분석 및 해결 제안
  private analyzeError(error: any, url: string): string {
    const errorMessage = error?.message || String(error);

    if (errorMessage.includes("net::ERR_NAME_NOT_RESOLVED")) {
      return "네트워크 연결 문제 - DNS 해상도 실패";
    } else if (errorMessage.includes("navigation timeout")) {
      return "페이지 로딩 타임아웃 - 네트워크가 느리거나 사이트 응답 없음";
    } else if (
      errorMessage.includes("login") ||
      errorMessage.includes("auth")
    ) {
      return "로그인 요구됨 - 트위터가 인증 없는 접근을 차단";
    } else if (url.includes("analytics")) {
      return "Analytics 페이지로 리다이렉트됨 - 봇 탐지로 인한 차단";
    } else if (errorMessage.includes("ERR_BLOCKED_BY_CLIENT")) {
      return "클라이언트 차단 - 광고 차단기나 보안 설정 문제";
    } else if (errorMessage.includes("ERR_ABORTED")) {
      return "요청 중단됨 - 네트워크 또는 브라우저 설정 문제";
    } else {
      return `알 수 없는 오류: ${errorMessage}`;
    }
  }

  // 재시도 로직이 포함된 스크래핑
  async scrapeTweetWithRetry(
    tweetUrl: string,
    maxRetries: number = 3
  ): Promise<TwitterPostData | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔧 [2-${attempt}] 브라우저 초기화...`);
        await this.initBrowser();

        console.log(`🌐 [3-${attempt}] 페이지 접근 시도...`);
        const result = await this.scrapeTweetDetails(tweetUrl);

        if (result) {
          console.log(`✅ [3-${attempt}] 성공!`);
          return result;
        } else {
          console.log(`⚠️ [3-${attempt}] 결과 없음`);
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        console.log(`❌ [3-${attempt}] 실패: ${errorMessage}`);

        if (attempt === maxRetries) {
          console.log(`❌ [최종] 최대 시도 횟수 도달`);
        } else {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          console.log(`⏳ [대기] ${delay}ms 후 재시도...`);
          await this.delay(delay);
        }
      } finally {
        await this.closeBrowser();
      }
    }

    return null;
  }

  // 전체 스크래핑 프로세스 (기존 호환성 유지)
  async scrapeTweet(tweetUrl: string): Promise<TwitterPostData | null> {
    return this.scrapeTweetWithRetry(tweetUrl, 3);
  }

  // 트위터 로그인
  async loginToTwitter(): Promise<boolean> {
    if (!this.page) {
      throw new Error("브라우저가 초기화되지 않았습니다");
    }

    if (!ENV.TWITTER_USERNAME || !ENV.TWITTER_PASSWORD) {
      console.log(
        "❌ [로그인] 트위터 계정 정보가 환경변수에 설정되지 않았습니다"
      );
      console.log("TWITTER_USERNAME, TWITTER_PASSWORD를 .env에 추가해주세요");
      return false;
    }

    try {
      console.log("🔐 [로그인-1] 트위터 로그인 페이지로 이동...");
      await this.page.goto("https://x.com/i/flow/login", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await this.delay(3000);

      // 현재 페이지 URL과 제목 확인
      console.log(`🔍 [로그인] 현재 URL: ${this.page.url()}`);
      console.log(`🔍 [로그인] 페이지 제목: ${await this.page.title()}`);

      console.log("🔐 [로그인-2] 사용자명 입력...");

      // 더 유연한 사용자명 입력 필드 찾기
      const usernameSelectors = [
        'input[autocomplete="username"]',
        'input[name="text"]',
        'input[data-testid="ocfEnterTextTextInput"]',
        'input[type="text"]',
        'input[placeholder*="username"]',
        'input[placeholder*="email"]',
        'input[placeholder*="phone"]',
      ];

      let usernameInput = null;
      for (const selector of usernameSelectors) {
        try {
          console.log(`🔍 [로그인] 시도 중인 셀렉터: ${selector}`);
          usernameInput = await this.page.waitForSelector(selector, {
            timeout: 3000,
          });
          if (usernameInput) {
            console.log(`✅ [로그인] 사용자명 입력 필드 발견: ${selector}`);
            break;
          }
        } catch {
          console.log(`❌ [로그인] 셀렉터 실패: ${selector}`);
        }
      }

      if (!usernameInput) {
        console.log("❌ [로그인] 사용자명 입력 필드를 찾을 수 없습니다");

        // 페이지 내용 일부 출력 (디버깅용)
        const bodyText = await this.page.evaluate(() =>
          document.body.innerText.substring(0, 500)
        );
        console.log(`🔍 [로그인] 페이지 내용: ${bodyText}`);

        return false;
      }

      await this.page.type("input", ENV.TWITTER_USERNAME, { delay: 100 });

      console.log("🔐 [로그인-2.5] Next/Continue 버튼 찾기...");

      // Next 버튼 찾기
      const buttonSelectors = [
        '[data-testid="LoginForm_Login_Button"]',
        '[data-testid="ocfEnterTextNextButton"]',
        'button[type="button"]',
        '[role="button"]',
        "button",
      ];

      let nextButton = null;
      for (const selector of buttonSelectors) {
        try {
          console.log(`🔍 [로그인] 버튼 셀렉터 시도: ${selector}`);

          // 버튼 텍스트로 찾기
          const buttons = await this.page.$$(selector);
          for (const button of buttons) {
            const text = await button.evaluate((el) =>
              el.textContent?.trim().toLowerCase()
            );
            console.log(`🔍 [로그인] 버튼 텍스트: "${text}"`);

            // 소셜 로그인 버튼 제외하고 Next/다음 버튼만 찾기
            if (
              text &&
              (text.includes("next") ||
                text.includes("다음") ||
                text.includes("계속")) &&
              !text.includes("apple") &&
              !text.includes("google") &&
              !text.includes("facebook") &&
              !text.includes("로그인하기")
            ) {
              console.log(
                `✅ [로그인] Next 버튼 발견: ${selector} (텍스트: ${text})`
              );
              await button.click();
              nextButton = button;
              break;
            }
          }

          if (nextButton) break;
        } catch {
          console.log(`❌ [로그인] 버튼 셀렉터 실패: ${selector}`);
        }
      }

      if (!nextButton) {
        // 모든 버튼 요소 찾기
        const allButtons = await this.page.evaluate(() => {
          const buttons = Array.from(
            document.querySelectorAll('button, [role="button"]')
          );
          return buttons
            .map((btn) => btn.textContent?.trim())
            .filter((text) => text);
        });
        console.log(`🔍 [로그인] 페이지의 모든 버튼: ${allButtons.join(", ")}`);
        return false;
      }

      await this.delay(2000);

      // 이메일 확인이 필요한 경우 처리
      try {
        const emailInput = await this.page.waitForSelector(
          'input[data-testid="ocfEnterTextTextInput"]',
          { timeout: 5000 }
        );
        if (emailInput && ENV.TWITTER_EMAIL) {
          console.log("🔐 [로그인-2.5] 이메일 인증 요구됨, 이메일 입력...");
          await this.page.type(
            'input[data-testid="ocfEnterTextTextInput"]',
            ENV.TWITTER_EMAIL,
            { delay: 100 }
          );
          await this.page.click('[data-testid="ocfEnterTextNextButton"]');
          await this.delay(2000);
        }
      } catch {
        // 이메일 인증이 없으면 계속 진행
        console.log("🔍 [로그인] 이메일 인증 단계 없음");
      }

      console.log("🔐 [로그인-3] 비밀번호 입력...");
      // 비밀번호 입력
      await this.page.waitForSelector('input[name="password"]', {
        timeout: 10000,
      });
      await this.page.type('input[name="password"]', ENV.TWITTER_PASSWORD, {
        delay: 100,
      });

      // Log in 버튼 클릭
      await this.page.click('[data-testid="LoginForm_Login_Button"]');

      console.log("🔐 [로그인-4] 로그인 완료 대기...");
      // 로그인 완료 대기 (홈페이지로 리다이렉트)
      await this.page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // 로그인 성공 확인
      const currentUrl = this.page.url();
      console.log(`🔍 [로그인] 로그인 후 URL: ${currentUrl}`);

      if (
        currentUrl.includes("home") ||
        (currentUrl.includes("x.com") && !currentUrl.includes("login"))
      ) {
        console.log("✅ [로그인] 트위터 로그인 성공");
        this.isLoggedIn = true;
        return true;
      } else {
        console.log(
          "❌ [로그인] 로그인 실패 - 예상치 못한 페이지:",
          currentUrl
        );
        return false;
      }
    } catch (error) {
      console.log(`❌ [로그인] 로그인 중 오류: ${(error as Error).message}`);
      return false;
    }
  }

  // 로그인 상태 확인
  async checkLoginStatus(): Promise<boolean> {
    if (!this.page) return false;

    try {
      const currentUrl = this.page.url();
      if (currentUrl.includes("login") || currentUrl.includes("signin")) {
        return false;
      }

      // 로그인 상태 확인 요소들
      const loggedInSelectors = [
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[data-testid="AppTabBar_Profile_Link"]',
        '[aria-label="Profile"]',
      ];

      for (const selector of loggedInSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          return true;
        } catch {
          // 계속 다음 셀렉터 시도
        }
      }

      return false;
    } catch {
      return false;
    }
  }
}

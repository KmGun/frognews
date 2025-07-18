import puppeteer, { Browser, Page } from "puppeteer";

export interface TwitterPostData {
  id: string;
  text: string;
  textKo?: string;
  isTranslated?: boolean;
  translationModel?: string;
  translatedAt?: Date;
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
  category?: number;
  media?: string[];
  hasVideo?: boolean;
  videoEmbedInfo?: {
    tweetId: string;
    username: string;
    embedUrl: string;
  };
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

  async scrapeTweet(): Promise<TwitterPostData | null> {
    try {
      // 1. 브라우저 초기화
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

      // 2. https://x.com/ 접속
      await this.page.goto("https://x.com/", { waitUntil: "networkidle2" });

      // 3. 로그인 버튼 클릭
      const loginButton =
        "#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010 > main > div > div > div.css-175oi2r.r-tv6buo > div > div > div.css-175oi2r > div.css-175oi2r.r-2o02ov > a";
      await this.page.click(loginButton);

      ///// 여기부터 해야함.
      // 4. 아이디 입력
      await this.page.waitForSelector("input");
      await this.page.type("input", process.env.TWITTER_USERNAME || "");

      // 5. 다음 버튼 클릭
      const nextButton = await this.page.waitForSelector(
        'button:has-text("다음")'
      );
      await nextButton?.click();

      // 6. 비밀번호 입력
      await this.page.waitForSelector('input[type="password"]');
      await this.page.type(
        'input[type="password"]',
        process.env.TWITTER_PASSWORD || ""
      );

      // 7. 로그인하기 버튼 클릭
      const loginSubmitButton = await this.page.waitForSelector(
        'button:has-text("로그인하기")'
      );
      await loginSubmitButton?.click();

      // 8. 로그인 완료 대기
      await this.page.waitForNavigation({ waitUntil: "networkidle2" });

      return null;
    } catch (error) {
      console.error("스크래핑 오류:", error);
      return null;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

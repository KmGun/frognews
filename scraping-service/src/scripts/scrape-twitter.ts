import { TwitterScraper } from "../scrapers/twitter.scraper";
import { saveTweetToSupabase } from "../utils/save-tweets";
import { scrapingLogger } from "../utils/logger";

async function main() {
  const tweetUrl = process.argv[2];

  if (!tweetUrl) {
    console.error("❌ 트위터 URL을 입력해주세요");
    console.log("사용법: npm run scrape:twitter <트위터_URL>");
    process.exit(1);
  }

  // URL 유효성 검사
  if (!tweetUrl.includes("twitter.com") && !tweetUrl.includes("x.com")) {
    console.error("❌ 유효한 트위터 URL이 아닙니다");
    process.exit(1);
  }

  const scraper = new TwitterScraper();

  try {
    console.log("🚀 [1단계] 스크래핑 시작");
    console.log("📋 URL:", tweetUrl);

    console.log("🔧 [2단계] 브라우저 초기화 중...");

    // 개선된 재시도 로직 사용
    const tweetData = await scraper.scrapeTweetWithRetry(tweetUrl, 1); // 최대 1회만 시도

    if (!tweetData) {
      console.error("❌ [최종] 스크래핑 실패");
      process.exit(1);
    }

    console.log("✅ [4단계] 스크래핑 성공");
    console.log("📊 결과:", {
      id: tweetData.id,
      author: `@${tweetData.author.username}`,
      text: tweetData.text.substring(0, 100) + "...",
      hasTranslation: !!tweetData.textKo,
    });

    console.log("💾 [5단계] 데이터베이스 저장 중...");
    await saveTweetToSupabase(tweetData);

    console.log("✅ [완료] 모든 작업 완료!");
  } catch (error) {
    console.error("❌ [오류]", (error as Error).message);
    process.exit(1);
  } finally {
    console.log("🧹 [정리] 브라우저 종료");
  }
}

// 스크립트 실행
main().catch(console.error);

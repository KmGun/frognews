import { TwitterScraper } from "../scrapers/twitter.scraper";
import { saveTweetToSupabase } from "../utils/save-tweets";

async function main() {
  const scraper = new TwitterScraper();

  try {
    const tweetData = await scraper.scrapeTweet();

    if (!tweetData) {
      console.error("스크래핑 실패");
      process.exit(1);
    }

    // await saveTweetToSupabase(tweetData);
  } catch (error) {
    console.error("오류:", (error as Error).message);
    process.exit(1);
  }
}

main().catch(console.error);

import { scrapeTheVergeNews } from '../scrapers/theverge.scraper';
import { scrapingLogger } from '../utils/logger';
import { ENV } from '../config';

async function main() {
  try {
    scrapingLogger.info('🚀 The Verge 스크래핑 시작');
    
    const result = await scrapeTheVergeNews(ENV.OPENAI_API_KEY);
    
    if (result.success) {
      scrapingLogger.info(`✅ 스크래핑 완료 - 총 ${result.articles.length}개 기사 수집`);
      console.log('수집된 기사들:');
      result.articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.titleSummary}`);
      });
    } else {
      scrapingLogger.error('❌ 스크래핑 실패');
      console.error('에러:', result.errors);
    }
    
  } catch (error) {
    scrapingLogger.error('❌ 스크래핑 중 오류 발생:', error);
    process.exit(1);
  }
}

main(); 
import { scrapeForbesNews } from '../scrapers/forbes.scraper';
import { scrapingLogger } from '../utils/logger';
import { ENV } from '../config';

async function main() {
  try {
    console.log('🚀 Forbes 스크래핑 시작...');
    scrapingLogger.info('Forbes 스크래핑 시작');

    if (!ENV.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다');
    }

    const result = await scrapeForbesNews(ENV.OPENAI_API_KEY);
    
    if (result.success) {
      console.log(`✅ Forbes 스크래핑 성공: ${result.articles.length}개 기사 처리`);
      scrapingLogger.info(`Forbes 스크래핑 성공: ${result.articles.length}개 기사 처리`);
    } else {
      console.log(`❌ Forbes 스크래핑 실패`);
      scrapingLogger.error('Forbes 스크래핑 실패');
      
      if (result.errors.length > 0) {
        console.log('오류 목록:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
    }

    console.log(`📊 총 ${result.totalCount}개 중 ${result.articles.length}개 성공`);
    console.log(`🕐 완료 시간: ${result.scrapedAt.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Forbes 스크래핑 중 오류 발생:', error);
    scrapingLogger.error('Forbes 스크래핑 중 오류 발생', error as Error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 
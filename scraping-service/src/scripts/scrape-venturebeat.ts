import { scrapeVentureBeatNews } from '../scrapers/venturebeat.scraper';
// 개별 저장으로 변경되어 더 이상 필요하지 않음
// import { saveArticlesToSupabase } from '../utils/save-articles';
import { scrapingLogger } from '../utils/logger';

async function main() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
      process.exit(1);
    }

    console.log('🚀 VentureBeat 뉴스 스크래핑을 시작합니다...');
    scrapingLogger.info('VentureBeat 뉴스 스크래핑 시작');

    const result = await scrapeVentureBeatNews(openaiApiKey);

    if (result.success && result.articles.length > 0) {
      console.log(`\n📝 ${result.articles.length}개 기사가 실시간으로 Supabase에 저장되었습니다.`);
      scrapingLogger.info(`${result.articles.length}개 기사 실시간 저장 완료`);
    } else {
      console.log('⚠️  스크래핑된 기사가 없습니다.');
      scrapingLogger.warn('스크래핑된 기사 없음');
      
      if (result.errors.length > 0) {
        console.log('\n오류 목록:');
        result.errors.forEach(error => {
          console.log(`  - ${error}`);
        });
      }
    }

    console.log('\n🏁 VentureBeat 뉴스 스크래핑이 완료되었습니다.');
    scrapingLogger.info('VentureBeat 뉴스 스크래핑 완료');

  } catch (error) {
    console.error('❌ 스크래핑 중 오류가 발생했습니다:', error);
    scrapingLogger.error('VentureBeat 스크래핑 실패', error as Error);
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
  main();
} 
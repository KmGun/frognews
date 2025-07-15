import { scrapeBBCNews } from '../scrapers/bbc.scraper';
import { scrapingLogger } from '../utils/logger';
import { saveArticlesToSupabase } from '../utils/save-articles';

async function main() {
  try {
    scrapingLogger.info('BBC 뉴스 스크래핑 시작');
    
    const result = await scrapeBBCNews();
    
    if (result.success && result.articles.length > 0) {
      scrapingLogger.info(`스크래핑 성공: ${result.articles.length}개 기사 수집`);
      
      // 데이터베이스에 저장
      await saveArticlesToSupabase(result.articles);
      scrapingLogger.info('데이터베이스 저장 완료');
    } else {
      scrapingLogger.warn('스크래핑된 기사가 없습니다.');
      if (result.errors.length > 0) {
        scrapingLogger.error('스크래핑 오류들:', result.errors);
      }
    }
  } catch (error) {
    scrapingLogger.error('BBC 스크래핑 실행 중 오류:', error);
  }
}

main().catch(console.error); 
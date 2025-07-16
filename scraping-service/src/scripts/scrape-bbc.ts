import { scrapeBBCNews } from '../scrapers/bbc.scraper';
import { scrapingLogger } from '../utils/logger';
// 개별 저장으로 변경되어 더 이상 필요하지 않음
// import { saveArticlesToSupabase } from '../utils/save-articles';

async function main() {
  try {
    scrapingLogger.info('BBC 뉴스 스크래핑 시작');
    
    const result = await scrapeBBCNews();
    
    if (result.success && result.articles.length > 0) {
      scrapingLogger.info(`스크래핑 성공: ${result.articles.length}개 기사 수집`);
      
      // 개별 저장으로 이미 저장 완료됨
      scrapingLogger.info('모든 기사가 실시간으로 데이터베이스에 저장되었습니다.');
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
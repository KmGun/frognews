import { scrapeArsTechnicaNews } from '../scrapers/arstechnica.scraper';
import { saveArticlesToSupabase } from '../utils/save-articles';
import { scrapingLogger } from '../utils/logger';

async function main() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    console.log('🚀 Ars Technica 뉴스 스크래핑 시작...');
    scrapingLogger.info('Ars Technica 뉴스 스크래핑 시작');
    
    const result = await scrapeArsTechnicaNews(openaiApiKey);
    
    if (result.success && result.articles.length > 0) {
      console.log(`\n💾 Supabase에 ${result.articles.length}개 기사 저장 중...`);
      scrapingLogger.info(`Supabase에 ${result.articles.length}개 기사 저장 시작`);
      
      await saveArticlesToSupabase(result.articles);
      
      console.log('✅ 모든 작업이 완료되었습니다!');
      scrapingLogger.info('Ars Technica 뉴스 스크래핑 및 저장 완료');
    } else {
      console.log('⚠️ 스크래핑된 기사가 없습니다.');
      scrapingLogger.warn('스크래핑된 기사가 없음');
    }
    
    // 에러 출력
    if (result.errors.length > 0) {
      console.log('\n❌ 발생한 에러들:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 스크래핑 중 오류 발생:', error);
    scrapingLogger.error('Ars Technica 뉴스 스크래핑 실패', error as Error);
    process.exit(1);
  }
}

main().catch(console.error); 
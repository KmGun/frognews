import { scrapeAiTimesNews } from '../scrapers/aitimes.scraper';
import { scrapingLogger } from '../utils/logger';

async function main() {
  try {
    // 환경 변수에서 OpenAI API 키 가져오기
    const openaiApiKey = process.env.OPENAI_API_KEY || 'test-key';
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. 테스트 모드로 실행됩니다.');
    }

    scrapingLogger.info('AI타임즈 스크래핑 시작...');
    
    const result = await scrapeAiTimesNews(openaiApiKey);
    
    if (result.success) {
      scrapingLogger.info(`스크래핑 성공! 총 ${result.articles.length}개 기사 처리`);
      
      // 결과 출력
      result.articles.forEach((article, index) => {
        console.log(`\n=== 기사 ${index + 1} ===`);
        console.log(`제목: ${article.title}`);
        console.log(`URL: ${article.url}`);
        console.log(`요약: ${article.summary}`);
        console.log(`이미지: ${article.imageUrl || '없음'}`);
        console.log(`본문 길이: ${article.content.length}자`);
      });
      
    } else {
      scrapingLogger.error('스크래핑 실패');
      result.errors.forEach(error => {
        scrapingLogger.error(error);
      });
    }
    
  } catch (error) {
    scrapingLogger.error('스크래핑 프로세스 오류:', error as Error);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

export { main as scrapeAiTimesMain }; 
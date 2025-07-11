import { scrapeAiTimesNews } from '../scrapers/aitimes.scraper';
import { scrapingLogger } from '../utils/logger';
import { saveArticlesToSupabase } from '../utils/save-articles';

async function main() {
  try {
    // 환경 변수에서 OpenAI API 키 가져오기
    const openaiApiKey = process.env.OPENAI_API_KEY || 'test-key';
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. 테스트 모드로 실행됩니다.');
    }

    console.log('🚀 AI타임즈 스크래핑 시작...');
    scrapingLogger.info('AI타임즈 스크래핑 시작...');
    
    const result = await scrapeAiTimesNews(openaiApiKey);
    
    if (result.success) {
      console.log(`✅ 스크래핑 성공! 총 ${result.articles.length}개 기사 처리`);
      scrapingLogger.info(`스크래핑 성공! 총 ${result.articles.length}개 기사 처리`);
      
      // 결과 출력
      result.articles.forEach((article, index) => {
        console.log(`\n📰 === 기사 ${index + 1} ===`);
        console.log(`📝 제목: ${article.title}`);
        console.log(`🔗 URL: ${article.url}`);
        if (article.publishedAt) {
          console.log(`⏰ 작성일: ${article.publishedAt.toISOString().replace('T', ' ').substring(0, 16)}`);
        }
        // 제목 요약과 본문 요약을 분리해서 표시
        const summaryParts = (article.summary || '').split('\n\n');
        if (summaryParts.length >= 2) {
          console.log(`🎯 제목 요약: ${summaryParts[0]}`);
          console.log(`📋 본문 요약:`);
          console.log(`   ${summaryParts[1]}`);
        } else {
          console.log(`📋 요약: ${article.summary || '요약 없음'}`);
        }
        // 3줄 요약 각 줄의 세부 설명
        if (article.details && article.details.length > 0) {
          article.details.forEach((detail, i) => {
            console.log(`    ➡️  3줄 요약 ${i+1} 세부: ${detail.replace(/\n/g, ' ')}`);
          });
        }
        console.log(`🖼️  이미지: ${article.imageUrl || '없음'}`);
        console.log(`📊 본문 길이: ${article.content.length}자`);
      });

      // Supabase 저장
      await saveArticlesToSupabase(result.articles);
      console.log('✅ Supabase 저장 완료!');
      
    } else {
      console.log('❌ 스크래핑 실패');
      scrapingLogger.error('스크래핑 실패');
      result.errors.forEach(error => {
        console.log(`❌ 에러: ${error}`);
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
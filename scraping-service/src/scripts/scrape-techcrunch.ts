import { scrapeTechCrunchNews } from '../scrapers/techcrunch.scraper';
import { saveArticlesToSupabase } from '../utils/save-articles';
import { scrapingLogger } from '../utils/logger';

async function main() {
  try {
    console.log('🚀 TechCrunch 뉴스 스크래핑 시작...');
    scrapingLogger.info('TechCrunch 스크래핑 시작');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다');
    }

    // TechCrunch 뉴스 스크래핑 실행
    const result = await scrapeTechCrunchNews(openaiApiKey);

    if (result.success && result.articles.length > 0) {
      console.log(`\n📊 스크래핑 결과:`);
      console.log(`- 총 기사 수: ${result.totalCount}`);
      console.log(`- 성공한 기사 수: ${result.articles.length}`);
      console.log(`- 실패한 기사 수: ${result.errors.length}`);

      // Supabase에 저장
      console.log('\n💾 Supabase에 기사 저장 중...');
      try {
        await saveArticlesToSupabase(result.articles);
        console.log(`✅ ${result.articles.length}개 기사가 성공적으로 저장되었습니다`);
        scrapingLogger.info(`TechCrunch 스크래핑 완료: ${result.articles.length}개 기사 저장`);
      } catch (saveError) {
        console.error('❌ 기사 저장 실패:', saveError);
        scrapingLogger.error('기사 저장 실패', saveError as Error);
      }

      // 오류가 있다면 로그 출력
      if (result.errors.length > 0) {
        console.log('\n⚠️ 처리 중 발생한 오류들:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }

    } else {
      console.error('❌ 스크래핑 실패 또는 기사를 찾을 수 없음');
      if (result.errors.length > 0) {
        console.log('오류 내용:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
      scrapingLogger.error('TechCrunch 스크래핑 실패');
    }

  } catch (error) {
    console.error('❌ 스크래핑 프로세스 실패:', error);
    scrapingLogger.error('TechCrunch 스크래핑 프로세스 실패', error as Error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
} 
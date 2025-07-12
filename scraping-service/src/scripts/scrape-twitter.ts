import { TwitterScraper } from '../scrapers/twitter.scraper';
import { saveTweetToSupabase } from '../utils/save-tweets';
import { scrapingLogger } from '../utils/logger';

async function main() {
  const tweetUrl = process.argv[2];
  
  if (!tweetUrl) {
    console.error('❌ 트위터 URL을 입력해주세요');
    console.log('사용법: npm run scrape:twitter <트위터_URL>');
    console.log('예시: npm run scrape:twitter https://x.com/elonmusk/status/1943178423947661609');
    process.exit(1);
  }

  // URL 유효성 검사
  if (!tweetUrl.includes('twitter.com') && !tweetUrl.includes('x.com')) {
    console.error('❌ 유효한 트위터 URL이 아닙니다');
    process.exit(1);
  }

  const scraper = new TwitterScraper();
  
  try {
    console.log('🚀 트위터 스크래핑 시작...');
    console.log('📋 URL:', tweetUrl);
    
    await scraper.initBrowser();
    const tweetData = await scraper.scrapeTweetDetails(tweetUrl);
    
    if (!tweetData) {
      console.error('❌ 트위터 게시물 스크래핑 실패');
      process.exit(1);
    }
    
    console.log('\n📊 스크래핑 결과:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🆔 ID:', tweetData.id);
    console.log('👤 작성자:', tweetData.author.name, `(@${tweetData.author.username})`);
    console.log('📝 원문:', tweetData.text);
    
    if (tweetData.textKo) {
      console.log('🇰🇷 번역:', tweetData.textKo);
      console.log('🤖 번역 모델:', tweetData.translationModel);
    } else {
      console.log('🇰🇷 번역: 없음');
    }
    
    console.log('📅 작성일:', tweetData.createdAt.toLocaleString('ko-KR'));
    console.log('🔗 URL:', tweetData.url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Supabase에 저장
    console.log('\n💾 데이터베이스 저장 중...');
    await saveTweetToSupabase(tweetData);
    
    console.log('\n✅ 트위터 스크래핑 완료!');
    
  } catch (error) {
    console.error('❌ 스크래핑 실패:', error);
    scrapingLogger.error('스크래핑 실패', error as Error);
    process.exit(1);
  } finally {
    await scraper.closeBrowser();
  }
}

// 스크립트 실행
main().catch(console.error); 
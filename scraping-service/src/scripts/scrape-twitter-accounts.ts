import { TwitterScraper } from '../scrapers/twitter.scraper';
import { saveTweetsToSupabase } from '../utils/save-tweets';
import { scrapingLogger } from '../utils/logger';
import { TWITTER_TARGET_ACCOUNTS } from '../config';

async function main() {
  // 명령행 인수에서 설정 읽기
  const maxTweetsPerUser = parseInt(process.argv[2]) || 5;
  const accountsParam = process.argv[3];
  
  // 스크래핑할 계정 결정
  let targetAccounts: string[];
  
  if (accountsParam) {
    // 특정 계정들이 지정된 경우
    targetAccounts = accountsParam.split(',').map(account => account.trim().replace('@', ''));
    console.log('🎯 지정된 계정들 스크래핑:', targetAccounts.join(', '));
  } else {
    // 기본 설정된 모든 계정
    targetAccounts = TWITTER_TARGET_ACCOUNTS;
    console.log('🎯 설정된 모든 계정들 스크래핑 (총', targetAccounts.length, '개 계정)');
  }

  console.log('📋 스크래핑 설정:');
  console.log('   - 계정당 최대 트윗:', maxTweetsPerUser, '개');
  console.log('   - 대상 계정:', targetAccounts.length, '개');
  console.log('   - AI 관련 게시물만 저장: ✓');
  console.log('');

  const scraper = new TwitterScraper();
  
  try {
    console.log('🚀 트위터 계정 일괄 스크래핑 시작...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 모든 계정의 AI 관련 트윗 수집
    const allTweets = await scraper.scrapeMultipleAccounts(targetAccounts, maxTweetsPerUser);
    
    if (allTweets.length === 0) {
      console.log('❌ AI 관련 트윗을 찾을 수 없었습니다.');
      process.exit(1);
    }
    
    console.log('\n📊 스크래핑 결과 요약:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 총 수집된 AI 관련 트윗:', allTweets.length, '개');
    
    // 계정별 통계
    const accountStats = targetAccounts.map(account => {
      const accountTweets = allTweets.filter(tweet => 
        tweet.author.username.toLowerCase() === account.toLowerCase()
      );
      return {
        account,
        count: accountTweets.length,
        translated: accountTweets.filter(t => t.isTranslated).length
      };
    }).filter(stat => stat.count > 0);

    accountStats.forEach(stat => {
      console.log(`   @${stat.account}: ${stat.count}개 (번역: ${stat.translated}개)`);
    });
    
    console.log('\n💾 Supabase 데이터베이스 저장 중...');
    await saveTweetsToSupabase(allTweets);
    
    console.log('\n✅ 트위터 계정 일괄 스크래핑 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 최종 결과:');
    console.log('   - 처리된 계정:', accountStats.length, '개');
    console.log('   - 저장된 AI 관련 트윗:', allTweets.length, '개');
    console.log('   - 번역된 트윗:', allTweets.filter(t => t.isTranslated).length, '개');
    
  } catch (error) {
    console.error('❌ 스크래핑 실패:', error);
    scrapingLogger.error('트위터 계정 일괄 스크래핑 실패', error as Error);
    process.exit(1);
  }
}

// 사용법 출력
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('트위터 계정 일괄 스크래핑 도구');
  console.log('');
  console.log('사용법:');
  console.log('  yarn scrape:twitter:accounts [계정당_최대_트윗수] [특정계정들]');
  console.log('');
  console.log('예시:');
  console.log('  yarn scrape:twitter:accounts                    # 모든 설정된 계정, 각각 5개씩');
  console.log('  yarn scrape:twitter:accounts 10                # 모든 설정된 계정, 각각 10개씩');
  console.log('  yarn scrape:twitter:accounts 5 elonmusk,OpenAI # 특정 계정들만, 각각 5개씩');
  console.log('');
  console.log('기능:');
  console.log('  - AI 관련 게시물만 자동 필터링');
  console.log('  - 영어 게시물 자동 한국어 번역');
  console.log('  - Supabase 데이터베이스 자동 저장');
  console.log('  - 중복 게시물 자동 방지');
  process.exit(0);
}

// 스크립트 실행
main().catch(console.error); 
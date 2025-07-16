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
    console.log('🔄 재시도 로직 및 봇 탐지 우회 기능 활성화');
    
    // 개선된 재시도 로직 사용
    const tweetData = await scraper.scrapeTweetWithRetry(tweetUrl, 5); // 최대 5회 재시도
    
    if (!tweetData) {
      console.error('❌ 트위터 게시물 스크래핑 최종 실패');
      console.error('💡 해결 방법:');
      console.error('   1. 네트워크 연결 상태 확인');
      console.error('   2. 트위터 URL이 유효한지 확인');
      console.error('   3. 트위터가 로그인을 요구하는지 확인');
      console.error('   4. VPN 사용 시 위치 변경 시도');
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
    
    // 미디어 정보 표시
    if (tweetData.media && tweetData.media.length > 0) {
      console.log('\n📷 미디어:');
      tweetData.media.forEach((media, index) => {
        console.log(`  ${index + 1}. ${media.type}: ${media.url}`);
        if (media.altText) console.log(`     설명: ${media.altText}`);
        if (media.thumbnailUrl) console.log(`     썸네일: ${media.thumbnailUrl}`);
      });
    }
    
    // 외부 링크 정보 표시
    if (tweetData.externalLinks && tweetData.externalLinks.length > 0) {
      console.log('\n🔗 외부 링크:');
      tweetData.externalLinks.forEach((link, index) => {
        console.log(`  ${index + 1}. ${link.title || '제목 없음'}`);
        console.log(`     URL: ${link.url}`);
        if (link.description) console.log(`     설명: ${link.description}`);
        if (link.thumbnailUrl) console.log(`     썸네일: ${link.thumbnailUrl}`);
      });
    }
    
    console.log('\n📅 작성일:', tweetData.createdAt.toLocaleString('ko-KR'));
    console.log('🔗 URL:', tweetData.url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Supabase에 저장
    console.log('\n💾 데이터베이스 저장 중...');
    await saveTweetToSupabase(tweetData);
    
    console.log('\n✅ 트위터 스크래핑 완료!');
    
  } catch (error) {
    scrapingLogger.error('트위터 스크래핑 실패:', error as Error);
    console.error('❌ 스크래핑 중 치명적 오류 발생:', (error as Error).message);
    console.error('🔍 오류 분석:');
    
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('net::ERR_NAME_NOT_RESOLVED')) {
      console.error('   → 네트워크 연결 문제 - 인터넷 연결을 확인하세요');
    } else if (errorMessage.includes('timeout')) {
      console.error('   → 타임아웃 발생 - 네트워크가 느리거나 사이트 응답 없음');
    } else if (errorMessage.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.error('   → 브라우저/보안 프로그램에 의한 차단');
    } else {
      console.error('   → 예상치 못한 오류 - 개발자에게 문의하세요');
    }
    
    process.exit(1);
  } finally {
    // scrapeTweetWithRetry 메서드가 이미 브라우저를 정리하므로 별도 정리 불필요
    console.log('🧹 정리 작업 완료');
  }
}

// 스크립트 실행
main().catch(console.error); 
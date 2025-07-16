import { TwitterScraper } from '../scrapers/twitter.scraper';
import { saveTweetToSupabase } from '../utils/save-tweets';
import { scrapingLogger } from '../utils/logger';
import { TWITTER_TARGET_ACCOUNTS } from '../config';
import { filterNewTweetIds, extractTweetIdFromUrl, calculatePerformanceMetrics } from '../utils/duplicate-checker';

async function main() {
  const scraper = new TwitterScraper();
  let totalProcessed = 0;
  let totalAITweets = 0;
  let totalErrors = 0;
  let totalNewTweets = 0;
  
  try {
    console.log('🚀 트위터 계정 일괄 스크래핑 시작...');
    console.log(`📋 대상 계정 수: ${TWITTER_TARGET_ACCOUNTS.length}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 각 계정별로 출력
    TWITTER_TARGET_ACCOUNTS.forEach((account, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. @${account}`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    // 브라우저 초기화
    await scraper.initBrowser();
    scrapingLogger.info('트위터 계정 일괄 스크래핑 시작');
    
    // 각 계정마다 최신 트윗을 가져와서 즉시 처리
    const maxTweetsPerAccount = 10; // 계정당 최대 트윗 수
    
    console.log('🔍 모든 계정에서 트윗 URL 수집 중...');
    let totalTweetUrls: string[] = [];
    
    // 1단계: 모든 계정에서 트윗 URL만 먼저 수집
    for (let i = 0; i < TWITTER_TARGET_ACCOUNTS.length; i++) {
      const username = TWITTER_TARGET_ACCOUNTS[i];
      console.log(`📋 계정 ${i + 1}/${TWITTER_TARGET_ACCOUNTS.length}: @${username} URL 수집 중`);
      
      try {
        const tweetUrls = await scraper.getUserTweetUrls(username, maxTweetsPerAccount);
        totalTweetUrls.push(...tweetUrls);
        
        console.log(`   ✅ @${username}: ${tweetUrls.length}개 트윗 URL 수집`);
      } catch (error) {
        console.log(`   ❌ @${username} URL 수집 실패:`, error);
      }

      // 계정 간 지연
      if (i < TWITTER_TARGET_ACCOUNTS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n📊 총 ${totalTweetUrls.length}개 트윗 URL 수집 완료`);
    
    // 2단계: 중복 체크
    const allTweetIds = totalTweetUrls.map(url => extractTweetIdFromUrl(url)).filter(id => id !== null) as string[];
    
    if (allTweetIds.length === 0) {
      console.log('❌ 유효한 트윗 ID를 찾을 수 없습니다');
      return;
    }

    console.log('🔍 기존 데이터 중복 체크 중...');
    const newTweetIds = await filterNewTweetIds(allTweetIds);
    
    if (newTweetIds.length === 0) {
      console.log('✅ 새로운 트윗이 없습니다 (모든 트윗이 이미 수집됨)');
      return;
    }

    // 3단계: 성능 메트릭 계산 및 표시
    const metrics = calculatePerformanceMetrics(allTweetIds.length, newTweetIds.length);
    console.log(`📊 효율성 리포트:`);
    console.log(`   전체 트윗: ${metrics.totalItems}개`);
    console.log(`   새로운 트윗: ${metrics.newItems}개`);
    console.log(`   중복 제외: ${metrics.duplicateItems}개`);
    console.log(`   ⚡ 효율성: ${metrics.efficiencyPercentage}% 작업량 절약`);
    console.log(`   ⏱️ 시간 절약: ${metrics.timeSaved}`);
    console.log(`   💰 비용 절약: ${metrics.costSaved}`);

    // 새로운 트윗 URL만 필터링
    const newTweetUrls = totalTweetUrls.filter(url => {
      const tweetId = extractTweetIdFromUrl(url);
      return tweetId && newTweetIds.includes(tweetId);
    });

    totalNewTweets = newTweetUrls.length;
    console.log(`\n🎯 실제 처리할 새로운 트윗: ${totalNewTweets}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 4단계: 각 트윗을 하나씩 스크래핑하고 즉시 저장
    for (let i = 0; i < newTweetUrls.length; i++) {
      const url = newTweetUrls[i];
      const progress = `${i + 1}/${newTweetUrls.length}`;
      
      console.log(`\n🔄 [${progress}] 트윗 처리 중...`);
      console.log(`🔗 URL: ${url}`);
      
      try {
        totalProcessed++;
        
        // 트윗 스크래핑
        const tweetData = await scraper.scrapeTweetDetails(url);
        
        if (tweetData) {
          // AI 관련 트윗이므로 바로 저장
          console.log(`💾 데이터베이스 저장 중...`);
          await saveTweetToSupabase(tweetData);
          
          totalAITweets++;
          console.log(`✅ [${progress}] 저장 완료: ${tweetData.author.name} - ${tweetData.text.substring(0, 50)}...`);
          
          // 번역 여부 표시
          if (tweetData.isTranslated) {
            console.log(`🇰🇷 번역: ${tweetData.textKo?.substring(0, 50)}...`);
          }
        } else {
          console.log(`⏭️ [${progress}] AI 관련 트윗이 아니거나 스크래핑 실패로 건너뜀`);
        }
        
      } catch (error) {
        totalErrors++;
        console.error(`❌ [${progress}] 트윗 처리 실패:`, error);
        scrapingLogger.error(`트윗 처리 실패 (${url}):`, error as Error);
      }

      // 트윗 간 지연 (부하 방지)
      if (i < newTweetUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 최종 결과 출력
    console.log('\n📊 스크래핑 완료 리포트');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 대상 계정: ${TWITTER_TARGET_ACCOUNTS.length}개`);
    console.log(`📄 처리된 트윗: ${totalProcessed}개`);
    console.log(`🆕 새로운 트윗: ${totalNewTweets}개`);
    console.log(`🤖 AI 관련 트윗: ${totalAITweets}개`);
    console.log(`✅ 성공: ${totalAITweets}개`);
    console.log(`❌ 실패: ${totalErrors}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (totalAITweets > 0) {
      console.log('\n🎉 AI 관련 새 트윗이 데이터베이스에 저장되었습니다!');
    }
    
    scrapingLogger.info(`트위터 계정 일괄 스크래핑 완료 - 성공: ${totalAITweets}, 실패: ${totalErrors}`);
    
  } catch (error) {
    console.error('❌ 스크래핑 실패:', error);
    scrapingLogger.error('트위터 계정 일괄 스크래핑 실패', error as Error);
    process.exit(1);
  } finally {
    await scraper.closeBrowser();
    
    console.log('\n🏁 스크래핑 프로세스 종료');
    scrapingLogger.info('트위터 브라우저 종료 완료');
  }
}

// 스크립트 실행
main().catch(console.error); 
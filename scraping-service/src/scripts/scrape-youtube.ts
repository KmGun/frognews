import { YouTubeScraper } from '../scrapers/youtube.scraper';
import { saveYouTubeVideo } from '../utils/save-youtube-videos';
import { scrapingLogger } from '../utils/logger';

async function main() {
  const videoUrl = process.argv[2];
  
  if (!videoUrl) {
    console.error('❌ 유튜브 URL을 입력해주세요');
    console.log('사용법: npm run scrape:youtube <유튜브_URL>');
    console.log('예시: npm run scrape:youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    process.exit(1);
  }

  // URL 유효성 검사
  if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
    console.error('❌ 유효한 유튜브 URL이 아닙니다');
    process.exit(1);
  }

  const scraper = new YouTubeScraper();
  
  try {
    console.log('🚀 유튜브 스크래핑 시작...');
    console.log('📋 URL:', videoUrl);
    
    const videoData = await scraper.scrapeVideo(videoUrl);
    
    if (!videoData) {
      console.error('❌ 유튜브 영상 스크래핑 실패');
      process.exit(1);
    }
    
    console.log('\n📊 스크래핑 결과:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🆔 ID:', videoData.id);
    console.log('📺 제목:', videoData.title);
    console.log('👤 채널:', videoData.channelName);
    console.log('📅 업로드:', videoData.publishedAt.toLocaleString('ko-KR'));
    console.log('👀 조회수:', videoData.viewCount?.toLocaleString() || '정보 없음');
    console.log('⏱️ 길이:', videoData.duration || '정보 없음');
    console.log('🖼️ 썸네일:', videoData.thumbnailUrl);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 데이터베이스에 저장
    console.log('\n💾 데이터베이스 저장 중...');
    const saved = await saveYouTubeVideo(videoData);
    
    if (saved) {
      console.log('✅ 유튜브 영상 저장 완료!');
    } else {
      console.error('❌ 데이터베이스 저장 실패');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 스크래핑 실패:', error);
    scrapingLogger.error('스크래핑 실패', error as Error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
} 
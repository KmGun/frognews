#!/usr/bin/env ts-node

import { scrapingLogger } from '../utils/logger';
import { performance } from 'perf_hooks';
import { scrapeAiTimesNews } from '../scrapers/aitimes.scraper';
import { scrapeNewsTheAiNews } from '../scrapers/newstheai.scraper';
import { scrapeForbesNews } from '../scrapers/forbes.scraper';
import { scrapeTechCrunchNews } from '../scrapers/techcrunch.scraper';
import { scrapeVentureBeatNews } from '../scrapers/venturebeat.scraper';
import { scrapeArsTechnicaNews } from '../scrapers/arstechnica.scraper';
import { scrapeTheVergeNews } from '../scrapers/theverge.scraper';
import { scrapeBBCNews } from '../scrapers/bbc.scraper';
import { TwitterScraper } from '../scrapers/twitter.scraper';
import { YouTubeScraper } from '../scrapers/youtube.scraper';
import { saveArticlesToSupabase } from '../utils/save-articles';
import { saveTweetsToSupabase } from '../utils/save-tweets';
import { saveYouTubeVideo } from '../utils/save-youtube-videos';
import { TWITTER_TARGET_ACCOUNTS } from '../config';

interface ScrapingTaskResult {
  name: string;
  success: boolean;
  articlesCount: number;
  tweetsCount?: number;
  videosCount?: number;
  errors: string[];
  duration: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// 색상 및 포맷팅 유틸리티
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const symbols = {
  pending: '⏳',
  running: '🔄',
  success: '✅',
  failed: '❌',
  warning: '⚠️'
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`;
}

function createProgressBar(current: number, total: number, width: number = 30): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${colors.cyan}[${bar}]${colors.reset} ${percentage}%`;
}

function updateProgressDisplay(completed: number, total: number, currentTask?: string): void {
  // 터미널 커서를 한 줄 위로 이동해서 진행률 업데이트
  if (completed > 0) {
    process.stdout.write('\x1b[1A\x1b[K'); // 한 줄 위로 이동 후 줄 지우기
  }
  const progressBar = createProgressBar(completed, total, 25);
  const status = currentTask ? ` (${currentTask})` : '';
  console.log(`\n${colors.bright}진행률: ${progressBar} ${completed}/${total}${status}${colors.reset}`);
}

function printTable(results: ScrapingTaskResult[]): void {
  const maxNameLength = Math.max(...results.map(r => r.name.length), 12);
  const headerSeparator = '─'.repeat(maxNameLength + 45);
  
  console.log(`\n${colors.bright}📊 실행 결과 요약${colors.reset}`);
  console.log(headerSeparator);
  console.log(`${colors.bright}${'소스'.padEnd(maxNameLength)} │ 상태 │ 기사 │ 트윗 │ 시간${colors.reset}`);
  console.log(headerSeparator);
  
  results.forEach(result => {
    const status = result.success ? `${colors.green}성공${colors.reset}` : `${colors.red}실패${colors.reset}`;
    const articles = result.articlesCount.toString().padStart(4);
    const tweets = (result.tweetsCount || 0).toString().padStart(4);
    const duration = formatDuration(result.duration).padStart(8);
    
    console.log(`${result.name.padEnd(maxNameLength)} │ ${status} │ ${articles} │ ${tweets} │ ${duration}`);
  });
  
  console.log(headerSeparator);
}

/**
 * 통합 스크래핑 실행 함수
 * 모든 뉴스 사이트, 트위터 계정, 유튜브 채널을 한번에 스크래핑
 */
async function runAllScrapers(): Promise<void> {
  const startTime = performance.now();
  const results: ScrapingTaskResult[] = [];
  
  // 헤더 출력
  console.clear();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║                                                ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║           🚀 통합 스크래핑 시작               ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║                                                ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
  scrapingLogger.info('통합 스크래핑 시작');

  // OpenAI API 키 확인
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    scrapingLogger.error('OPENAI_API_KEY 환경변수 누락');
    process.exit(1);
  }

  // 뉴스 사이트 스크래핑 작업들
  const newsScrapingTasks = [
    {
      name: 'AI타임즈',
      scraper: () => scrapeAiTimesNews(openaiApiKey),
    },
    {
      name: 'NewsTheAI',
      scraper: () => scrapeNewsTheAiNews(openaiApiKey),
    },
    {
      name: 'Forbes',
      scraper: () => scrapeForbesNews(openaiApiKey),
    },
    {
      name: 'TechCrunch',
      scraper: () => scrapeTechCrunchNews(openaiApiKey),
    },
    {
      name: 'VentureBeat',
      scraper: () => scrapeVentureBeatNews(openaiApiKey),
    },
    {
      name: 'Ars Technica',
      scraper: () => scrapeArsTechnicaNews(openaiApiKey),
    },
    {
      name: 'The Verge',
      scraper: () => scrapeTheVergeNews(openaiApiKey),
    },
    {
      name: 'BBC',
      scraper: () => scrapeBBCNews(),
    }
  ];

  // 뉴스 사이트 병렬 스크래핑
  console.log(`${colors.bright}${colors.blue}📰 뉴스 사이트 스크래핑 (${newsScrapingTasks.length}개 소스)${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(50)}${colors.reset}`);
  
  let completedTasks = 0;
  const totalTasks = newsScrapingTasks.length + 1; // +1 for Twitter
  
  const newsPromises = newsScrapingTasks.map(async (task) => {
    const taskStartTime = performance.now();
    console.log(`${symbols.running} ${colors.yellow}${task.name}${colors.reset} 스크래핑 중...`);
    
    try {
      const result = await task.scraper();
      const duration = performance.now() - taskStartTime;
      completedTasks++;
      
      if (result.success && result.articles.length > 0) {
        // Supabase에 저장
        await saveArticlesToSupabase(result.articles);
        console.log(`${symbols.success} ${colors.green}${task.name}${colors.reset}: ${colors.bright}${result.articles.length}${colors.reset}개 기사 저장 완료 ${colors.gray}(${formatDuration(duration)})${colors.reset}`);
        
        return {
          name: task.name,
          success: true,
          articlesCount: result.articles.length,
          errors: result.errors || [],
          duration,
          status: 'completed'
        } as ScrapingTaskResult;
      } else {
        console.log(`${symbols.warning} ${colors.yellow}${task.name}${colors.reset}: 새로운 기사 없음 ${colors.gray}(${formatDuration(duration)})${colors.reset}`);
        
        return {
          name: task.name,
          success: true,
          articlesCount: 0,
          errors: result.errors || [],
          duration,
          status: 'completed'
        } as ScrapingTaskResult;
      }
    } catch (error) {
      const duration = performance.now() - taskStartTime;
      completedTasks++;
      console.log(`${symbols.failed} ${colors.red}${task.name}${colors.reset}: 스크래핑 실패 ${colors.gray}(${formatDuration(duration)})${colors.reset}`);
      console.log(`${colors.gray}   └─ ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
      
      return {
        name: task.name,
        success: false,
        articlesCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration,
        status: 'failed'
      } as ScrapingTaskResult;
    }
  });

  // 모든 뉴스 스크래핑 결과 대기
  const newsResults = await Promise.all(newsPromises);
  results.push(...newsResults);

  // 트위터 계정 스크래핑
  console.log(`\n${colors.bright}${colors.blue}🐦 트위터 계정 스크래핑${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(50)}${colors.reset}`);
  const twitterStartTime = performance.now();
  try {
    const twitterScraper = new TwitterScraper();
    const maxTweetsPerUser = 10; // 계정당 최대 트윗 수
    
    console.log(`${symbols.running} ${colors.yellow}트위터${colors.reset}: ${TWITTER_TARGET_ACCOUNTS.length}개 계정에서 AI 관련 트윗 수집 중...`);
    const allTweets = await twitterScraper.scrapeMultipleAccounts(TWITTER_TARGET_ACCOUNTS, maxTweetsPerUser);
    
    if (allTweets.length > 0) {
      await saveTweetsToSupabase(allTweets);
      const twitterDuration = performance.now() - twitterStartTime;
      console.log(`${symbols.success} ${colors.green}트위터${colors.reset}: ${colors.bright}${allTweets.length}${colors.reset}개 AI 관련 트윗 저장 완료 ${colors.gray}(${formatDuration(twitterDuration)})${colors.reset}`);
      
      results.push({
        name: '트위터',
        success: true,
        articlesCount: 0,
        tweetsCount: allTweets.length,
        errors: [],
        duration: twitterDuration,
        status: 'completed'
      });
    } else {
      const twitterDuration = performance.now() - twitterStartTime;
      console.log(`${symbols.warning} ${colors.yellow}트위터${colors.reset}: 새로운 AI 관련 트윗 없음 ${colors.gray}(${formatDuration(twitterDuration)})${colors.reset}`);
      
      results.push({
        name: '트위터',
        success: true,
        articlesCount: 0,
        tweetsCount: 0,
        errors: [],
        duration: twitterDuration,
        status: 'completed'
      });
    }
  } catch (error) {
    const twitterDuration = performance.now() - twitterStartTime;
    console.log(`${symbols.failed} ${colors.red}트위터${colors.reset}: 스크래핑 실패 ${colors.gray}(${formatDuration(twitterDuration)})${colors.reset}`);
    console.log(`${colors.gray}   └─ ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
    
    results.push({
      name: '트위터',
      success: false,
      articlesCount: 0,
      tweetsCount: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      duration: twitterDuration,
      status: 'failed'
    });
  }

  // 전체 결과 요약
  const totalDuration = performance.now() - startTime;
  const successfulTasks = results.filter(r => r.success);
  const failedTasks = results.filter(r => !r.success);
  const totalArticles = results.reduce((sum, r) => sum + r.articlesCount, 0);
  const totalTweets = results.reduce((sum, r) => sum + (r.tweetsCount || 0), 0);

  // 테이블 형태로 결과 출력
  printTable(results);

  // 요약 정보 출력
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║                  🏁 실행 완료                  ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}`);
  
  console.log(`\n${colors.bright}📊 전체 요약${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(40)}${colors.reset}`);
  console.log(`⏱️  전체 실행 시간: ${colors.bright}${formatDuration(totalDuration)}${colors.reset}`);
  console.log(`✅ 성공한 작업: ${colors.green}${successfulTasks.length}${colors.reset}개`);
  console.log(`❌ 실패한 작업: ${colors.red}${failedTasks.length}${colors.reset}개`);
  console.log(`📰 수집된 기사: ${colors.bright}${totalArticles}${colors.reset}개`);
  console.log(`🐦 수집된 트윗: ${colors.bright}${totalTweets}${colors.reset}개`);

  if (failedTasks.length > 0) {
    console.log(`\n${colors.red}❌ 실패한 작업 상세:${colors.reset}`);
    failedTasks.forEach(task => {
      console.log(`${colors.gray}   • ${task.name}: ${task.errors.join(', ')}${colors.reset}`);
    });
  }

  // 성공률 계산
  const successRate = Math.round((successfulTasks.length / results.length) * 100);
  const rateColor = successRate >= 80 ? colors.green : successRate >= 50 ? colors.yellow : colors.red;
  console.log(`\n${colors.bright}성공률: ${rateColor}${successRate}%${colors.reset} ${createProgressBar(successfulTasks.length, results.length, 20)}`);

  console.log(`\n${colors.bright}${colors.green}🎉 모든 스크래핑 작업이 완료되었습니다!${colors.reset}`);
  scrapingLogger.info(`통합 스크래핑 완료 - 총 ${totalArticles}개 기사, ${totalTweets}개 트윗 수집`);

  // 실패한 작업이 있어도 프로세스는 성공으로 종료 (부분 성공)
  process.exit(0);
}

// 스크립트 실행
if (require.main === module) {
  runAllScrapers().catch((error) => {
    console.error('❌ 통합 스크래핑 실행 중 치명적 오류:', error);
    scrapingLogger.error('통합 스크래핑 치명적 오류:', error as Error);
    process.exit(1);
  });
}

export { runAllScrapers }; 
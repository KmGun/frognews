#!/usr/bin/env ts-node


import { logger } from '@/utils/logger';

/**
 * 일회성 스크래핑 테스트 스크립트
 * npm run scrape:once 명령으로 실행
 */
async function runScrapeTest() {
  logger.info('=== 스크래핑 테스트 시작 ===');

  try {
    // TODO: 구현된 스크래퍼로 교체
    logger.info('테스트 스킵 - 구현된 스크래퍼 없음');

    logger.info('=== 스크래핑 테스트 완료 ===');
    
    // 성공 여부에 따라 exit code 설정
    process.exit(0);

  } catch (error) {
    logger.error('스크래핑 테스트 실패:', error as Error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  runScrapeTest();
} 
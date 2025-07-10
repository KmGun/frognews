#!/usr/bin/env ts-node

import { ChosunScraper } from '@/scrapers/chosun.scraper';
import { logger } from '@/utils/logger';

/**
 * 일회성 스크래핑 테스트 스크립트
 * npm run scrape:once 명령으로 실행
 */
async function runScrapeTest() {
  logger.info('=== 스크래핑 테스트 시작 ===');

  try {
    // 조선일보 스크래퍼 테스트
    logger.info('조선일보 스크래핑 시작...');
    const chosunScraper = new ChosunScraper();
    const result = await chosunScraper.scrapeArticles();

    logger.info('=== 스크래핑 결과 ===', {
      success: result.success,
      source: result.source,
      totalCount: result.totalCount,
      scrapedAt: result.scrapedAt,
      errorsCount: result.errors.length
    });

    if (result.errors.length > 0) {
      logger.warn('발생한 에러들:', result.errors);
    }

    // 샘플 기사 출력 (처음 3개)
    if (result.articles.length > 0) {
      logger.info('=== 샘플 기사들 ===');
      result.articles.slice(0, 3).forEach((article, index) => {
        logger.info(`기사 ${index + 1}:`, {
          title: article.title,
          url: article.url,
          author: article.author,
          category: article.category,
          contentLength: article.content.length,
          tags: article.tags
        });
      });
    }

    logger.info('=== 스크래핑 테스트 완료 ===');
    
    // 성공 여부에 따라 exit code 설정
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    logger.error('스크래핑 테스트 실패:', error as Error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  runScrapeTest();
} 
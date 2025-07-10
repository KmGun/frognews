import express, { Request, Response } from 'express';
import { ChosunScraper } from '@/scrapers/chosun.scraper';
import { ApiResponse, ScrapingResult } from '@/types';
import { apiLogger, logApiRequest, logApiError } from '@/utils/logger';

const router = express.Router();

// 헬스 체크
router.get('/health', (req: Request, res: Response) => {
  logApiRequest('GET', '/health', req.ip);
  
  const response: ApiResponse = {
    success: true,
    message: '스크래핑 서비스가 정상 동작 중입니다',
    timestamp: new Date()
  };
  
  res.json(response);
});

// 단일 소스 스크래핑
router.post('/scrape/:sourceId', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  logApiRequest('POST', `/scrape/${sourceId}`, req.ip);

  try {
    let scraper;
    
    // 소스별 스크래퍼 인스턴스 생성
    switch (sourceId) {
      case 'chosun':
        scraper = new ChosunScraper();
        break;
      default:
        const errorResponse: ApiResponse = {
          success: false,
          error: `지원하지 않는 소스입니다: ${sourceId}`,
          timestamp: new Date()
        };
        return res.status(400).json(errorResponse);
    }

    // 스크래핑 실행
    const result: ScrapingResult = await scraper.scrapeArticles();
    
    const response: ApiResponse<ScrapingResult> = {
      success: result.success,
      data: result,
      message: result.success 
        ? `${result.totalCount}개 기사를 성공적으로 스크래핑했습니다`
        : '스크래핑 중 오류가 발생했습니다',
      timestamp: new Date()
    };

    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(response);

  } catch (error) {
    logApiError('POST', `/scrape/${sourceId}`, error as Error, req.ip);
    
    const response: ApiResponse = {
      success: false,
      error: `스크래핑 실행 중 오류: ${(error as Error).message}`,
      timestamp: new Date()
    };
    
    res.status(500).json(response);
  }
});

// 모든 소스 스크래핑
router.post('/scrape-all', async (req: Request, res: Response) => {
  logApiRequest('POST', '/scrape-all', req.ip);

  try {
    const results: ScrapingResult[] = [];
    
    // 현재는 조선일보만 구현되어 있음
    const scrapers = [
      { id: 'chosun', scraper: new ChosunScraper() }
    ];

    // 순차적으로 스크래핑 (병렬 처리는 서버 부하를 고려하여 제외)
    for (const { id, scraper } of scrapers) {
      try {
        apiLogger.info(`${id} 스크래핑 시작`);
        const result = await scraper.scrapeArticles();
        results.push(result);
        apiLogger.info(`${id} 스크래핑 완료: ${result.totalCount}개 기사`);
      } catch (error) {
        apiLogger.error(`${id} 스크래핑 실패`, error as Error);
        results.push({
          success: false,
          articles: [],
          errors: [(error as Error).message],
          source: id,
          scrapedAt: new Date(),
          totalCount: 0
        });
      }
    }

    const totalArticles = results.reduce((sum, result) => sum + result.totalCount, 0);
    const successfulSources = results.filter(result => result.success).length;

    const response: ApiResponse<ScrapingResult[]> = {
      success: successfulSources > 0,
      data: results,
      message: `${successfulSources}개 소스에서 총 ${totalArticles}개 기사를 스크래핑했습니다`,
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    logApiError('POST', '/scrape-all', error as Error, req.ip);
    
    const response: ApiResponse = {
      success: false,
      error: `전체 스크래핑 실행 중 오류: ${(error as Error).message}`,
      timestamp: new Date()
    };
    
    res.status(500).json(response);
  }
});

// 스크래핑 상태 조회
router.get('/status', (req: Request, res: Response) => {
  logApiRequest('GET', '/status', req.ip);

  const status = {
    service: 'news-scraping-service',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date(),
    supportedSources: [
      { id: 'chosun', name: '조선일보', enabled: true },
      { id: 'hankyung', name: '한국경제', enabled: false },
      { id: 'yonhap', name: '연합뉴스', enabled: false }
    ]
  };

  const response: ApiResponse = {
    success: true,
    data: status,
    timestamp: new Date()
  };

  res.json(response);
});

// 기사 검증 (추후 AI 서비스와 연동)
router.post('/validate-article', async (req: Request, res: Response) => {
  logApiRequest('POST', '/validate-article', req.ip);

  try {
    const { title, content, url } = req.body;

    if (!title || !content || !url) {
      const response: ApiResponse = {
        success: false,
        error: '필수 필드가 누락되었습니다 (title, content, url)',
        timestamp: new Date()
      };
      return res.status(400).json(response);
    }

    // 간단한 검증 로직
    const validation = {
      isValid: true,
      score: 85,
      issues: [] as string[],
      suggestions: [] as string[]
    };

    // 제목 길이 체크
    if (title.length < 10) {
      validation.isValid = false;
      validation.issues.push('제목이 너무 짧습니다');
      validation.score -= 20;
    }

    // 본문 길이 체크
    if (content.length < 100) {
      validation.isValid = false;
      validation.issues.push('본문이 너무 짧습니다');
      validation.score -= 30;
    }

    // URL 유효성 체크
    try {
      new URL(url);
    } catch {
      validation.isValid = false;
      validation.issues.push('유효하지 않은 URL입니다');
      validation.score -= 10;
    }

    const response: ApiResponse = {
      success: true,
      data: validation,
      timestamp: new Date()
    };

    res.json(response);

  } catch (error) {
    logApiError('POST', '/validate-article', error as Error, req.ip);
    
    const response: ApiResponse = {
      success: false,
      error: `기사 검증 중 오류: ${(error as Error).message}`,
      timestamp: new Date()
    };
    
    res.status(500).json(response);
  }
});

export default router; 
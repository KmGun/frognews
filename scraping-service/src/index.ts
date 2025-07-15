import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as cron from 'node-cron';
import routes from '@/api/routes';
import { ENV, CRON_SCHEDULES } from '@/config';
import { logger, apiLogger } from '@/utils/logger';


// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(helmet()); // 보안 헤더
app.use(cors()); // CORS 허용
app.use(express.json({ limit: '10mb' })); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  apiLogger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date()
  });
  next();
});

// API 라우트 등록
app.use('/api', routes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    service: 'News Scraping Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date(),
    endpoints: {
      health: '/api/health',
      status: '/api/status',
      scrape: '/api/scrape/:sourceId',
      scrapeAll: '/api/scrape-all',
      validateArticle: '/api/validate-article'
    }
  });
});

// 404 에러 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '요청한 엔드포인트를 찾을 수 없습니다',
    path: req.path,
    timestamp: new Date()
  });
});

// 전역 에러 핸들러
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('전역 에러 발생', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: ENV.NODE_ENV === 'production' 
      ? '서버 내부 오류가 발생했습니다' 
      : error.message,
    timestamp: new Date()
  });
});

// 크론 작업 설정
function setupCronJobs() {
  // 정기 스크래핑 (30분마다)
  cron.schedule(CRON_SCHEDULES.REGULAR_SCRAPING, async () => {
    logger.info('정기 스크래핑 작업 시작');
    
    try {
      // TODO: 구현된 스크래퍼로 교체
      logger.info('정기 스크래핑 스킵 - 구현된 스크래퍼 없음');
      
      // TODO: 결과를 Supabase에 저장하는 로직 추가
      // await saveArticlesToDatabase(result.articles);
      
    } catch (error) {
      logger.error('정기 스크래핑 실패', error as Error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Seoul"
  });

  // 일일 정리 작업 (새벽 2시)
  cron.schedule(CRON_SCHEDULES.DAILY_CLEANUP, async () => {
    logger.info('일일 정리 작업 시작');
    
    try {
      // TODO: 오래된 로그 파일 정리
      // TODO: 중복 기사 정리
      // TODO: 데이터베이스 최적화
      
      logger.info('일일 정리 작업 완료');
    } catch (error) {
      logger.error('일일 정리 작업 실패', error as Error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Seoul"
  });

  // 헬스 체크 (매시간)
  cron.schedule(CRON_SCHEDULES.HEALTH_CHECK, () => {
    logger.info('헬스 체크', {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date()
    });
  }, {
    scheduled: true,
    timezone: "Asia/Seoul"
  });

  logger.info('크론 작업 설정 완료');
}

// 서버 시작
async function startServer() {
  try {
    // 크론 작업 설정
    setupCronJobs();
    
    // 서버 시작
    app.listen(ENV.PORT, () => {
      logger.info(`🚀 스크래핑 서비스 시작됨`, {
        port: ENV.PORT,
        environment: ENV.NODE_ENV,
        timestamp: new Date()
      });
      
      logger.info('📋 서비스 정보', {
        endpoints: {
          health: `http://localhost:${ENV.PORT}/api/health`,
          status: `http://localhost:${ENV.PORT}/api/status`,
          scrape: `http://localhost:${ENV.PORT}/api/scrape/:sourceId`
        }
      });
    });

  } catch (error) {
    logger.error('서버 시작 실패', error as Error);
    process.exit(1);
  }
}

// 우아한 종료 처리
function setupGracefulShutdown() {
  const shutdown = (signal: string) => {
    logger.info(`${signal} 신호 수신, 서버 종료 중...`);
    
    // TODO: 진행 중인 스크래핑 작업 정리
    // TODO: 데이터베이스 연결 정리
    
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// 처리되지 않은 예외 처리
process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 거부', {
    reason,
    promise
  });
});

process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외', error);
  process.exit(1);
});

// 메인 실행
if (require.main === module) {
  setupGracefulShutdown();
  startServer();
}

export default app; 
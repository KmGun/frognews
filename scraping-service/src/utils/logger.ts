import winston from 'winston';
import { LOG_CONFIG } from '../config';

// 커스텀 로그 포맷
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return stack
      ? `${timestamp} [${level}]: ${message}\n${stack}`
      : `${timestamp} [${level}]: ${message}`;
  })
);

// 프로덕션용 JSON 포맷
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 로거 생성
export const logger = winston.createLogger({
  level: LOG_CONFIG.level,
  format: LOG_CONFIG.format === 'json' ? jsonFormat : customFormat,
  defaultMeta: { service: 'news-scraping-service' },
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: LOG_CONFIG.format === 'json' ? jsonFormat : customFormat
    }),
    
    // 파일 출력 (에러)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: jsonFormat
    }),
    
    // 파일 출력 (전체)
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: jsonFormat
    })
  ]
});

// 개발 환경에서 추가 로깅
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// 스크래핑 전용 로거
export const scrapingLogger = logger.child({ module: 'scraping' });

// API 전용 로거  
export const apiLogger = logger.child({ module: 'api' });

// 유틸리티 함수들
export const logScrapingStart = (source: string, jobId: string) => {
  scrapingLogger.info(`스크래핑 시작`, { source, jobId });
};

export const logScrapingComplete = (source: string, jobId: string, articlesCount: number) => {
  scrapingLogger.info(`스크래핑 완료`, { source, jobId, articlesCount });
};

export const logScrapingError = (source: string, jobId: string, error: Error) => {
  scrapingLogger.error(`스크래핑 에러`, { 
    source, 
    jobId, 
    error: error.message, 
    stack: error.stack 
  });
};

export const logApiRequest = (method: string, url: string, ip?: string) => {
  apiLogger.info(`API 요청`, { method, url, ip });
};

export const logApiError = (method: string, url: string, error: Error, ip?: string) => {
  apiLogger.error(`API 에러`, { 
    method, 
    url, 
    ip, 
    error: error.message, 
    stack: error.stack 
  });
}; 
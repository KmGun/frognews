import OpenAI from 'openai';
import { scrapingLogger } from './logger';

// Rate limit 설정 (GPT-4.1 기준)
const RATE_LIMITS = {
  TOKENS_PER_MINUTE: 30000,    // 분당 토큰 한도
  REQUESTS_PER_MINUTE: 500,    // 분당 요청 한도 (일반적인 값)
  BUFFER_RATIO: 0.9,           // 안전 버퍼 (90%만 사용)
};

// 토큰 추정 함수 (대략적인 계산)
function estimateTokens(text: string, maxTokens: number): number {
  // 영어: ~4자 = 1토큰, 한국어: ~2자 = 1토큰으로 추정
  const inputTokens = Math.ceil(text.length / 3); // 보수적으로 계산
  return inputTokens + maxTokens; // 입력 + 출력 토큰
}

// API 요청 정보 인터페이스
interface APIRequest {
  id: string;
  apiCall: () => Promise<any>;
  estimatedTokens: number;
  priority: number; // 우선순위 (낮을수록 높은 우선순위)
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

// 사용량 추적
class UsageTracker {
  private tokenUsage: Array<{ timestamp: number; tokens: number }> = [];
  private requestUsage: Array<{ timestamp: number }> = [];

  addTokenUsage(tokens: number) {
    const now = Date.now();
    this.tokenUsage.push({ timestamp: now, tokens });
    this.cleanOldUsage();
  }

  addRequestUsage() {
    const now = Date.now();
    this.requestUsage.push({ timestamp: now });
    this.cleanOldUsage();
  }

  getCurrentTokenUsage(): number {
    return this.tokenUsage.reduce((sum, usage) => sum + usage.tokens, 0);
  }

  getCurrentRequestCount(): number {
    return this.requestUsage.length;
  }

  getAvailableTokens(): number {
    const used = this.getCurrentTokenUsage();
    const limit = RATE_LIMITS.TOKENS_PER_MINUTE * RATE_LIMITS.BUFFER_RATIO;
    return Math.max(0, limit - used);
  }

  getAvailableRequests(): number {
    const used = this.getCurrentRequestCount();
    const limit = RATE_LIMITS.REQUESTS_PER_MINUTE * RATE_LIMITS.BUFFER_RATIO;
    return Math.max(0, limit - used);
  }

  private cleanOldUsage() {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    this.tokenUsage = this.tokenUsage.filter(usage => usage.timestamp > oneMinuteAgo);
    this.requestUsage = this.requestUsage.filter(usage => usage.timestamp > oneMinuteAgo);
  }

  getTimeUntilReset(): number {
    if (this.tokenUsage.length === 0 && this.requestUsage.length === 0) {
      return 0;
    }
    
    const oldestToken = this.tokenUsage[0]?.timestamp || Date.now();
    const oldestRequest = this.requestUsage[0]?.timestamp || Date.now();
    const oldestTime = Math.min(oldestToken, oldestRequest);
    const resetTime = oldestTime + 60 * 1000; // 1분 후
    
    return Math.max(0, resetTime - Date.now());
  }
}

// 글로벌 OpenAI API 큐 관리자
class GlobalOpenAIQueue {
  private queue: APIRequest[] = [];
  private processing = false;
  private usageTracker = new UsageTracker();
  private lastProcessTime = 0;
  private requestCounter = 0;

  async addRequest<T>(
    apiCall: () => Promise<T>,
    prompt: string,
    maxTokens: number,
    priority: number = 5
  ): Promise<T> {
    const estimatedTokens = estimateTokens(prompt, maxTokens);
    const requestId = `req_${++this.requestCounter}`;

    return new Promise<T>((resolve, reject) => {
      const request: APIRequest = {
        id: requestId,
        apiCall,
        estimatedTokens,
        priority,
        resolve,
        reject,
      };

      // 우선순위에 따라 큐에 삽입
      const insertIndex = this.queue.findIndex(req => req.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      scrapingLogger.debug(`API 요청 큐에 추가: ${requestId} (예상 토큰: ${estimatedTokens}, 큐 길이: ${this.queue.length})`);
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const request = this.queue[0];
        
        // Rate limit 체크
        if (!this.canProcessRequest(request)) {
          const waitTime = this.calculateWaitTime(request);
          if (waitTime > 0) {
            scrapingLogger.info(`Rate limit 대기: ${Math.ceil(waitTime/1000)}초 (요청 ID: ${request.id})`);
            await this.sleep(waitTime);
            continue; // 다시 체크
          }
        }

        // 요청 실행
        try {
          scrapingLogger.debug(`API 요청 실행: ${request.id}`);
          const result = await request.apiCall();
          
          // 사용량 추적
          this.usageTracker.addTokenUsage(request.estimatedTokens);
          this.usageTracker.addRequestUsage();
          this.lastProcessTime = Date.now();

          // 성공 처리
          this.queue.shift(); // 큐에서 제거
          request.resolve(result);
          
          scrapingLogger.debug(`API 요청 완료: ${request.id} (남은 큐: ${this.queue.length})`);

          // 요청 간 최소 간격 보장 (QPS 제한)
          await this.sleep(100); // 100ms = 초당 최대 10회

        } catch (error) {
          this.queue.shift(); // 큐에서 제거
          
          // Rate limit 에러인 경우 큐 앞쪽에 다시 추가
          if (this.isRateLimitError(error as Error)) {
            scrapingLogger.warn(`Rate limit 에러, 큐 앞쪽에 재추가: ${request.id}`);
            this.queue.unshift(request);
            
            // 에러 메시지에서 대기 시간 추출
            const retryAfter = this.extractRetryAfterFromError((error as Error).message);
            await this.sleep(retryAfter || 2000); // 최소 2초 대기
            continue;
          }
          
          // 다른 에러는 실패 처리
          request.reject(error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private canProcessRequest(request: APIRequest): boolean {
    const availableTokens = this.usageTracker.getAvailableTokens();
    const availableRequests = this.usageTracker.getAvailableRequests();
    
    return (
      request.estimatedTokens <= availableTokens &&
      availableRequests > 0
    );
  }

  private calculateWaitTime(request: APIRequest): number {
    const availableTokens = this.usageTracker.getAvailableTokens();
    const availableRequests = this.usageTracker.getAvailableRequests();
    
    if (request.estimatedTokens > availableTokens || availableRequests <= 0) {
      return this.usageTracker.getTimeUntilReset();
    }
    
    return 0;
  }

  private isRateLimitError(error: Error): boolean {
    return error.message?.includes('Rate limit') || 
           error.message?.includes('429') ||
           (error as any).status === 429;
  }

  private extractRetryAfterFromError(errorMessage: string): number | null {
    const match = errorMessage.match(/try again in (\d+(?:\.\d+)?)s/);
    if (match) {
      return Math.ceil(parseFloat(match[1]) * 1000);
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 큐 상태 정보
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      currentTokenUsage: this.usageTracker.getCurrentTokenUsage(),
      availableTokens: this.usageTracker.getAvailableTokens(),
      currentRequestCount: this.usageTracker.getCurrentRequestCount(),
      availableRequests: this.usageTracker.getAvailableRequests(),
      timeUntilReset: this.usageTracker.getTimeUntilReset(),
    };
  }
}

// 전역 큐 인스턴스
const globalQueue = new GlobalOpenAIQueue();

// 외부에서 사용할 함수
export async function callOpenAIWithQueue<T>(
  apiCall: () => Promise<T>,
  prompt: string,
  maxTokens: number,
  priority: number = 5
): Promise<T> {
  return globalQueue.addRequest(apiCall, prompt, maxTokens, priority);
}

// 큐 상태 조회
export function getQueueStatus() {
  return globalQueue.getQueueStatus();
}

// 기존 함수들 (하위 호환성)
export async function callOpenAIWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  // 간단한 프롬프트로 추정 (정확하지 않지만 하위 호환성 위해)
  return callOpenAIWithQueue(apiCall, "default prompt", 100, 5);
}

export async function addApiCallDelay(delayMs: number = 500): Promise<void> {
  // 글로벌 큐에서 자동으로 딜레이 관리하므로 빈 함수
  return Promise.resolve();
} 
import OpenAI from 'openai';
import { ENV, AI_DETECTION_CONFIG } from '../config';
import { scrapingLogger } from './logger';

// OpenAI 클라이언트 초기화
const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

// AI 관련 게시물 판단 결과 인터페이스
export interface AIContentDetectionResult {
  isAIRelated: boolean;
  confidence: number;
  reason?: string;
}

// AI 관련 게시물인지 판단하는 함수
export async function detectAIContent(text: string): Promise<AIContentDetectionResult> {
  try {
    if (!ENV.OPENAI_API_KEY) {
      scrapingLogger.warn('OpenAI API 키가 설정되지 않았습니다. AI 관련 게시물 판단을 건너뜁니다.');
      return { isAIRelated: false, confidence: 0 };
    }

    scrapingLogger.info('AI 관련 게시물 판단 시작');
    
    const prompt = `다음 텍스트가 AI(인공지능) 관련 내용인지 판단해주세요. 
    
포함되는 내용 (넓게 판단):
- AI 기술, 머신러닝, 딥러닝
- AI 서비스, 제품, 애플리케이션
- 오픈소스 AI 프로젝트
- AI 산업 동향, 뉴스
- AI 연구, 논문, 발표
- AI 회사, 스타트업 소식
- LLM, ChatGPT, GPT 등 언어모델
- 컴퓨터 비전, 자연어처리
- 로봇공학, 자율주행
- 코딩, 프로그래밍 (AI 관련 맥락에서)
- 기술 트렌드 (AI와 관련된 경우)
- 교육, 강의 (AI 관련 내용)

YES 또는 NO로만 답변하세요.

텍스트: "${text}"`;

    const response = await client.chat.completions.create({
      model: AI_DETECTION_CONFIG.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: AI_DETECTION_CONFIG.maxTokens,
      temperature: AI_DETECTION_CONFIG.temperature
    });
    
    const result = response.choices[0]?.message?.content?.trim();
    
    if (!result) {
      scrapingLogger.error('AI 판단 결과가 비어있습니다.');
      return { isAIRelated: false, confidence: 0 };
    }
    
    // 결과 파싱
    const isYes = result.toUpperCase() === 'YES';
    
    scrapingLogger.info(`AI 관련 게시물 판단 완료: ${isYes ? 'YES' : 'NO'}`);
    
    return {
      isAIRelated: isYes,
      confidence: isYes ? 0.8 : 0.2, // 단순화된 신뢰도
      reason: undefined
    };
    
  } catch (error) {
    scrapingLogger.error('AI 관련 게시물 판단 실패:', error as Error);
    return { isAIRelated: false, confidence: 0 };
  }
}

// AI 관련 게시물 판단 가능 여부 확인
export function canDetectAIContent(): boolean {
  return !!ENV.OPENAI_API_KEY;
} 

// 트위터용 카테고리 태깅 프롬프트 (aitimes와 동일)
export async function detectTweetCategory(text: string): Promise<number> {
  try {
    if (!ENV.OPENAI_API_KEY) return 5;
    const prompt = `아래는 트위터 게시물입니다. 이 트윗이 어떤 카테고리에 속하는지 1~5 중 하나의 숫자만 골라서 답변해줘. 반드시 숫자만 출력해야 해.\n\n[카테고리 정의]\n1. 오픈소스 : 개발자들이 실제로 사용할 수 있는, 경량 모델 공개, 오픈소스 모델공개 등에 대한 것들.\n2. 서비스 : 일반인이 사용할 수 있는 상용 AI 서비스에 대한 이야기. 예) Claude 신규 기능 출시, X에서 Grok4 신규 공개 등\n3. 연구 : 대학원이나 기업에서 연구 수준에 그친 느낌.\n4. 비즈니스 / 산업 : 정부 투자, AI 법/정책, 대기업/산업/계약/투자/시장/정책 등\n5. 기타 : 위 1~4에 해당하지 않는 경우\n\n포괄적으로 생각해서 분류하지말고, 좁고 깐깐하게 1~4를 분류해줘. 1~4에 확실히 해당되지 않으면 5번이야.\n\n[트윗]\n${text}\n\n카테고리 번호(1~5)만 답변: `;
    const response = await client.chat.completions.create({
      model: AI_DETECTION_CONFIG.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0.1
    });
    const result = response.choices[0]?.message?.content?.trim() || '5';
    const match = result.match(/[1-5]/);
    return match ? parseInt(match[0]) : 5;
  } catch {
    return 5;
  }
} 
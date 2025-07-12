import OpenAI from 'openai';
import { ENV } from '../config';
import { scrapingLogger } from './logger';

// OpenAI 클라이언트 초기화
const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

// 언어 감지 함수
export function detectLanguage(text: string): 'ko' | 'en' | 'other' {
  // 한국어 패턴 검사
  const koreanPattern = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
  const koreanCount = (text.match(koreanPattern) || []).length;
  
  // 영어 패턴 검사
  const englishPattern = /[a-zA-Z]/g;
  const englishCount = (text.match(englishPattern) || []).length;
  
  const totalChars = text.length;
  const koreanRatio = koreanCount / totalChars;
  const englishRatio = englishCount / totalChars;
  
  if (koreanRatio > 0.3) {
    return 'ko';
  } else if (englishRatio > 0.5) {
    return 'en';
  } else {
    return 'other';
  }
}

// 트위터 게시물 번역 함수
export async function translateTweetToKorean(text: string): Promise<string | null> {
  try {
    // 언어 감지
    const detectedLang = detectLanguage(text);
    
    // 한국어면 번역하지 않음
    if (detectedLang === 'ko') {
      scrapingLogger.info('한국어 게시물이므로 번역하지 않습니다.');
      return null;
    }
    
    // 영어가 아니면 번역하지 않음
    if (detectedLang !== 'en') {
      scrapingLogger.info('영어가 아닌 게시물이므로 번역하지 않습니다.');
      return null;
    }
    
    scrapingLogger.info('영어 게시물 번역 시작');
    
    const prompt = `트위터 게시물인데, 말투나 원문 내용을 흐리지 않고 한국어로 자연스럽게 번역해라. 
모바일 브라우저에서의 가독성을 위해 적절한 위치에 줄바꿈(\\n)을 추가해서 읽기 쉽게 만들어라.
긴 문장은 의미 단위로 나누고, 문맥상 자연스러운 곳에서 줄바꿈을 넣어라.
결과물은 번역 결과물 텍스트만 출력할것.

원문: ${text}`;

    const response = await client.responses.create({
      model: "gpt-4.1",
      input: prompt
    });
    
    const translatedText = response.output_text?.trim();
    
    if (!translatedText) {
      scrapingLogger.error('번역 결과가 비어있습니다.');
      return null;
    }
    
    scrapingLogger.info('번역 완료');
    return translatedText;
    
  } catch (error) {
    scrapingLogger.error('번역 실패:', error as Error);
    return null;
  }
}

// 번역 가능 여부 확인
export function canTranslate(): boolean {
  return !!ENV.OPENAI_API_KEY;
} 
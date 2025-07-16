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

// 트위터 게시물 번역 함수 (미디어 정보 포함)
export async function translateTweetToKorean(text: string, mediaItems?: any[], externalLinks?: any[]): Promise<string | null> {
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
    
    // 1. 원문에서 링크 추출 및 플레이스홀더로 치환
    const linkPattern = /https?:\/\/[^\s]+/g;
    const originalLinks: string[] = [];
    let textForTranslation = text;
    
    // 링크를 찾아서 저장하고 플레이스홀더로 치환
    const linkMatches = text.match(linkPattern) || [];
    linkMatches.forEach((link, index) => {
      originalLinks.push(link);
      textForTranslation = textForTranslation.replace(link, `__LINK_${index}__`);
    });
    
    // 2. 미디어 및 외부 링크 정보를 컨텍스트로 추가
    let mediaContext = '';
    if (mediaItems && mediaItems.length > 0) {
      const imageCount = mediaItems.filter(item => item.type === 'image').length;
      const videoCount = mediaItems.filter(item => item.type === 'video').length;
      const gifCount = mediaItems.filter(item => item.type === 'gif').length;
      
      const mediaParts = [];
      if (imageCount > 0) mediaParts.push(`이미지 ${imageCount}개`);
      if (videoCount > 0) mediaParts.push(`동영상 ${videoCount}개`);
      if (gifCount > 0) mediaParts.push(`GIF ${gifCount}개`);
      
      if (mediaParts.length > 0) {
        mediaContext = `\n\n참고: 이 트위터 게시물에는 ${mediaParts.join(', ')}가 첨부되어 있습니다.`;
      }
    }
    
    if (externalLinks && externalLinks.length > 0) {
      const linkTitles = externalLinks
        .filter(link => link.title)
        .map(link => `"${link.title}"`)
        .slice(0, 2); // 최대 2개까지만
        
      if (linkTitles.length > 0) {
        mediaContext += `\n외부 링크: ${linkTitles.join(', ')} 등이 포함되어 있습니다.`;
      }
    }
    
    scrapingLogger.info(`발견된 링크 수: ${originalLinks.length}개, 미디어: ${mediaItems?.length || 0}개, 외부링크: ${externalLinks?.length || 0}개`);
    
    const prompt = `다음 트위터 게시물을 한국어로 자연스럽게 번역해주세요.
원문의 말투와 내용을 유지하면서 모바일에서 읽기 쉽도록 줄바꿈을 적절히 해주세요.
__LINK_숫자__ 형태의 텍스트는 그대로 유지해주세요.${mediaContext}

원문: ${textForTranslation}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });
    
    const translatedText = response.choices[0]?.message?.content?.trim();
    
    if (!translatedText) {
      scrapingLogger.error('번역 결과가 비어있습니다.');
      return null;
    }
    
    // 3. 번역된 텍스트에서 플레이스홀더를 원본 링크로 복원
    let finalText = translatedText;
    originalLinks.forEach((link, index) => {
      finalText = finalText.replace(`__LINK_${index}__`, link);
    });
    
    // \n 문자열이 포함되어 있다면 실제 줄바꿈으로 변환
    const cleanedText = finalText.replace(/\\n/g, '\n');
    
    scrapingLogger.info(`번역 완료 (링크 ${originalLinks.length}개 복원)`);
    return cleanedText;
    
  } catch (error) {
    scrapingLogger.error('번역 실패:', error as Error);
    return null;
  }
}

// 번역 가능 여부 확인
export function canTranslate(): boolean {
  return !!ENV.OPENAI_API_KEY;
} 
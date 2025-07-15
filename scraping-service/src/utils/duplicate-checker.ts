import { supabase } from './supabase';
import { scrapingLogger } from './logger';

/**
 * 기존 DB에 있는 URL들을 필터링하여 새로운 URL만 반환
 */
export async function filterNewUrls(urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];

  try {
    scrapingLogger.info(`URL 중복 체크 시작: ${urls.length}개 URL 검사 중...`);
    
    // DB에서 기존 URL들 조회 (IN 쿼리 사용)
    const { data: existingArticles, error } = await supabase
      .from('articles')
      .select('url')
      .in('url', urls);

    if (error) {
      scrapingLogger.error('URL 중복 체크 실패:', error);
      return urls; // 에러 시 모든 URL 반환 (안전장치)
    }

    // 기존 URL 집합 생성
    const existingUrls = new Set(existingArticles?.map(article => article.url) || []);
    
    // 새로운 URL만 필터링
    const newUrls = urls.filter(url => !existingUrls.has(url));
    
    const duplicateCount = urls.length - newUrls.length;
    scrapingLogger.info(`✅ URL 중복 체크 완료: 전체 ${urls.length}개 중 새로운 URL ${newUrls.length}개 (중복 ${duplicateCount}개 제외)`);
    
    if (duplicateCount > 0) {
      scrapingLogger.info(`⚡ 스크래핑 효율성: ${Math.round((duplicateCount / urls.length) * 100)}% 작업량 절약`);
    }
    
    return newUrls;
  } catch (error) {
    scrapingLogger.error('URL 중복 체크 중 예외 발생:', error);
    return urls; // 에러 시 모든 URL 반환
  }
}

/**
 * 트윗 ID 중복 체크
 */
export async function filterNewTweetIds(tweetIds: string[]): Promise<string[]> {
  if (tweetIds.length === 0) return [];

  try {
    scrapingLogger.info(`트윗 ID 중복 체크 시작: ${tweetIds.length}개 ID 검사 중...`);
    
    const { data: existingTweets, error } = await supabase
      .from('tweets')
      .select('id')
      .in('id', tweetIds);

    if (error) {
      scrapingLogger.error('트윗 ID 중복 체크 실패:', error);
      return tweetIds;
    }

    const existingIds = new Set(existingTweets?.map(tweet => tweet.id) || []);
    const newIds = tweetIds.filter(id => !existingIds.has(id));
    
    const duplicateCount = tweetIds.length - newIds.length;
    scrapingLogger.info(`✅ 트윗 ID 중복 체크 완료: 전체 ${tweetIds.length}개 중 새로운 ID ${newIds.length}개 (중복 ${duplicateCount}개 제외)`);
    
    if (duplicateCount > 0) {
      scrapingLogger.info(`⚡ 트윗 스크래핑 효율성: ${Math.round((duplicateCount / tweetIds.length) * 100)}% 작업량 절약`);
    }
    
    return newIds;
  } catch (error) {
    scrapingLogger.error('트윗 ID 중복 체크 중 예외 발생:', error);
    return tweetIds;
  }
}

/**
 * 유튜브 영상 ID 중복 체크
 */
export async function filterNewVideoIds(videoIds: string[]): Promise<string[]> {
  if (videoIds.length === 0) return [];

  try {
    scrapingLogger.info(`유튜브 영상 ID 중복 체크 시작: ${videoIds.length}개 ID 검사 중...`);
    
    const { data: existingVideos, error } = await supabase
      .from('youtube_videos')
      .select('id')
      .in('id', videoIds);

    if (error) {
      scrapingLogger.error('유튜브 영상 ID 중복 체크 실패:', error);
      return videoIds;
    }

    const existingIds = new Set(existingVideos?.map(video => video.id) || []);
    const newIds = videoIds.filter(id => !existingIds.has(id));
    
    const duplicateCount = videoIds.length - newIds.length;
    scrapingLogger.info(`✅ 유튜브 영상 ID 중복 체크 완료: 전체 ${videoIds.length}개 중 새로운 ID ${newIds.length}개 (중복 ${duplicateCount}개 제외)`);
    
    if (duplicateCount > 0) {
      scrapingLogger.info(`⚡ 유튜브 스크래핑 효율성: ${Math.round((duplicateCount / videoIds.length) * 100)}% 작업량 절약`);
    }
    
    return newIds;
  } catch (error) {
    scrapingLogger.error('유튜브 영상 ID 중복 체크 중 예외 발생:', error);
    return videoIds;
  }
}

/**
 * 트위터 URL에서 트윗 ID 추출
 */
export function extractTweetIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  } catch (error) {
    scrapingLogger.error('트윗 ID 추출 실패:', error);
    return null;
  }
}

/**
 * 유튜브 URL에서 영상 ID 추출
 */
export function extractVideoIdFromUrl(url: string): string | null {
  try {
    // youtube.com/watch?v=ID 형태
    let match = url.match(/[?&]v=([^&#]*)/);
    if (match) return match[1];
    
    // youtu.be/ID 형태
    match = url.match(/youtu\.be\/([^?&#]*)/);
    if (match) return match[1];
    
    // youtube.com/embed/ID 형태
    match = url.match(/youtube\.com\/embed\/([^?&#]*)/);
    if (match) return match[1];
    
    return null;
  } catch (error) {
    scrapingLogger.error('유튜브 영상 ID 추출 실패:', error);
    return null;
  }
}

/**
 * 성능 메트릭 계산
 */
export interface PerformanceMetrics {
  totalItems: number;
  newItems: number;
  duplicateItems: number;
  efficiencyPercentage: number;
  timeSaved: string;
  costSaved: string;
}

export function calculatePerformanceMetrics(
  totalCount: number,
  newCount: number,
  avgProcessingTimePerItem: number = 3, // 기본 3초/아이템
  avgCostPerItem: number = 0.03 // 기본 $0.03/아이템
): PerformanceMetrics {
  const duplicateCount = totalCount - newCount;
  const efficiencyPercentage = totalCount > 0 ? Math.round((duplicateCount / totalCount) * 100) : 0;
  const timeSaved = `${Math.round(duplicateCount * avgProcessingTimePerItem)}초`;
  const costSaved = `$${(duplicateCount * avgCostPerItem).toFixed(3)}`;

  return {
    totalItems: totalCount,
    newItems: newCount,
    duplicateItems: duplicateCount,
    efficiencyPercentage,
    timeSaved,
    costSaved
  };
} 
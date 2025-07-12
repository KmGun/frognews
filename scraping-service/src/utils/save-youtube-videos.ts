import { supabase } from './supabase';
import { logger } from './logger';

export interface YouTubeVideoData {
  id: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  publishedAt: Date;
  duration?: string;
  viewCount?: number;
}

/**
 * 단일 유튜브 영상을 데이터베이스에 저장
 */
export async function saveYouTubeVideo(videoData: YouTubeVideoData): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('youtube_videos')
      .upsert({
        id: videoData.id,
        title: videoData.title,
        thumbnail_url: videoData.thumbnailUrl,
        channel_name: videoData.channelName,
        published_at: videoData.publishedAt.toISOString(),
        duration: videoData.duration,
        view_count: videoData.viewCount,
        scraped_at: new Date().toISOString(),
        is_active: true
      })
      .select();

    if (error) {
      logger.error('유튜브 영상 저장 오류:', error);
      return false;
    }

    logger.info(`유튜브 영상 저장 완료: ${videoData.title} (ID: ${videoData.id})`);
    return true;
  } catch (error) {
    logger.error('유튜브 영상 저장 중 예외 발생:', error);
    return false;
  }
}

/**
 * 여러 유튜브 영상을 데이터베이스에 일괄 저장
 */
export async function saveYouTubeVideos(videosData: YouTubeVideoData[]): Promise<number> {
  if (videosData.length === 0) {
    logger.warn('저장할 유튜브 영상이 없습니다.');
    return 0;
  }

  try {
    const videosToInsert = videosData.map(video => ({
      id: video.id,
      title: video.title,
      thumbnail_url: video.thumbnailUrl,
      channel_name: video.channelName,
      published_at: video.publishedAt.toISOString(),
      duration: video.duration,
      view_count: video.viewCount,
      scraped_at: new Date().toISOString(),
      is_active: true
    }));

    const { data, error } = await supabase
      .from('youtube_videos')
      .upsert(videosToInsert)
      .select();

    if (error) {
      logger.error('유튜브 영상 일괄 저장 오류:', error);
      return 0;
    }

    const savedCount = data?.length || 0;
    logger.info(`유튜브 영상 ${savedCount}개 저장 완료`);
    return savedCount;
  } catch (error) {
    logger.error('유튜브 영상 일괄 저장 중 예외 발생:', error);
    return 0;
  }
}

/**
 * 활성 유튜브 영상 목록 조회
 */
export async function getActiveYouTubeVideos(limit: number = 50): Promise<YouTubeVideoData[]> {
  try {
    const { data, error } = await supabase
      .from('youtube_videos')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('유튜브 영상 조회 오류:', error);
      return [];
    }

    return data?.map(video => ({
      id: video.id,
      title: video.title,
      thumbnailUrl: video.thumbnail_url,
      channelName: video.channel_name,
      publishedAt: new Date(video.published_at),
      duration: video.duration,
      viewCount: video.view_count
    })) || [];
  } catch (error) {
    logger.error('유튜브 영상 조회 중 예외 발생:', error);
    return [];
  }
}

/**
 * 특정 채널의 유튜브 영상 조회
 */
export async function getYouTubeVideosByChannel(channelName: string, limit: number = 20): Promise<YouTubeVideoData[]> {
  try {
    const { data, error } = await supabase
      .from('youtube_videos')
      .select('*')
      .eq('channel_name', channelName)
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(`채널 ${channelName} 유튜브 영상 조회 오류:`, error);
      return [];
    }

    return data?.map(video => ({
      id: video.id,
      title: video.title,
      thumbnailUrl: video.thumbnail_url,
      channelName: video.channel_name,
      publishedAt: new Date(video.published_at),
      duration: video.duration,
      viewCount: video.view_count
    })) || [];
  } catch (error) {
    logger.error(`채널 ${channelName} 유튜브 영상 조회 중 예외 발생:`, error);
    return [];
  }
}

/**
 * 유튜브 영상 비활성화 (삭제 대신)
 */
export async function deactivateYouTubeVideo(videoId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('youtube_videos')
      .update({ is_active: false })
      .eq('id', videoId);

    if (error) {
      logger.error(`유튜브 영상 비활성화 오류 (ID: ${videoId}):`, error);
      return false;
    }

    logger.info(`유튜브 영상 비활성화 완료 (ID: ${videoId})`);
    return true;
  } catch (error) {
    logger.error(`유튜브 영상 비활성화 중 예외 발생 (ID: ${videoId}):`, error);
    return false;
  }
} 
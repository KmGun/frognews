import { supabase } from '../config/supabase';
import {
  AdminArticle,
  AdminTweet,
  AdminYouTubeVideo,
  ParsedArticle,
  ParsedTweet,
  ParsedYouTubeVideo,
  FilterOptions,
  PaginationOptions,
  ContentUpdate,
  BulkApprovalRequest,
  ApiResponse
} from '../types';

// =============================================================================
// 데이터 변환 함수들
// =============================================================================

const convertArticleRowToParsed = (row: AdminArticle): ParsedArticle => {
  try {
    return {
      id: row.id.toString(),
      type: 'article',
      titleSummary: row.title_summary,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      url: row.url,
      imageUrls: JSON.parse(row.image_urls || '[]'),
      summaryLines: JSON.parse(row.summary_lines || '[]'),
      details: JSON.parse(row.details || '[]'),
      category: row.category || 5,
      isApproved: row.is_approved,
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    console.error('기사 데이터 변환 오류:', error, row);
    return {
      id: row.id.toString(),
      type: 'article',
      titleSummary: row.title_summary,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      url: row.url,
      imageUrls: [],
      summaryLines: [],
      details: [],
      category: row.category || 5,
      isApproved: row.is_approved,
      createdAt: new Date(row.created_at),
    };
  }
};

const convertTweetRowToParsed = (row: AdminTweet): ParsedTweet => {
  return {
    id: row.id,
    type: 'tweet',
    text: row.text,
    textKo: row.text_ko || undefined,
    isTranslated: row.is_translated || false,
    translationModel: row.translation_model || undefined,
    translatedAt: row.translated_at ? new Date(row.translated_at) : undefined,
    author: {
      name: row.author_name,
      username: row.author_username,
      profileImageUrl: row.author_profile_image_url || undefined,
    },
    createdAt: new Date(row.created_at),
    url: row.url,
    category: row.category || 5,
    isApproved: row.is_approved,
  };
};

const convertYouTubeRowToParsed = (row: AdminYouTubeVideo): ParsedYouTubeVideo => {
  return {
    id: row.id,
    type: 'youtube',
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    channelName: row.channel_name,
    publishedAt: new Date(row.published_at),
    duration: row.duration || undefined,
    viewCount: row.view_count || undefined,
    category: row.category || 5,
    isApproved: row.is_approved,
  };
};

// =============================================================================
// 기사 관리 API
// =============================================================================

export const articlesApi = {
  // 기사 목록 조회
  async getArticles(
    filters: FilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 20, total: 0 }
  ): Promise<ApiResponse<{ articles: ParsedArticle[]; total: number }>> {
    try {
      let query = supabase.from('articles').select('*', { count: 'exact' });

      // 필터 적용
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.isApproved !== undefined) {
        query = query.eq('is_approved', filters.isApproved);
      }
      if (filters.searchQuery) {
        query = query.ilike('title_summary', `%${filters.searchQuery}%`);
      }
      if (filters.dateRange) {
        query = query.gte('created_at', filters.dateRange.start.toISOString())
                     .lte('created_at', filters.dateRange.end.toISOString());
      }

      // 정렬 및 페이지네이션
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.order('created_at', { ascending: false })
                   .range(offset, offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const articles = (data || []).map(convertArticleRowToParsed);
      
      return {
        success: true,
        data: { articles, total: count || 0 },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('기사 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 단일 기사 조회
  async getArticle(id: string): Promise<ApiResponse<ParsedArticle>> {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: convertArticleRowToParsed(data),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('기사 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 기사 업데이트
  async updateArticle(id: string, updates: Partial<ParsedArticle>): Promise<ApiResponse<ParsedArticle>> {
    try {
      const updateData: any = {};
      
      if (updates.titleSummary !== undefined) updateData.title_summary = updates.titleSummary;
      if (updates.publishedAt !== undefined) updateData.published_at = updates.publishedAt?.toISOString() || null;
      if (updates.imageUrls !== undefined) updateData.image_urls = JSON.stringify(updates.imageUrls);
      if (updates.summaryLines !== undefined) updateData.summary_lines = JSON.stringify(updates.summaryLines);
      if (updates.details !== undefined) updateData.details = JSON.stringify(updates.details);
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.isApproved !== undefined) updateData.is_approved = updates.isApproved;

      const { data, error } = await supabase
        .from('articles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: convertArticleRowToParsed(data),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('기사 업데이트 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 기사 삭제
  async deleteArticle(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: '기사가 삭제되었습니다.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('기사 삭제 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// =============================================================================
// 트위터 관리 API
// =============================================================================

export const tweetsApi = {
  // 트위터 목록 조회
  async getTweets(
    filters: FilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 20, total: 0 }
  ): Promise<ApiResponse<{ tweets: ParsedTweet[]; total: number }>> {
    try {
      let query = supabase.from('tweets').select('*', { count: 'exact' });

      // 필터 적용
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.isApproved !== undefined) {
        query = query.eq('is_approved', filters.isApproved);
      }
      if (filters.searchQuery) {
        query = query.or(`text.ilike.%${filters.searchQuery}%,text_ko.ilike.%${filters.searchQuery}%,author_name.ilike.%${filters.searchQuery}%`);
      }
      if (filters.dateRange) {
        query = query.gte('created_at', filters.dateRange.start.toISOString())
                     .lte('created_at', filters.dateRange.end.toISOString());
      }

      // 정렬 및 페이지네이션
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.order('created_at', { ascending: false })
                   .range(offset, offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const tweets = (data || []).map(convertTweetRowToParsed);
      
      return {
        success: true,
        data: { tweets, total: count || 0 },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('트위터 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 트위터 업데이트
  async updateTweet(id: string, updates: Partial<ParsedTweet>): Promise<ApiResponse<ParsedTweet>> {
    try {
      const updateData: any = {};
      
      if (updates.text !== undefined) updateData.text = updates.text;
      if (updates.textKo !== undefined) updateData.text_ko = updates.textKo;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.isApproved !== undefined) updateData.is_approved = updates.isApproved;

      const { data, error } = await supabase
        .from('tweets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: convertTweetRowToParsed(data),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('트위터 업데이트 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// =============================================================================
// 유튜브 관리 API
// =============================================================================

export const youtubeApi = {
  // 유튜브 목록 조회
  async getVideos(
    filters: FilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 20, total: 0 }
  ): Promise<ApiResponse<{ videos: ParsedYouTubeVideo[]; total: number }>> {
    try {
      let query = supabase.from('youtube_videos').select('*', { count: 'exact' });

      // 필터 적용
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.isApproved !== undefined) {
        query = query.eq('is_approved', filters.isApproved);
      }
      if (filters.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,channel_name.ilike.%${filters.searchQuery}%`);
      }
      if (filters.dateRange) {
        query = query.gte('published_at', filters.dateRange.start.toISOString())
                     .lte('published_at', filters.dateRange.end.toISOString());
      }

      // 정렬 및 페이지네이션
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.order('published_at', { ascending: false })
                   .range(offset, offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const videos = (data || []).map(convertYouTubeRowToParsed);
      
      return {
        success: true,
        data: { videos, total: count || 0 },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('유튜브 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 유튜브 업데이트
  async updateVideo(id: string, updates: Partial<ParsedYouTubeVideo>): Promise<ApiResponse<ParsedYouTubeVideo>> {
    try {
      const updateData: any = {};
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.isApproved !== undefined) updateData.is_approved = updates.isApproved;

      const { data, error } = await supabase
        .from('youtube_videos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: convertYouTubeRowToParsed(data),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('유튜브 업데이트 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// =============================================================================
// 일괄 작업 API
// =============================================================================

export const bulkApi = {
  // 일괄 승인/거부
  async bulkApproval(request: BulkApprovalRequest): Promise<ApiResponse<void>> {
    try {
      const { data, error } = await supabase
        .from(request.contentType)
        .update({ is_approved: request.isApproved })
        .in('id', request.ids);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: `${request.ids.length}개 항목이 ${request.isApproved ? '승인' : '거부'}되었습니다.`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('일괄 승인 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// =============================================================================
// 통계 API
// =============================================================================

export const statsApi = {
  // 대시보드 통계 조회
  async getDashboardStats(): Promise<ApiResponse<{
    articles: { total: number; approved: number; pending: number };
    tweets: { total: number; approved: number; pending: number };
    youtube: { total: number; approved: number; pending: number };
  }>> {
    try {
      const [articlesResult, tweetsResult, youtubeResult] = await Promise.all([
        supabase.from('articles').select('is_approved', { count: 'exact' }),
        supabase.from('tweets').select('is_approved', { count: 'exact' }),
        supabase.from('youtube_videos').select('is_approved', { count: 'exact' }),
      ]);

      if (articlesResult.error || tweetsResult.error || youtubeResult.error) {
        throw new Error('통계 조회 중 오류가 발생했습니다.');
      }

      const articleStats = {
        total: articlesResult.count || 0,
        approved: (articlesResult.data || []).filter(item => item.is_approved).length,
        pending: (articlesResult.data || []).filter(item => !item.is_approved).length,
      };

      const tweetStats = {
        total: tweetsResult.count || 0,
        approved: (tweetsResult.data || []).filter(item => item.is_approved).length,
        pending: (tweetsResult.data || []).filter(item => !item.is_approved).length,
      };

      const youtubeStats = {
        total: youtubeResult.count || 0,
        approved: (youtubeResult.data || []).filter(item => item.is_approved).length,
        pending: (youtubeResult.data || []).filter(item => !item.is_approved).length,
      };

      return {
        success: true,
        data: {
          articles: articleStats,
          tweets: tweetStats,
          youtube: youtubeStats,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('통계 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// 편집 API
export const editApi = {
  // 기사 편집
  async updateArticle(article: ParsedArticle): Promise<ApiResponse> {
    try {
      const { data, error } = await supabase
        .from('articles')
        .update({
          title_summary: article.titleSummary,
          url: article.url,
          image_urls: JSON.stringify(article.imageUrls),
          summary_lines: JSON.stringify(article.summaryLines),
          details: JSON.stringify(article.details),
          category: article.category,
        })
        .eq('id', parseInt(article.id))
        .select();

      if (error) throw error;

      return {
        success: true,
        data: data[0],
        message: '기사가 성공적으로 수정되었습니다.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('기사 수정 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '기사 수정에 실패했습니다.',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 트위터 편집
  async updateTweet(tweet: ParsedTweet): Promise<ApiResponse> {
    try {
      const { data, error } = await supabase
        .from('tweets')
        .update({
          text: tweet.text,
          text_ko: tweet.textKo,
          author_name: tweet.author.name,
          author_username: tweet.author.username,
          author_profile_image_url: tweet.author.profileImageUrl,
          category: tweet.category,
          url: tweet.url,
        })
        .eq('id', tweet.id)
        .select();

      if (error) throw error;

      return {
        success: true,
        data: data[0],
        message: '트위터가 성공적으로 수정되었습니다.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('트위터 수정 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '트위터 수정에 실패했습니다.',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 유튜브 편집
  async updateYouTubeVideo(video: ParsedYouTubeVideo): Promise<ApiResponse> {
    try {
      const { data, error } = await supabase
        .from('youtube_videos')
        .update({
          title: video.title,
          channel_name: video.channelName,
          thumbnail_url: video.thumbnailUrl,
          duration: video.duration,
          view_count: video.viewCount,
          category: video.category,
        })
        .eq('id', video.id)
        .select();

      if (error) throw error;

      return {
        success: true,
        data: data[0],
        message: '유튜브 영상이 성공적으로 수정되었습니다.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('유튜브 영상 수정 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '유튜브 영상 수정에 실패했습니다.',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 유튜브 영상 추가
  addYouTubeVideo: async (videoData: {
    videoId: string;
    title: string;
    channel: string;
    thumbnail: string;
    uploadDate: string;
    duration: string;
    viewCount: number;
    description: string;
    customTitle: string;
    category: number;
  }): Promise<ApiResponse<AdminYouTubeVideo>> => {
    try {
      const { data, error } = await supabase
        .from('youtube_videos')
        .insert({
          id: videoData.videoId, // YouTube 영상 ID는 id 컬럼에 저장
          title: videoData.customTitle, // 커스텀 제목 사용
          channel_name: videoData.channel,
          description: videoData.description,
          thumbnail_url: videoData.thumbnail,
          published_at: videoData.uploadDate,
          view_count: videoData.viewCount,
          like_count: 0,
          comment_count: 0,
          duration: videoData.duration,
          video_url: `https://www.youtube.com/watch?v=${videoData.videoId}`,
          category: videoData.category, // 사용자가 선택한 카테고리
          is_approved: false, // 승인 대기 상태로 추가
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: '유튜브 영상이 성공적으로 추가되었습니다.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('유튜브 영상 추가 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '유튜브 영상 추가에 실패했습니다.',
        timestamp: new Date().toISOString(),
      };
    }
  },
}; 
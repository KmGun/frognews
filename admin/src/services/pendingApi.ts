import { supabase } from '../config/supabase';
import { 
  articlesApi, 
  tweetsApi, 
  youtubeApi, 
  bulkApi 
} from './api';
import { 
  FilterOptions, 
  PaginationOptions, 
  ApiResponse,
  ParsedArticle,
  ParsedTweet,
  ParsedYouTubeVideo
} from '../types';

// 통합 컨텐츠 타입
export interface UnifiedContent {
  id: string;
  type: 'articles' | 'tweets' | 'youtube_videos';
  title: string;
  preview?: string;
  author?: {
    name: string;
    username?: string;
    avatar?: string;
  };
  category?: number;
  createdAt: Date;
  isApproved: boolean;
  url?: string;
  originalData: ParsedArticle | ParsedTweet | ParsedYouTubeVideo;
}

// 통합 필터 옵션
export interface UnifiedFilterOptions extends Omit<FilterOptions, 'contentType'> {
  contentTypes?: ('articles' | 'tweets' | 'youtube_videos')[];
}

export const pendingApi = {
  // 모든 미승인 컨텐츠 조회
  async getPendingContent(
    filters: UnifiedFilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 20, total: 0 }
  ): Promise<ApiResponse<{ content: UnifiedContent[]; total: number }>> {
    try {
      const contentTypes = filters.contentTypes || ['articles', 'tweets', 'youtube_videos'];
      const allContent: UnifiedContent[] = [];
      
      // 기본 필터 설정 (미승인만)
      const baseFilters = {
        ...filters,
        isApproved: false,
      };

      // 각 컨텐츠 타입별로 데이터 조회
      const requests = contentTypes.map(async (type) => {
        switch (type) {
          case 'articles': {
            const response = await articlesApi.getArticles(baseFilters, { page: 1, limit: 1000, total: 0 });
            if (response.success && response.data) {
              return response.data.articles.map((article): UnifiedContent => ({
                id: article.id!,
                type: 'articles',
                title: article.titleSummary,
                preview: article.summaryLines.slice(0, 2).join(' '),
                category: article.category,
                createdAt: article.createdAt!,
                isApproved: article.isApproved,
                url: article.url,
                originalData: article,
              }));
            }
            return [];
          }
          
          case 'tweets': {
            const response = await tweetsApi.getTweets(baseFilters, { page: 1, limit: 1000, total: 0 });
            if (response.success && response.data) {
              return response.data.tweets.map((tweet): UnifiedContent => ({
                id: tweet.id,
                type: 'tweets',
                title: tweet.text.length > 100 ? tweet.text.substring(0, 100) + '...' : tweet.text,
                preview: tweet.textKo || tweet.text,
                author: {
                  name: tweet.author.name,
                  username: tweet.author.username,
                  avatar: tweet.author.profileImageUrl,
                },
                category: tweet.category,
                createdAt: tweet.createdAt,
                isApproved: tweet.isApproved,
                url: tweet.url,
                originalData: tweet,
              }));
            }
            return [];
          }
          
          case 'youtube_videos': {
            const response = await youtubeApi.getVideos(baseFilters, { page: 1, limit: 1000, total: 0 });
            if (response.success && response.data) {
              return response.data.videos.map((video): UnifiedContent => ({
                id: video.id,
                type: 'youtube_videos',
                title: video.title,
                preview: `${video.channelName} • ${video.duration || ''} • 조회수 ${video.viewCount?.toLocaleString() || 'N/A'}`,
                author: {
                  name: video.channelName,
                },
                category: video.category,
                createdAt: video.publishedAt,
                isApproved: video.isApproved,
                originalData: video,
              }));
            }
            return [];
          }
          
          default:
            return [];
        }
      });

      const results = await Promise.all(requests);
      const flatContent = results.flat();
      
      // 검색 필터 적용
      let filteredContent = flatContent;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filteredContent = flatContent.filter(item =>
          item.title.toLowerCase().includes(query) ||
          (item.preview && item.preview.toLowerCase().includes(query)) ||
          (item.author?.name && item.author.name.toLowerCase().includes(query))
        );
      }

      // 카테고리 필터 적용
      if (filters.category) {
        filteredContent = filteredContent.filter(item => item.category === filters.category);
      }

      // 날짜 필터 적용
      if (filters.dateRange) {
        filteredContent = filteredContent.filter(item => {
          const itemDate = item.createdAt;
          return itemDate >= filters.dateRange!.start && itemDate <= filters.dateRange!.end;
        });
      }

      // 최신순 정렬
      filteredContent.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // 페이지네이션 적용
      const total = filteredContent.length;
      const startIndex = (pagination.page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      const paginatedContent = filteredContent.slice(startIndex, endIndex);

      return {
        success: true,
        data: {
          content: paginatedContent,
          total,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('미승인 컨텐츠 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 단일 컨텐츠 승인
  async approveContent(id: string, type: 'articles' | 'tweets' | 'youtube_videos'): Promise<ApiResponse<void>> {
    try {
      let response;
      
      switch (type) {
        case 'articles':
          response = await articlesApi.updateArticle(id, { isApproved: true });
          break;
        case 'tweets':
          response = await tweetsApi.updateTweet(id, { isApproved: true });
          break;
        case 'youtube_videos':
          response = await youtubeApi.updateVideo(id, { isApproved: true });
          break;
        default:
          throw new Error('지원하지 않는 컨텐츠 타입입니다.');
      }

      if (response.success) {
        return {
          success: true,
          message: '컨텐츠가 승인되었습니다.',
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new Error(response.error || '승인 처리 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('컨텐츠 승인 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 단일 컨텐츠 삭제
  async rejectContent(id: string, type: 'articles' | 'tweets' | 'youtube_videos'): Promise<ApiResponse<void>> {
    try {
      let response;
      
      switch (type) {
        case 'articles':
          response = await articlesApi.deleteArticle(id);
          break;
        case 'tweets':
          // 트위터는 삭제 대신 is_approved = false로 유지할 수도 있음
          response = await supabase.from('tweets').delete().eq('id', id);
          break;
        case 'youtube_videos':
          response = await supabase.from('youtube_videos').delete().eq('id', id);
          break;
        default:
          throw new Error('지원하지 않는 컨텐츠 타입입니다.');
      }

      return {
        success: true,
        message: '컨텐츠가 삭제되었습니다.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('컨텐츠 삭제 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 일괄 승인
  async bulkApprove(items: Array<{ id: string; type: 'articles' | 'tweets' | 'youtube_videos' }>): Promise<ApiResponse<void>> {
    try {
      // 타입별로 그룹화
      const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.type]) {
          acc[item.type] = [];
        }
        acc[item.type].push(item.id);
        return acc;
      }, {} as Record<string, string[]>);

      // 각 타입별로 일괄 승인 요청
      const requests = Object.entries(groupedItems).map(([type, ids]) =>
        bulkApi.bulkApproval({
          contentType: type as 'articles' | 'tweets' | 'youtube_videos',
          ids,
          isApproved: true,
        })
      );

      const results = await Promise.all(requests);
      const failedRequests = results.filter(result => !result.success);

      if (failedRequests.length > 0) {
        throw new Error('일부 항목의 승인 처리에 실패했습니다.');
      }

      return {
        success: true,
        message: `${items.length}개 항목이 승인되었습니다.`,
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

  // 일괄 삭제
  async bulkReject(items: Array<{ id: string; type: 'articles' | 'tweets' | 'youtube_videos' }>): Promise<ApiResponse<void>> {
    try {
      // 타입별로 그룹화하여 삭제
      const requests = items.map(item => 
        this.rejectContent(item.id, item.type)
      );

      const results = await Promise.all(requests);
      const failedRequests = results.filter(result => !result.success);

      if (failedRequests.length > 0) {
        throw new Error('일부 항목의 삭제 처리에 실패했습니다.');
      }

      return {
        success: true,
        message: `${items.length}개 항목이 삭제되었습니다.`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('일괄 삭제 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      };
    }
  },
}; 
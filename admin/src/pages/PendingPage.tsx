import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { 
  Card, 
  Button, 
  Flex, 
  Text, 
  LoadingSpinner
} from '../styles/GlobalStyle';
import { Pagination } from '../components/common/Pagination';
import ContentCard from '../components/common/ContentCard';
import { AddYouTubeModal } from '../components/common/AddYouTubeModal';
import { 
  pendingApi, 
  UnifiedContent, 
  UnifiedFilterOptions 
} from '../services/pendingApi';
import { FilterOptions, PaginationOptions, ParsedArticle, ParsedTweet, ParsedYouTubeVideo } from '../types';
import { editApi } from '../services/api';

const PendingContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: 640px) {
    width: 100%;
    justify-content: stretch;
    
    button {
      flex: 1;
    }
  }
`;

const FilterSection = styled(Card)`
  padding: 1rem;
`;

const BulkActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
`;

const BulkInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const BulkControls = styled.div`
  display: flex;
  gap: 0.5rem;

  @media (max-width: 640px) {
    width: 100%;
    
    button {
      flex: 1;
    }
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #64748b;
`;

const ContentTypeFilter = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const TypeToggle = styled.button<{ isActive: boolean }>`
  padding: 0.5rem 1rem;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: ${props => props.isActive ? '#3b82f6' : 'white'};
  color: ${props => props.isActive ? 'white' : '#64748b'};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.isActive ? '#2563eb' : '#f8fafc'};
  }
`;

export const PendingPage: React.FC = () => {
  const [content, setContent] = useState<UnifiedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  
  // 필터 상태
  const [filters, setFilters] = useState<UnifiedFilterOptions>({
    contentTypes: ['articles', 'tweets', 'youtube_videos'],
  });
  
  // 페이지네이션 상태
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    limit: 20,
    total: 0,
  });

  // 컨텐츠 로딩
  const loadContent = async () => {
    try {
      setLoading(true);
      const response = await pendingApi.getPendingContent(filters, pagination);
      
      if (response.success) {
        setContent(response.data?.content || []);
        setPagination(prev => ({
          ...prev,
          total: response.data?.total || 0,
        }));
      } else {
        toast.error(response.error || '컨텐츠를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('컨텐츠 로딩 오류:', error);
      toast.error('컨텐츠를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 페이지 로드 시 컨텐츠 로딩
  useEffect(() => {
    loadContent();
  }, [filters, pagination.page, pagination.limit]);

  // 선택 항목 관리
  const handleSelect = (id: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(content.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  // 개별 승인
  const handleApprove = async (id: string, contentType: string) => {
    try {
      const response = await pendingApi.approveContent(
        id, 
        contentType as 'articles' | 'tweets' | 'youtube_videos'
      );

      if (response.success) {
        toast.success(response.message || '승인되었습니다.');
        // 목록에서 제거
        setContent(prev => prev.filter(item => item.id !== id));
        setSelectedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        // 총 개수 업데이트
        setPagination(prev => ({ ...prev, total: prev.total - 1 }));
      } else {
        toast.error(response.error || '승인에 실패했습니다.');
      }
    } catch (error) {
      console.error('승인 오류:', error);
      toast.error('승인 중 오류가 발생했습니다.');
    }
  };

  // 개별 거부
  const handleReject = async (id: string, contentType: string) => {
    try {
      const response = await pendingApi.rejectContent(
        id, 
        contentType as 'articles' | 'tweets' | 'youtube_videos'
      );

      if (response.success) {
        toast.success(response.message || '거부되었습니다.');
        // 목록에서 제거
        setContent(prev => prev.filter(item => item.id !== id));
        setSelectedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        // 총 개수 업데이트
        setPagination(prev => ({ ...prev, total: prev.total - 1 }));
      } else {
        toast.error(response.error || '거부에 실패했습니다.');
      }
    } catch (error) {
      console.error('거부 오류:', error);
      toast.error('거부 중 오류가 발생했습니다.');
    }
  };

  // 일괄 승인
  const handleBulkApprove = async () => {
    if (selectedItems.size === 0) {
      toast.error('승인할 항목을 선택해주세요.');
      return;
    }

    try {
      setBulkActionLoading(true);
      
      const items = Array.from(selectedItems).map(id => {
        const item = content.find(c => c.id === id);
        return { id, type: item!.type };
      });

      const response = await pendingApi.bulkApprove(items);
      
      if (response.success) {
        toast.success(response.message || '일괄 승인되었습니다.');
        setContent(prev => prev.filter(item => !selectedItems.has(item.id)));
        setPagination(prev => ({ ...prev, total: prev.total - selectedItems.size }));
        setSelectedItems(new Set());
      } else {
        toast.error(response.error || '일괄 승인에 실패했습니다.');
      }
    } catch (error) {
      console.error('일괄 승인 오류:', error);
      toast.error('일괄 승인 중 오류가 발생했습니다.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // 일괄 거부
  const handleBulkReject = async () => {
    if (selectedItems.size === 0) {
      toast.error('거부할 항목을 선택해주세요.');
      return;
    }

    try {
      setBulkActionLoading(true);
      
      const items = Array.from(selectedItems).map(id => {
        const item = content.find(c => c.id === id);
        return { id, type: item!.type };
      });

      const response = await pendingApi.bulkReject(items);
      
      if (response.success) {
        toast.success(response.message || '일괄 거부되었습니다.');
        setContent(prev => prev.filter(item => !selectedItems.has(item.id)));
        setPagination(prev => ({ ...prev, total: prev.total - selectedItems.size }));
        setSelectedItems(new Set());
      } else {
        toast.error(response.error || '일괄 거부에 실패했습니다.');
      }
    } catch (error) {
      console.error('일괄 거부 오류:', error);
      toast.error('일괄 거부 중 오류가 발생했습니다.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // 유튜브 영상 추가
  const handleAddYouTubeVideo = async (videoInfo: {
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
  }) => {
    try {
      const response = await editApi.addYouTubeVideo(videoInfo);
      
      if (response.success) {
        toast.success('유튜브 영상이 추가되었습니다.');
        // 목록 새로고침
        await loadContent();
      } else {
        toast.error(response.error || '영상 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('유튜브 영상 추가 오류:', error);
      toast.error('영상 추가 중 오류가 발생했습니다.');
    }
  };

  // 인라인 편집 저장
  const handleSave = async (updatedContent: ParsedArticle | ParsedTweet | ParsedYouTubeVideo) => {
    try {
      let response;
      
      switch (updatedContent.type) {
        case 'article':
          response = await editApi.updateArticle(updatedContent as ParsedArticle);
          break;
        case 'tweet':
          response = await editApi.updateTweet(updatedContent as ParsedTweet);
          break;
        case 'youtube':
          response = await editApi.updateYouTubeVideo(updatedContent as ParsedYouTubeVideo);
          break;
        default:
          throw new Error('지원되지 않는 컨텐츠 타입입니다.');
      }

      if (response.success) {
        toast.success(response.message || '편집이 완료되었습니다.');
        // 목록 새로고침
        loadContent();
      } else {
        toast.error(response.error || '편집에 실패했습니다.');
      }
    } catch (error) {
      console.error('편집 오류:', error);
      toast.error('편집 중 오류가 발생했습니다.');
    }
  };

  // 필터 변경
  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setFilters({ contentTypes: ['articles', 'tweets', 'youtube_videos'] });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 컨텐츠 타입 필터 토글
  const toggleContentType = (type: 'articles' | 'tweets' | 'youtube_videos') => {
    setFilters(prev => {
      const currentTypes = prev.contentTypes || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter(t => t !== type)
        : [...currentTypes, type];
      
      return { ...prev, contentTypes: newTypes };
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const allSelected = content.length > 0 && selectedItems.size === content.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < content.length;

  return (
    <PendingContainer>
      <PageHeader>
        <HeaderInfo>
          <Text size="xl" weight="bold" as="h1">FrogNews 어드민</Text>
          <Text color="muted">
            총 {pagination.total}개의 컨텐츠가 승인을 기다리고 있습니다.
          </Text>
        </HeaderInfo>
        
        <HeaderActions>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsYouTubeModalOpen(true)}
          >
            📹 유튜브 추가
          </Button>
          
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleResetFilters}
          >
            필터 초기화
          </Button>
          
          <Button 
            variant="primary" 
            size="sm" 
            onClick={loadContent}
            disabled={loading}
          >
            새로고침
          </Button>
        </HeaderActions>
      </PageHeader>

      {/* 컨텐츠 타입 필터 */}
      <FilterSection>
        <Text weight="medium" style={{ marginBottom: '1rem', display: 'block' }}>
          컨텐츠 타입
        </Text>
                 <ContentTypeFilter>
           <TypeToggle
             isActive={filters.contentTypes?.includes('articles') || false}
             onClick={() => toggleContentType('articles')}
           >
             📰 기사
           </TypeToggle>
           <TypeToggle
             isActive={filters.contentTypes?.includes('tweets') || false}
             onClick={() => toggleContentType('tweets')}
           >
             🐦 트위터
           </TypeToggle>
           <TypeToggle
             isActive={filters.contentTypes?.includes('youtube_videos') || false}
             onClick={() => toggleContentType('youtube_videos')}
           >
             📺 유튜브
           </TypeToggle>
         </ContentTypeFilter>
      </FilterSection>

      {/* 일괄 작업 */}
      {content.length > 0 && (
        <BulkActions>
          <BulkInfo>
            <input
              type="checkbox"
              checked={allSelected}
              ref={input => {
                if (input) input.indeterminate = someSelected;
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            <Text size="sm">
              {selectedItems.size > 0 
                ? `${selectedItems.size}개 항목 선택됨` 
                : '전체 선택'}
            </Text>
          </BulkInfo>
          
          {selectedItems.size > 0 && (
            <BulkControls>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkApprove}
                disabled={bulkActionLoading}
              >
                일괄 승인
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkReject}
                disabled={bulkActionLoading}
              >
                일괄 거부
              </Button>
            </BulkControls>
          )}
        </BulkActions>
      )}

      {loading ? (
        <Card padding="3rem">
          <Flex justify="center" align="center">
            <LoadingSpinner />
            <Text color="muted">로딩 중...</Text>
          </Flex>
        </Card>
      ) : content.length === 0 ? (
        <EmptyState>
          <Text size="lg" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
            승인 대기 중인 컨텐츠가 없습니다.
          </Text>
          <Text color="muted">
            모든 컨텐츠가 승인되었거나 필터 조건에 맞는 컨텐츠가 없습니다.
          </Text>
        </EmptyState>
      ) : (
        <>
          <ContentGrid>
            {content.map((item) => {
              // originalData를 사용하여 정확한 타입으로 변환
              let contentData;
              
              if (item.type === 'articles') {
                contentData = {
                  ...(item.originalData as any),
                  type: 'article' as const,
                };
              } else if (item.type === 'tweets') {
                contentData = {
                  ...(item.originalData as any),
                  type: 'tweet' as const,
                };
              } else {
                contentData = {
                  ...(item.originalData as any),
                  type: 'youtube' as const,
                };
              }

              return (
                <ContentCard
                  key={`${item.type}-${item.id}`}
                  content={contentData}
                  onApprove={(id: string) => handleApprove(id, item.type)}
                  onReject={(id: string) => handleReject(id, item.type)}
                  onSave={handleSave}
                  isSelected={selectedItems.has(item.id)}
                  onSelect={handleSelect}
                />
              );
            })}
          </ContentGrid>

          <Pagination
            currentPage={pagination.page}
            totalPages={Math.ceil(pagination.total / pagination.limit)}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
          />
        </>
      )}

      <AddYouTubeModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onSubmit={handleAddYouTubeVideo}
      />
    </PendingContainer>
  );
}; 
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Article, Tweet, YouTubeVideo, CATEGORIES } from '../types';
import { articleApi, tweetApi, youtubeApi } from '../services/api';
import { useReadArticles } from '../hooks/useReadArticles';
import { useScrollPosition } from '../hooks/useScrollPosition';

import Header from '../components/Header';
import CategoryTags from '../components/CategoryTags';
import ArticleCard from '../components/ArticleCard';
import TwitterCard from '../components/TwitterCard';
import YouTubeCard from '../components/YouTubeCard';
import LoadingSpinner from '../components/LoadingSpinner';

const MainContainer = styled.div`
  min-height: 100vh;
  background-color: #0a0a0a;
  width: 100%;
  overflow: visible;
`;

const Content = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
  overflow: visible;
`;

const Timeline = styled.div`
  margin-top: 30px;
  position: relative;
  width: 100%;
  overflow: visible;
  
  @media (max-width: 768px) {
    margin-top: 20px;
  }
`;

const TimelineItem = styled.div`
  margin-bottom: 35px;
  position: relative;
  
  @media (max-width: 768px) {
    margin-bottom: 25px;
  }
`;

const TimelineHeader = styled.div`
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  position: relative;
`;

const TimelineLeft = styled.div`
  display: flex;
  align-items: flex-start;
  margin-right: 15px;
  position: relative;
  
  @media (max-width: 768px) {
    margin-right: 10px;
  }
`;

const TimelineDot = styled.div`
  width: 8px;
  height: 8px;
  background-color: #1da1f2;
  border-radius: 50%;
  margin-right: 12px;
  margin-top: 6px;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px #0a0a0a;
  
  &.article {
    background-color: #ff6b6b;
  }
  
  &.tweet {
    background-color: #1da1f2;
  }
  
  &.youtube {
    background-color: #ff0000;
  }
`;

const TimelineTimeInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 60px;
  
  @media (max-width: 768px) {
    min-width: 50px;
  }
`;

const TimelineTime = styled.div`
  color: #888;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  margin-bottom: 2px;
  
  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const TimelineDate = styled.div`
  color: #666;
  font-size: 10px;
  
  @media (max-width: 768px) {
    font-size: 9px;
  }
`;

const TimelineLine = styled.div`
  position: absolute;
  left: 4px;
  top: 18px;
  bottom: -23px;
  width: 1px;
  background-color: #333;
  
  @media (max-width: 768px) {
    bottom: -18px;
  }
  
  &:last-child {
    display: none;
  }
`;

const TimelineContent = styled.div`
  flex: 1;
  margin-left: 20px;
  
  @media (max-width: 768px) {
    margin-left: 15px;
  }
`;

const ContentGroup = styled.div`
  margin-bottom: 25px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  text-align: center;
  padding: 20px;
  font-size: 16px;
`;


// 컨텐츠 타입 정의
type ContentItem = {
  type: 'article' | 'tweet' | 'youtube';
  data: Article | Tweet | YouTubeVideo;
  timestamp: Date;
};

// 날짜별 그룹 타입 정의
type DateGroup = {
  date: string;
  items: ContentItem[];
};

const MainPage: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [youtubeVideos, setYouTubeVideos] = useState<YouTubeVideo[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { readArticleIds, refreshReadArticles } = useReadArticles();
  const { saveCurrentPosition, restoreScrollPosition } = useScrollPosition('main-page');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterArticles();
  }, [articles, selectedCategory, readArticleIds]);

  // 데이터 로딩 완료 후 스크롤 복원 (간단한 버전)
  useEffect(() => {
    if (!loading && !error && articles.length > 0) {
      // 데이터가 모두 로드된 후 스크롤 복원
      console.log('📊 MainPage: 데이터 로딩 완료, 스크롤 복원 시도');
      const timeoutId = setTimeout(() => {
        restoreScrollPosition();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [loading, error, articles.length, restoreScrollPosition]);

  const filterArticles = () => {
    let filtered = articles;

    // 카테고리 필터링
    if (selectedCategory !== null) {
      filtered = filtered.filter(article => article.category === selectedCategory);
    }

    // 읽은 기사 자동 숨기기
    filtered = filtered.filter(article => !readArticleIds.includes(article.id || ''));

    setFilteredArticles(filtered);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 기사, 트위터, 유튜브 데이터를 병렬로 조회
      const [articlesData, tweetsData, youtubeData] = await Promise.all([
        articleApi.getArticles(),
        tweetApi.getTweets(),
        youtubeApi.getVideos()
      ]);
      
      setArticles(articlesData);
      setTweets(tweetsData);
      setYouTubeVideos(youtubeData);
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error('데이터 로딩 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: number | null) => {
    setSelectedCategory(category);
  };

  const handleArticleClick = (article: Article) => {
    console.log('MainPage handleArticleClick 호출됨:', article.titleSummary);
    
    // 현재 스크롤 위치 저장 (hook의 메서드 사용)
    saveCurrentPosition();
    
    console.log('navigate 호출:', `/article/${article.id}`);
    navigate(`/article/${article.id}`, { state: { article } });
    
    // 기사 클릭 시 나중에 읽은 기사 목록을 다시 로드할 수 있도록 이벤트 리스너 추가
    // (기사 페이지에서 돌아올 때 읽은 기사 목록이 업데이트됨)
    const handleFocus = () => {
      refreshReadArticles();
      window.removeEventListener('focus', handleFocus);
    };
    window.addEventListener('focus', handleFocus);
  };

  const handleTweetClick = (tweet: Tweet) => {
    window.open(tweet.url, '_blank');
  };

  // 시간 포맷팅 함수
  const formatTime = (date: Date): { time: string; date: string } => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    let timeText = '';
    if (days > 0) {
      timeText = `${days}일 전`;
    } else if (hours > 0) {
      timeText = `${hours}시간 전`;
    } else if (minutes > 0) {
      timeText = `${minutes}분 전`;
    } else {
      timeText = '방금 전';
    }
    
    const dateText = date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
    
    return { time: timeText, date: dateText };
  };

  // 기사, 트위터, 유튜브를 시간순으로 정렬하여 통합
  const getSortedContent = (): ContentItem[] => {
    const contentItems: ContentItem[] = [];
    
    // 필터링된 기사들 추가
    filteredArticles.forEach(article => {
      contentItems.push({
        type: 'article',
        data: article,
        timestamp: article.publishedAt || article.createdAt || new Date(0)
      });
    });
    
    // 트위터 게시물들 추가 (카테고리 필터링 적용)
    tweets
      .filter(tweet => selectedCategory === null || tweet.category === selectedCategory)
      .forEach(tweet => {
        contentItems.push({
          type: 'tweet',
          data: tweet,
          timestamp: tweet.createdAt
        });
      });

    // 유튜브 영상은 기존처럼 카테고리 필터링 없이 추가
    if (selectedCategory === null) {
      youtubeVideos.forEach(video => {
        contentItems.push({
          type: 'youtube',
          data: video,
          timestamp: video.publishedAt
        });
      });
    }
    
    // 시간순으로 정렬 (최신순)
    return contentItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  // 날짜별로 그룹화
  const getGroupedContent = (): DateGroup[] => {
    const sortedContent = getSortedContent();
    const groups: { [key: string]: ContentItem[] } = {};
    
    sortedContent.forEach(item => {
      const now = new Date();
      const diff = now.getTime() - item.timestamp.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      let dateKey: string;
      if (days === 0) {
        // 오늘은 시간대별로 세분화
        if (minutes < 1) {
          dateKey = '방금 전';
        } else if (minutes < 60) {
          dateKey = `${minutes}분 전`;
        } else {
          dateKey = `${hours}시간 전`;
        }
      } else if (days === 1) {
        dateKey = '어제';
      } else {
        dateKey = `${days}일 전`;
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });
    
    // 날짜 순서대로 정렬
    const sortedGroups: DateGroup[] = Object.entries(groups)
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => {
        // 시간 순서대로 정렬 (최신순)
        const getTimeValue = (dateStr: string): number => {
          if (dateStr === '방금 전') return 0;
          if (dateStr.includes('분 전')) {
            return parseInt(dateStr.replace('분 전', ''));
          }
          if (dateStr.includes('시간 전')) {
            return parseInt(dateStr.replace('시간 전', '')) * 60;
          }
          if (dateStr === '어제') return 24 * 60;
          if (dateStr.includes('일 전')) {
            return parseInt(dateStr.replace('일 전', '')) * 24 * 60;
          }
          return 0;
        };
        
        return getTimeValue(a.date) - getTimeValue(b.date);
      });
    
    return sortedGroups;
  };

  if (loading) {
    return (
      <MainContainer>
        <Header />
        <Content>
          <LoadingSpinner />
        </Content>
      </MainContainer>
    );
  }

  if (error) {
    return (
      <MainContainer>
        <Header />
        <Content>
          <ErrorMessage>{error}</ErrorMessage>
        </Content>
      </MainContainer>
    );
  }

  const groupedContent = getGroupedContent();

  return (
    <MainContainer>
      <Header />
      <Content>
        <CategoryTags
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
        />
        <Timeline>
          {groupedContent.map((group, groupIndex) => {
            const isLast = groupIndex === groupedContent.length - 1;
            
            return (
              <TimelineItem key={group.date}>
                {!isLast && <TimelineLine />}
                <TimelineHeader>
                  <TimelineLeft>
                    <TimelineDot />
                    <TimelineTimeInfo>
                      <TimelineTime>{group.date}</TimelineTime>
                    </TimelineTimeInfo>
                  </TimelineLeft>
                </TimelineHeader>
                <TimelineContent>
                  {group.items.map((item, itemIndex) => {
                    return (
                      <ContentGroup key={`${item.type}-${(item.data as any).id}-${itemIndex}`}>
                        {item.type === 'article' && (
                          <ArticleCard
                            article={item.data as Article}
                            onClick={() => handleArticleClick(item.data as Article)}
                          />
                        )}
                        {item.type === 'tweet' && (
                          <>
                            <TwitterCard
                              tweet={item.data as Tweet}
                              onClick={() => handleTweetClick(item.data as Tweet)}
                            />
                          </>
                        )}
                        {item.type === 'youtube' && (
                          <YouTubeCard
                            video={item.data as YouTubeVideo}
                          />
                        )}
                      </ContentGroup>
                    );
                  })}
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </Timeline>
      </Content>
    </MainContainer>
  );
};

export default MainPage; 
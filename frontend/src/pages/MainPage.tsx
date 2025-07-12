import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Article, Tweet, YouTubeVideo, CATEGORIES } from '../types';
import { articleApi, tweetApi, youtubeApi } from '../services/api';

import Header from '../components/Header';
import CategoryTags from '../components/CategoryTags';
import ArticleCard from '../components/ArticleCard';
import TwitterCard from '../components/TwitterCard';
import YouTubeCard from '../components/YouTubeCard';
import LoadingSpinner from '../components/LoadingSpinner';

const MainContainer = styled.div`
  min-height: 100vh;
  background-color: #0a0a0a;
`;

const Content = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const ArticleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 30px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
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

const MainPage: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [youtubeVideos, setYouTubeVideos] = useState<YouTubeVideo[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCategory === null) {
      setFilteredArticles(articles);
    } else {
      setFilteredArticles(articles.filter(article => article.category === selectedCategory));
    }
  }, [articles, selectedCategory]);

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
    navigate(`/article/${article.id}`, { state: { article } });
  };

  const handleTweetClick = (tweet: Tweet) => {
    window.open(tweet.url, '_blank');
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
    
    // 트위터 게시물들 추가 (카테고리 필터링 시에는 제외)
    if (selectedCategory === null) {
      tweets.forEach(tweet => {
        contentItems.push({
          type: 'tweet',
          data: tweet,
          timestamp: tweet.createdAt
        });
      });

      // 유튜브 영상들 추가 (카테고리 필터링 시에는 제외)
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

  const sortedContent = getSortedContent();

  return (
    <MainContainer>
      <Header />
      <Content>
        <CategoryTags
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
        />
        <ArticleGrid>
          {sortedContent.map((item, index) => {
            if (item.type === 'article') {
              const article = item.data as Article;
              return (
                <ArticleCard
                  key={`article-${article.id}-${index}`}
                  article={article}
                  onClick={() => handleArticleClick(article)}
                />
              );
            } else if (item.type === 'tweet') {
              const tweet = item.data as Tweet;
              return (
                <TwitterCard
                  key={`tweet-${tweet.id}-${index}`}
                  tweet={tweet}
                  onClick={() => handleTweetClick(tweet)}
                />
              );
            } else if (item.type === 'youtube') {
              const video = item.data as YouTubeVideo;
              return (
                <YouTubeCard
                  key={`youtube-${video.id}-${index}`}
                  video={video}
                />
              );
            }
            return null;
          })}
        </ArticleGrid>
      </Content>
    </MainContainer>
  );
};

export default MainPage; 
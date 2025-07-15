import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Article, CATEGORIES } from '../types';
import { articleApi } from '../services/api';
import Header from '../components/Header';
import ImageCarousel from '../components/ImageCarousel';
import SummarySection from '../components/SummarySection';
import LoadingSpinner from '../components/LoadingSpinner';
import { useReadTracker } from '../hooks/useReadTracker';

const ArticleContainer = styled.div`
  min-height: 100vh;
  background-color: #0a0a0a;
  width: 100%;
  overflow: visible;
`;

const Content = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
  overflow: visible;
`;

const BackButton = styled.button`
  color: #10b981;
  font-size: 16px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    color: #059669;
  }
`;

const ArticleHeader = styled.div`
  margin-bottom: 30px;
`;

const CategoryTag = styled.div<{ color: string }>`
  display: inline-block;
  background-color: ${props => props.color};
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
`;

const Title = styled.h1`
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0 0 16px 0;
`;

const ArticleInfo = styled.div`
  display: flex;
  gap: 16px;
  color: #888;
  font-size: 14px;
  margin-bottom: 30px;
`;

const OriginalLink = styled.a`
  color: #10b981;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  text-align: center;
  padding: 20px;
  font-size: 16px;
`;

const ArticlePage: React.FC = () => {
  const { articleId } = useParams<{ articleId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 읽기 추적 훅
  const { isTracking } = useReadTracker({
    articleId: articleId || '',
    enabled: !!articleId && !loading && !error
  });

  useEffect(() => {
    // 먼저 state에서 article을 가져옵니다
    if (location.state?.article) {
      setArticle(location.state.article);
      setLoading(false);
    } else if (articleId) {
      // state에 없다면 API에서 가져옵니다
      fetchArticle(articleId);
    } else {
      setError('기사 ID가 없습니다.');
      setLoading(false);
    }
  }, [articleId, location.state]);

  const fetchArticle = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // 개별 기사 조회 API 사용
      const foundArticle = await articleApi.getArticle(id);
      
      if (foundArticle) {
        setArticle(foundArticle);
      } else {
        setError('기사를 찾을 수 없습니다.');
      }
    } catch (err) {
      setError('기사를 불러오는 중 오류가 발생했습니다.');
      console.error('기사 로딩 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // 브라우저의 뒤로가기 사용 (스크롤 위치 복원을 위해)
    window.history.back();
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getCategoryInfo = (category: number | undefined) => {
    if (!category || !CATEGORIES[category as keyof typeof CATEGORIES]) {
      return CATEGORIES[5];
    }
    return CATEGORIES[category as keyof typeof CATEGORIES];
  };

  if (loading) {
    return (
      <ArticleContainer>
        <Header />
        <Content>
          <LoadingSpinner />
        </Content>
      </ArticleContainer>
    );
  }

  if (error || !article) {
    return (
      <ArticleContainer>
        <Header />
        <Content>
          <BackButton onClick={handleBack}>
            ← 뒤로 가기
          </BackButton>
          <ErrorMessage>{error || '기사를 찾을 수 없습니다.'}</ErrorMessage>
        </Content>
      </ArticleContainer>
    );
  }

  const categoryInfo = getCategoryInfo(article.category);

  return (
    <ArticleContainer>
      <Header />
      <Content>
        <BackButton onClick={handleBack}>
          ← 뒤로 가기
        </BackButton>
        
        <ArticleHeader>
          <CategoryTag color={categoryInfo.color}>
            {categoryInfo.name}
          </CategoryTag>
          <Title>{article.titleSummary}</Title>
          <ArticleInfo>
            <span>{formatDate(article.publishedAt)}</span>
            <OriginalLink href={article.url} target="_blank" rel="noopener noreferrer">
              원문 보기
            </OriginalLink>
          </ArticleInfo>
        </ArticleHeader>

        {article.imageUrls && article.imageUrls.length > 0 && (
          <ImageCarousel
            images={article.imageUrls}
            title={article.titleSummary}
          />
        )}

        <SummarySection
          summaryLines={article.summaryLines}
          details={article.details}
        />
      </Content>
    </ArticleContainer>
  );
};

export default ArticlePage; 
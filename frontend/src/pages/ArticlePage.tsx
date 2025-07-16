import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import styled from "styled-components";
import { Article, CATEGORIES } from "../types";
import { articleApi } from "../services/api";
import Header from "../components/Header";
import ImageCarousel from "../components/ImageCarousel";
import SummarySection from "../components/SummarySection";
import LoadingSpinner from "../components/LoadingSpinner";
import { useReadTracker } from "../hooks/useReadTracker";

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
  background-color: ${(props) => props.color};
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

  // MainPage에서 전달된 state 확인
  useEffect(() => {
    console.log("ArticlePage location.state:", location.state);

    if (location.state?.article) {
      console.log("전달받은 article:", location.state.article);
      console.log("전달받은 from:", location.state.from);
      console.log("전달받은 scrollPosition:", location.state.scrollPosition);
      console.log("전달받은 timestamp:", location.state.timestamp);
    }
  }, [location.state]);

  // 읽기 추적 훅
  const { isTracking } = useReadTracker({
    articleId: articleId || "",
    enabled: !!articleId && !loading && !error,
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
      setError("기사 ID가 없습니다.");
      setLoading(false);
    }
  }, [articleId, location.state]);

  // 페이지 진입 시 스크롤을 맨 위로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchArticle = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // 개별 기사 조회 API 사용
      const foundArticle = await articleApi.getArticle(id);

      if (foundArticle) {
        setArticle(foundArticle);
      } else {
        setError("기사를 찾을 수 없습니다.");
      }
    } catch (err) {
      setError("기사를 불러오는 중 오류가 발생했습니다.");
      console.error("기사 로딩 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // 단순하게 메인페이지로 이동
    navigate("/");
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getCategoryInfo = (category: number | undefined) => {
    if (!category || !CATEGORIES[category as keyof typeof CATEGORIES]) {
      return CATEGORIES[5];
    }
    return CATEGORIES[category as keyof typeof CATEGORIES];
  };

  // 메타 태그를 위한 정보 생성
  const getMetaInfo = () => {
    if (!article) return null;

    const title = article.titleSummary || "FrogNews";
    const description =
      article.summaryLines?.slice(0, 2).join(" ") || "AI 기반 뉴스 요약 서비스";
    const image =
      article.imageUrls && article.imageUrls.length > 0
        ? article.imageUrls[0]
        : null;
    const url = `${window.location.origin}/article/${article.id}`;

    return { title, description, image, url };
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
          <BackButton onClick={handleBack}>← 뒤로 가기</BackButton>
          <ErrorMessage>{error || "기사를 찾을 수 없습니다."}</ErrorMessage>
        </Content>
      </ArticleContainer>
    );
  }

  const categoryInfo = getCategoryInfo(article.category);
  const metaInfo = getMetaInfo();

  return (
    <ArticleContainer>
      {metaInfo && (
        <Helmet>
          <title>{metaInfo.title} - FrogNews</title>
          <meta name="description" content={metaInfo.description} />

          {/* Open Graph 메타 태그 (카카오톡, 페이스북 등) */}
          <meta property="og:type" content="article" />
          <meta property="og:title" content={metaInfo.title} />
          <meta property="og:description" content={metaInfo.description} />
          <meta property="og:url" content={metaInfo.url} />
          <meta property="og:site_name" content="FrogNews" />
          {metaInfo.image && (
            <meta property="og:image" content={metaInfo.image} />
          )}
          {metaInfo.image && <meta property="og:image:width" content="1200" />}
          {metaInfo.image && <meta property="og:image:height" content="630" />}

          {/* 트위터 카드 메타 태그 */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={metaInfo.title} />
          <meta name="twitter:description" content={metaInfo.description} />
          {metaInfo.image && (
            <meta name="twitter:image" content={metaInfo.image} />
          )}

          {/* 카카오톡 특화 메타 태그 */}
          <meta property="kakao:title" content={metaInfo.title} />
          <meta property="kakao:description" content={metaInfo.description} />
          {metaInfo.image && (
            <meta property="kakao:image" content={metaInfo.image} />
          )}
        </Helmet>
      )}
      <Header />
      <Content>
        <BackButton onClick={handleBack}>← 뒤로 가기</BackButton>

        <ArticleHeader>
          <CategoryTag color={categoryInfo.color}>
            {categoryInfo.name}
          </CategoryTag>
          <Title>{article.titleSummary}</Title>
          <ArticleInfo>
            <span>{formatDate(article.publishedAt)}</span>
            {/* <OriginalLink
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              원문 보기
            </OriginalLink> */}
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

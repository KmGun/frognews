import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import styled from "styled-components";
import {
  Article,
  Tweet,
  YouTubeVideo,
  CATEGORIES,
  FeedbackSubmission,
} from "../types";
import { useReadArticles } from "../hooks/useReadArticles";
import { useAllDataQuery } from "../hooks/useArticlesQuery";
import { userService } from "../services/userService";

import Header from "../components/Header";
import CategoryTags from "../components/CategoryTags";
import ArticleCard from "../components/ArticleCard";
import TwitterCard from "../components/TwitterCard";
import YouTubeCard from "../components/YouTubeCard";
import FeedbackButton from "../components/FeedbackButton";
import FeedbackModal from "../components/FeedbackModal";

const MainContainer = styled.div`
  height: 100vh;
  background-color: #0a0a0a;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
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
  background-color: #4ade80;
  border-radius: 50%;
  margin-right: 12px;
  margin-top: 6px;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px #0a0a0a;

  &.article {
    background-color: #4ade80;
  }

  &.tweet {
    background-color: #4ade80;
  }

  &.youtube {
    background-color: #4ade80;
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
  type: "article" | "tweet" | "youtube";
  data: Article | Tweet | YouTubeVideo;
  timestamp: Date;
};

// 날짜별 그룹 타입 정의
type DateGroup = {
  date: string;
  items: ContentItem[];
};

const MainPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { readArticleIds, refreshReadArticles, markAsClicked, isArticleRead } =
    useReadArticles();

  // React Query로 데이터 가져오기 (자동 캐싱!)
  const { articles, tweets, youtubeVideos, isLoading, error, isError } =
    useAllDataQuery();

  // 카드 ref들을 저장할 Map
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // bottomSheet ref 추가
  const bottomSheetRef = useRef<HTMLDivElement>(null);

  // 페이지가 포커스를 받을 때마다 읽은 기사 목록 새로고침
  useEffect(() => {
    const handleFocus = () => {
      console.log(
        "페이지가 포커스를 받았습니다. 읽은 기사 목록을 새로고침합니다."
      );
      refreshReadArticles();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log(
          "페이지가 다시 보이게 되었습니다. 읽은 기사 목록을 새로고침합니다."
        );
        refreshReadArticles();
      }
    };

    const handlePopState = () => {
      console.log(
        "브라우저 뒤로가기/앞으로가기가 감지되었습니다. 읽은 기사 목록을 새로고침합니다."
      );
      refreshReadArticles();
    };

    // 윈도우 포커스 이벤트
    window.addEventListener("focus", handleFocus);
    // 페이지 가시성 변경 이벤트
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // 브라우저 뒤로가기/앞으로가기 이벤트
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [refreshReadArticles]);

  // location이 변경될 때마다 읽은 기사 목록 새로고침 (ArticlePage에서 돌아올 때)
  useEffect(() => {
    console.log("Location이 변경되었습니다. 읽은 기사 목록을 새로고침합니다.");
    refreshReadArticles();
  }, [location.pathname, refreshReadArticles]);

  // filteredArticles를 useMemo로 직접 계산
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    // 카테고리 필터링
    if (selectedCategory !== null) {
      filtered = filtered.filter(
        (article) => article.category === selectedCategory
      );
    }

    return filtered;
  }, [articles, selectedCategory]);

  // 스크롤 위치 저장 (페이지 이탈 시)
  useEffect(() => {
    const saveScrollPosition = () => {
      if (bottomSheetRef.current) {
        sessionStorage.setItem(
          "mainPageScrollPosition",
          String(bottomSheetRef.current.scrollTop)
        );
      }
    };

    // 페이지 이탈 시 스크롤 위치 저장
    window.addEventListener("beforeunload", saveScrollPosition);

    // 컴포넌트 언마운트 시에도 저장
    return () => {
      saveScrollPosition();
      window.removeEventListener("beforeunload", saveScrollPosition);
    };
  }, []);

  // 스크롤 위치 복원 (sessionStorage만 사용)
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem(
      "mainPageScrollPosition"
    );
    if (savedScrollPosition && bottomSheetRef.current) {
      setTimeout(() => {
        bottomSheetRef.current!.scrollTop = parseInt(savedScrollPosition, 10);
      }, 0);
    }
  }, [location]);

  const handleCategorySelect = (category: number | null) => {
    setSelectedCategory(category);
  };

  const handleArticleClick = (article: Article) => {
    // 클릭 즉시 어둡게 표시
    markAsClicked(article.id!);

    // 현재 스크롤 위치를 sessionStorage에 저장
    const currentScrollPosition = bottomSheetRef.current?.scrollTop || 0;
    sessionStorage.setItem(
      "mainPageScrollPosition",
      String(currentScrollPosition)
    );

    // 네비게이션 (state 정보 간소화)
    navigate(`/article/${article.id}`, {
      state: {
        article,
        from: location.pathname,
        timestamp: Date.now(),
      },
    });
  };

  const handleTweetClick = (tweet: Tweet) => {
    window.open(tweet.url, "_blank");
  };

  const handleFeedbackSubmit = async (feedback: FeedbackSubmission) => {
    try {
      await userService.submitFeedback(feedback);
      console.log("피드백이 성공적으로 제출되었습니다:", feedback);
    } catch (error) {
      console.error("피드백 제출 중 오류:", error);
      throw error; // 모달에서 에러 처리를 위해 다시 throw
    }
  };

  // 기사, 트위터, 유튜브를 시간순으로 정렬하여 통합 (메모이제이션)
  const sortedContent = useMemo((): ContentItem[] => {
    const contentItems: ContentItem[] = [];

    // 필터링된 기사들 추가
    filteredArticles.forEach((article) => {
      contentItems.push({
        type: "article",
        data: article,
        timestamp: article.publishedAt || article.createdAt || new Date(0),
      });
    });

    // 트위터 게시물들 추가 (카테고리 필터링 적용)
    tweets
      .filter(
        (tweet) =>
          selectedCategory === null || tweet.category === selectedCategory
      )
      .forEach((tweet) => {
        contentItems.push({
          type: "tweet",
          data: tweet,
          timestamp: tweet.createdAt,
        });
      });

    // 유튜브 영상은 기존처럼 카테고리 필터링 없이 추가
    if (selectedCategory === null) {
      youtubeVideos.forEach((video) => {
        contentItems.push({
          type: "youtube",
          data: video,
          timestamp: video.publishedAt,
        });
      });
    }

    // 시간순으로 정렬 (최신순)
    return contentItems.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [filteredArticles, tweets, youtubeVideos, selectedCategory]);

  // 날짜별로 그룹화 (메모이제이션)
  const groupedContent = useMemo((): DateGroup[] => {
    const groups: { [key: string]: ContentItem[] } = {};

    sortedContent.forEach((item) => {
      const now = new Date();
      const diff = now.getTime() - item.timestamp.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      let dateKey: string;
      if (days === 0) {
        // 오늘은 시간대별로 세분화
        if (minutes < 1) {
          dateKey = "방금 전";
        } else if (minutes < 60) {
          dateKey = `${minutes}분 전`;
        } else {
          dateKey = `${hours}시간 전`;
        }
      } else if (days === 1) {
        dateKey = "어제";
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
          if (dateStr === "방금 전") return 0;
          if (dateStr.includes("분 전")) {
            return parseInt(dateStr.replace("분 전", ""));
          }
          if (dateStr.includes("시간 전")) {
            return parseInt(dateStr.replace("시간 전", "")) * 60;
          }
          if (dateStr === "어제") return 24 * 60;
          if (dateStr.includes("일 전")) {
            return parseInt(dateStr.replace("일 전", "")) * 24 * 60;
          }
          return 0;
        };

        return getTimeValue(a.date) - getTimeValue(b.date);
      });

    return sortedGroups;
  }, [sortedContent]);

  // 에러 상태 처리
  if (isError) {
    return (
      <MainContainer>
        <Header />
        <Content>
          <ErrorMessage>
            {error?.message || "데이터를 불러오는 중 오류가 발생했습니다."}
          </ErrorMessage>
        </Content>
      </MainContainer>
    );
  }

  return (
    <MainContainer ref={bottomSheetRef}>
      <Helmet>
        <title>FrogNews - AI 기반 뉴스 요약 서비스</title>
        <meta
          name="description"
          content="AI가 엄선한 최신 기술 뉴스를 간결하게 요약해드립니다. 매일 업데이트되는 실시간 뉴스를 확인하세요."
        />

        {/* Open Graph 메타 태그 */}
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="FrogNews - AI 기반 뉴스 요약 서비스"
        />
        <meta
          property="og:description"
          content="AI가 엄선한 최신 기술 뉴스를 간결하게 요약해드립니다. 매일 업데이트되는 실시간 뉴스를 확인하세요."
        />
        <meta property="og:url" content={window.location.origin} />
        <meta property="og:site_name" content="FrogNews" />

        {/* 트위터 카드 메타 태그 */}
        <meta name="twitter:card" content="summary" />
        <meta
          name="twitter:title"
          content="FrogNews - AI 기반 뉴스 요약 서비스"
        />
        <meta
          name="twitter:description"
          content="AI가 엄선한 최신 기술 뉴스를 간결하게 요약해드립니다."
        />
      </Helmet>
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
                      <ContentGroup
                        key={`${item.type}-${
                          (item.data as any).id
                        }-${itemIndex}`}
                      >
                        {item.type === "article" && (
                          <div
                            ref={(el) => {
                              if (el && (item.data as Article).id) {
                                cardRefs.current.set(
                                  (item.data as Article).id!,
                                  el
                                );
                              }
                            }}
                          >
                            <ArticleCard
                              article={item.data as Article}
                              onClick={() =>
                                handleArticleClick(item.data as Article)
                              }
                              isRead={isArticleRead(
                                (item.data as Article).id || ""
                              )}
                            />
                          </div>
                        )}
                        {item.type === "tweet" && (
                          <TwitterCard
                            tweet={item.data as Tweet}
                            onClick={() => handleTweetClick(item.data as Tweet)}
                          />
                        )}
                        {item.type === "youtube" && (
                          <YouTubeCard video={item.data as YouTubeVideo} />
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

      {/* 피드백 버튼 */}
      <FeedbackButton
        onFeedbackClick={() => setIsFeedbackModalOpen(true)}
        readArticleCount={readArticleIds.length}
        minimumReads={10} // 테스트용: 항상 표시
      />

      {/* 피드백 모달 */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </MainContainer>
  );
};

export default MainPage;

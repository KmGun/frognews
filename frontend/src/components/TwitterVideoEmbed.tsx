import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { Tweet } from "../types";

const EmbedContainer = styled.div`
  background-color: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #333;
  overflow: hidden;
  margin: 12px 0;

  /* 트위터 위젯 스타일 오버라이드 */
  .twitter-tweet {
    margin: 0 !important;
    border-radius: 12px !important;
    border: none !important;
    background-color: transparent !important;
  }

  /* 다크 테마 적용 */
  .twitter-tweet iframe {
    border-radius: 12px !important;
  }
`;

const LoadingContainer = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #888;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const LoadingSpinner = styled.div`
  width: 24px;
  height: 24px;
  border: 2px solid #333;
  border-top: 2px solid #1da1f2;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const ErrorContainer = styled.div`
  padding: 20px;
  text-align: center;
  color: #888;
  font-size: 14px;
  border: 1px dashed #333;
  border-radius: 8px;
  margin: 12px;
`;

const FallbackLink = styled.a`
  color: #1da1f2;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

interface TwitterVideoEmbedProps {
  tweet: Tweet;
}

// 트위터 위젯 타입 (any로 처리)

const TwitterVideoEmbed: React.FC<TwitterVideoEmbedProps> = ({ tweet }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  useEffect(() => {
    if (!tweet.hasVideo || !tweet.videoEmbedInfo) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    const loadTwitterWidget = () => {
      if (!containerRef.current) return;

      // 트위터 위젯 스크립트가 이미 로드되어 있는지 확인
      if ((window as any).twttr && (window as any).twttr.widgets) {
        createTweet();
      } else {
        // 트위터 위젯 스크립트 로드
        const script = document.createElement("script");
        script.src = "https://platform.twitter.com/widgets.js";
        script.async = true;
        script.charset = "utf-8";
        script.onload = () => {
          if ((window as any).twttr && (window as any).twttr.ready) {
            (window as any).twttr.ready(createTweet);
          }
        };
        script.onerror = () => {
          setHasError(true);
          setIsLoading(false);
        };
        document.body.appendChild(script);
      }
    };

    const createTweet = async () => {
      if (!containerRef.current || !tweet.videoEmbedInfo) return;

      try {
        // 기존 내용 제거
        containerRef.current.innerHTML = "";

        const tweetElement = await (window as any).twttr.widgets.createTweet(
          tweet.videoEmbedInfo.tweetId,
          containerRef.current,
          {
            theme: "dark",
            align: "center",
            maxWidth: "100%",
            conversation: "none",
            cards: "visible",
            lang: "ko",
          }
        );

        if (tweetElement) {
          setIsLoading(false);
          setHasError(false);
        } else {
          throw new Error("Failed to create tweet embed");
        }
      } catch (error) {
        console.error("트위터 임베드 생성 실패:", error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    loadTwitterWidget();

    // 클린업 함수
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [tweet.hasVideo, tweet.videoEmbedInfo]);

  if (!tweet.hasVideo || !tweet.videoEmbedInfo) {
    return null; // 비디오가 없으면 렌더링하지 않음
  }

  if (hasError) {
    return (
      <ErrorContainer>
        <div>비디오를 불러올 수 없습니다</div>
        <FallbackLink
          href={tweet.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          트위터에서 보기 →
        </FallbackLink>
      </ErrorContainer>
    );
  }

  return (
    <EmbedContainer>
      {isLoading && (
        <LoadingContainer>
          <LoadingSpinner />
          <span>비디오 로딩 중...</span>
        </LoadingContainer>
      )}
      <div ref={containerRef} />
    </EmbedContainer>
  );
};

export default TwitterVideoEmbed;

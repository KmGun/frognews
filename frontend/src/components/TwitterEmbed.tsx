import React from "react";
import styled from "styled-components";
import { Tweet } from "react-tweet";
import { Tweet as TweetType } from "../types";

const EmbedContainer = styled.div`
  background-color: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #333;
  margin-bottom: 20px;

  /* react-tweet 다크테마 스타일 조정 */
  .react-tweet-theme {
    --tweet-container-margin: 0;
  }
`;

const TestLabel = styled.div`
  color: #888;
  font-size: 12px;
  margin-bottom: 10px;
  text-align: center;
  padding: 4px 8px;
  background-color: #2a2a2a;
  border-radius: 4px;
  display: inline-block;
  width: 100%;
  box-sizing: border-box;
`;

interface TwitterEmbedProps {
  tweet: TweetType;
}

const TwitterEmbed: React.FC<TwitterEmbedProps> = ({ tweet }) => {
  // 트윗 URL에서 트윗 ID 추출
  const extractTweetId = (url: string): string | null => {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  };

  const tweetId = extractTweetId(tweet.url);

  if (!tweetId) {
    return (
      <div style={{ color: "#ff6b6b", textAlign: "center", padding: 16 }}>
        ❌ 유효하지 않은 트윗 URL
      </div>
    );
  }

  return (
    <div data-theme="dark">
      <Tweet id={tweetId} />
    </div>
  );
};

export default TwitterEmbed;

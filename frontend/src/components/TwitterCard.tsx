import React, { useState } from 'react';
import styled from 'styled-components';
import { Tweet } from '../types';

const Card = styled.div`
  background-color: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #333;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-color: #555;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const ProfileImage = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
`;

const ProfileImagePlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 18px;
`;

const AuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AuthorName = styled.span`
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
`;

const AuthorUsername = styled.span`
  color: #888;
  font-size: 12px;
`;

const TwitterIcon = styled.div`
  margin-left: auto;
  color: #1da1f2;
  font-size: 20px;
`;

const Content = styled.div`
  color: #ffffff;
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 16px;
  word-wrap: break-word;
  white-space: pre-wrap; /* 줄바꿈 문자(\n)를 실제 줄바꿈으로 표시 */
  word-break: break-word; /* 긴 단어도 줄바꿈 */
  
  @media (max-width: 768px) {
    font-size: 15px;
    line-height: 1.5;
  }
`;

const Link = styled.a`
  color: #1da1f2;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const Mention = styled.a`
  color: #1da1f2;
  text-decoration: none;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ToggleButton = styled.button`
  background: none;
  border: 1px solid #444;
  color: #1da1f2;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;
  
  &:hover {
    background-color: #1da1f2;
    color: #ffffff;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #333;
`;

const Timestamp = styled.span`
  color: #888;
  font-size: 12px;
`;

interface TwitterCardProps {
  tweet: Tweet;
  onClick?: () => void;
}

const TwitterCard: React.FC<TwitterCardProps> = ({ tweet, onClick }) => {
  const [showOriginal, setShowOriginal] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // 텍스트에서 URL과 멘션을 파싱하여 링크로 변환
  const parseTextWithLinks = (text: string) => {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let keyCounter = 0;

    // URL 패턴 개선 - 단어 경계와 공백/줄바꿈으로 끝나는 것만 매치
    const urlRegex = /(https?:\/\/[^\s\u3131-\u3163\uac00-\ud7a3]+|www\.[^\s\u3131-\u3163\uac00-\ud7a3]+)/g;
    // 멘션 패턴 개선 - URL이 아닌 경우에만 매치 (@ 앞에 :// 가 없는 경우)
    const mentionRegex = /(?<!:\/\/)@([a-zA-Z0-9_]+)(?![^\s]*\.[a-zA-Z])/g;
    
    // 모든 매치를 찾아서 위치별로 정렬
    const matches: Array<{
      index: number;
      length: number;
      type: 'url' | 'mention';
      content: string;
      username?: string;
    }> = [];

    let match: RegExpExecArray | null;
    
    // URL 매치 찾기
    while ((match = urlRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        type: 'url',
        content: match[0]
      });
    }

    // 멘션 매치 찾기 (URL과 겹치지 않는 것만)
    while ((match = mentionRegex.exec(text)) !== null) {
      // URL 내부에 있는 @ 인지 확인
      const isInsideUrl = matches.some(urlMatch => 
        urlMatch.type === 'url' && 
        match!.index >= urlMatch.index && 
        match!.index < urlMatch.index + urlMatch.length
      );
      
      if (!isInsideUrl) {
        matches.push({
          index: match.index,
          length: match[0].length,
          type: 'mention',
          content: match[0],
          username: match[1]
        });
      }
    }

    // 위치별로 정렬
    matches.sort((a, b) => a.index - b.index);

    // 겹치는 매치 제거 및 정리
    const filteredMatches = matches.filter((current, index) => {
      if (index === 0) return true;
      const previous = matches[index - 1];
      return current.index >= previous.index + previous.length;
    });

    // 텍스트를 파싱하여 링크와 일반 텍스트로 분리
    filteredMatches.forEach((match) => {
      // 매치 이전의 일반 텍스트 추가
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // 링크 또는 멘션 추가
      if (match.type === 'url') {
        const url = match.content.startsWith('http') ? match.content : `https://${match.content}`;
        const displayText = match.content.replace(/^https?:\/\//, '').replace(/^www\./, '');
        
        parts.push(
          <Link
            key={`url-${keyCounter++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {displayText}
          </Link>
        );
      } else if (match.type === 'mention') {
        parts.push(
          <Mention
            key={`mention-${keyCounter++}`}
            href={`https://twitter.com/${match.username}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {match.content}
          </Mention>
        );
      }

      lastIndex = match.index + match.length;
    });

    // 마지막 남은 텍스트 추가
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  const handleClick = (e: React.MouseEvent) => {
    // 토글 버튼이나 링크 클릭 시 카드 클릭 이벤트 방지
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    
    if (onClick) {
      onClick();
    } else {
      window.open(tweet.url, '_blank');
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOriginal(!showOriginal);
  };

  const displayText = tweet.isTranslated && tweet.textKo && !showOriginal ? tweet.textKo : tweet.text;

  return (
    <Card onClick={handleClick}>
      <Header>
        {tweet.author.profileImageUrl ? (
          <ProfileImage
            src={tweet.author.profileImageUrl}
            alt={tweet.author.name}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <ProfileImagePlaceholder>👤</ProfileImagePlaceholder>
        )}
        <AuthorInfo>
          <AuthorName>{tweet.author.name}</AuthorName>
          <AuthorUsername>@{tweet.author.username}</AuthorUsername>
        </AuthorInfo>
        <TwitterIcon>𝕏</TwitterIcon>
      </Header>
      
      <Content>
        {parseTextWithLinks(displayText)}
      </Content>
      
      <Footer>
        <Timestamp>{formatDate(tweet.createdAt)}</Timestamp>
        {tweet.isTranslated && tweet.textKo && (
          <ToggleButton onClick={handleToggle}>
            {showOriginal ? '번역 보기' : '원문 보기'}
          </ToggleButton>
        )}
      </Footer>
    </Card>
  );
};

export default TwitterCard; 
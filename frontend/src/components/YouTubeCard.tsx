import React, { useState } from 'react';
import styled from 'styled-components';
import { YouTubeVideo } from '../types';

interface YouTubeCardProps {
  video: YouTubeVideo;
}

const Card = styled.div`
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid #2d2d2d;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    border-color: #ff0000;
  }
`;

const ThumbnailContainer = styled.div`
  position: relative;
  height: 200px;
  overflow: hidden;
  cursor: pointer;
`;

const Thumbnail = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  
  ${Card}:hover & {
    transform: scale(1.05);
  }
`;

const VideoPlayer = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

const PlayButton = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  background: rgba(255, 0, 0, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  
  &::after {
    content: '';
    width: 0;
    height: 0;
    border-left: 20px solid white;
    border-top: 12px solid transparent;
    border-bottom: 12px solid transparent;
    margin-left: 4px;
  }
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
    background: rgba(255, 0, 0, 1);
  }
`;

const Duration = styled.div`
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
`;

const Content = styled.div`
  padding: 16px;
`;

const Title = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ChannelName = styled.p`
  color: #888;
  font-size: 14px;
  margin: 0 0 4px 0;
`;

const VideoInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 12px;
`;

const ViewCount = styled.span`
  &::after {
    content: '•';
    margin: 0 4px;
  }
`;

const PublishedAt = styled.span``;

const formatViewCount = (count: number | undefined): string => {
  if (!count) return '조회수 정보 없음';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M회`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K회`;
  }
  return `${count}회`;
};

const formatPublishedAt = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 24) {
    return `${diffInHours}시간 전`;
  } else if (diffInHours < 24 * 7) {
    return `${Math.floor(diffInHours / 24)}일 전`;
  } else if (diffInHours < 24 * 30) {
    return `${Math.floor(diffInHours / (24 * 7))}주 전`;
  } else {
    return `${Math.floor(diffInHours / (24 * 30))}개월 전`;
  }
};

const YouTubeCard: React.FC<YouTubeCardProps> = ({ video }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  // YouTube 임베드 URL 생성
  const embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`;

  return (
    <Card>
      <ThumbnailContainer onClick={handlePlayClick}>
        {isPlaying ? (
          <VideoPlayer
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <Thumbnail src={video.thumbnailUrl} alt={video.title} />
            <PlayButton />
            <Duration>{video.duration}</Duration>
          </>
        )}
      </ThumbnailContainer>
      <Content>
        <Title>{video.title}</Title>
        <ChannelName>{video.channelName}</ChannelName>
        <VideoInfo>
          <ViewCount>{formatViewCount(video.viewCount)}</ViewCount>
          <PublishedAt>{formatPublishedAt(video.publishedAt)}</PublishedAt>
        </VideoInfo>
      </Content>
    </Card>
  );
};

export default YouTubeCard; 
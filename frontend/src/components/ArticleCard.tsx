import React, { useState } from 'react';
import styled from 'styled-components';
import { Article, CATEGORIES } from '../types';

const Card = styled.div`
  background-color: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #333;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-color: #555;
  }
`;

const ImageContainer = styled.div`
  width: 100%;
  height: 200px;
  position: relative;
  overflow: hidden;
`;

const ImageCarousel = styled.div<{ currentIndex: number }>`
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease;
  transform: ${(props) => `translateX(-${props.currentIndex * 100}%)`};
`;

const ImageSlide = styled.div`
  min-width: 100%;
  height: 100%;
  position: relative;
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  
  ${Card}:hover & {
    transform: scale(1.05);
  }
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 48px;
`;

const NavButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  color: #333;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 2;
  
  ${Card}:hover & {
    opacity: 1;
  }
  
  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-50%) scale(1.1);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const PrevButton = styled(NavButton)`
  left: 8px;
`;

const NextButton = styled(NavButton)`
  right: 8px;
`;

const DotsContainer = styled.div`
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  z-index: 2;
`;

const Dot = styled.button<{ active: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: none;
  background: ${(props) => 
    props.active ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.7);
  }
`;

const TitleOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 40px 16px 16px 16px;
`;

const Title = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
`;

interface ArticleCardProps {
  article: Article;
  onClick: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = article.imageUrls || [];
  const hasMultipleImages = images.length > 1;

  // 터치 이벤트 상태
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasSwiped, setHasSwiped] = useState(false);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCurrentImageIndex(index);
  };

  // 카드 클릭 핸들러
  const handleCardClick = (e: React.MouseEvent) => {
    // 스와이프 중이었다면 클릭 이벤트 무시
    if (hasSwiped) {
      e.preventDefault();
      return;
    }
    
    // 기본 동작 방지 (스크롤 방지)
    e.preventDefault();
    e.stopPropagation();
    
    console.log('ArticleCard 클릭됨!', article.titleSummary);
    onClick();
  };

  // 터치 이벤트 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return;
    
    setTouchStartX(e.touches[0].clientX);
    setIsDragging(true);
    setHasSwiped(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!hasMultipleImages || !isDragging) return;
    
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultipleImages || !isDragging) return;
    
    setIsDragging(false);
    
    const swipeThreshold = 50; // 최소 스와이프 거리
    const swipeDistance = touchStartX - touchEndX;
    
    if (Math.abs(swipeDistance) > swipeThreshold) {
      setHasSwiped(true); // 스와이프 발생을 표시
      e.preventDefault(); // 스와이프가 감지된 경우에만 기본 동작 방지
      
      if (swipeDistance > 0) {
        // 왼쪽으로 스와이프 (다음 이미지)
        setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      } else {
        // 오른쪽으로 스와이프 (이전 이미지)
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      }
      
      // 스와이프 상태를 일정 시간 후 초기화
      setTimeout(() => {
        setHasSwiped(false);
      }, 100);
    }
    
    setTouchStartX(0);
    setTouchEndX(0);
  };

  return (
    <Card onClick={handleCardClick}>
      <ImageContainer>
        {images.length > 0 ? (
          <>
            <ImageCarousel 
              currentIndex={currentImageIndex}
            >
              {images.map((imageUrl, index) => (
                <ImageSlide key={index}>
                  <Image
                    src={imageUrl}
                    alt={`${article.titleSummary} - 이미지 ${index + 1}`}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </ImageSlide>
              ))}
            </ImageCarousel>
            
            {hasMultipleImages && (
              <>
                <PrevButton 
                  onClick={handlePrevImage}
                  disabled={currentImageIndex === 0}
                >
                  ‹
                </PrevButton>
                <NextButton 
                  onClick={handleNextImage}
                  disabled={currentImageIndex === images.length - 1}
                >
                  ›
                </NextButton>
                
                <DotsContainer>
                  {images.map((_, index) => (
                    <Dot
                      key={index}
                      active={index === currentImageIndex}
                      onClick={(e) => handleDotClick(e, index)}
                    />
                  ))}
                </DotsContainer>
              </>
            )}
          </>
        ) : (
          <ImagePlaceholder>📰</ImagePlaceholder>
        )}
        
        <TitleOverlay>
          <Title>{article.titleSummary}</Title>
        </TitleOverlay>
      </ImageContainer>
    </Card>
  );
};

export default ArticleCard; 
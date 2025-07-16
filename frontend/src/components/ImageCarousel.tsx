import React, { useState } from 'react';
import styled from 'styled-components';

const CarouselContainer = styled.div`
  position: relative;
  margin: 30px 0;
`;

const ImageContainer = styled.div`
  width: 100%;
  height: 400px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background-color: #1a1a1a;
  touch-action: pan-y; /* 세로 스크롤은 허용하고 가로 스와이프만 제어 */
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 64px;
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
`;

const NavigationButton = styled.button<{ direction: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${props => props.direction === 'left' ? 'left: 16px;' : 'right: 16px;'}
  
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s ease;
  
  /* 데스크톱에서만 표시 */
  @media (min-width: 768px) {
    &:hover {
      background-color: rgba(0, 0, 0, 0.9);
      transform: translateY(-50%) scale(1.1);
    }
  }
  
  /* 모바일에서는 숨김 */
  @media (max-width: 767px) {
    display: none;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      transform: translateY(-50%) scale(1);
    }
  }
`;

const ImageIndicators = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
`;

const Indicator = styled.button<{ active: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  background-color: ${props => props.active ? '#10b981' : '#666'};
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background-color: ${props => props.active ? '#059669' : '#888'};
  }
`;

const ImageCounter = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
`;

interface ImageCarouselProps {
  images: string[];
  title: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, title }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // 터치 이벤트 상태
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handleIndicatorClick = (index: number) => {
    setCurrentIndex(index);
  };

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index));
  };

  // 터치 이벤트 핸들러들
  const handleTouchStart = (e: React.TouchEvent) => {
    if (images.length <= 1) return;
    
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (images.length <= 1 || !isDragging) return;
    
    const touch = e.touches[0];
    setTouchEndX(touch.clientX);
    setTouchEndY(touch.clientY);

    // 가로 스와이프가 세로 스와이프보다 큰 경우에만 스크롤 방지
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    if (deltaX > deltaY && deltaX > 10) {
      e.preventDefault(); // 가로 스와이프가 감지되면 기본 동작 방지
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (images.length <= 1 || !isDragging) return;
    
    setIsDragging(false);
    
    const swipeThreshold = 50; // 최소 스와이프 거리
    const deltaX = touchStartX - touchEndX;
    const deltaY = Math.abs(touchStartY - touchEndY);
    
    // 가로 스와이프가 세로 스와이프보다 크고, 임계값을 넘는 경우에만 처리
    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > deltaY) {
      e.preventDefault(); // 스와이프가 감지된 경우에만 기본 동작 방지
      
      if (deltaX > 0) {
        // 왼쪽으로 스와이프 (다음 이미지)
        handleNext();
      } else {
        // 오른쪽으로 스와이프 (이전 이미지)
        handlePrevious();
      }
    }
    
    setTouchStartX(0);
    setTouchStartY(0);
    setTouchEndX(0);
    setTouchEndY(0);
  };

  if (!images || images.length === 0) {
    return (
      <CarouselContainer>
        <ImageContainer>
          <ImagePlaceholder>📰</ImagePlaceholder>
        </ImageContainer>
      </CarouselContainer>
    );
  }

  const currentImage = images[currentIndex];
  const hasError = imageErrors.has(currentIndex);

  return (
    <CarouselContainer>
      <ImageContainer
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasError ? (
          <ImagePlaceholder>📰</ImagePlaceholder>
        ) : (
          <Image
            src={currentImage}
            alt={`${title} - ${currentIndex + 1}`}
            onError={() => handleImageError(currentIndex)}
          />
        )}
        
        {images.length > 1 && (
          <>
            <NavigationButton
              direction="left"
              onClick={handlePrevious}
              disabled={images.length <= 1}
            >
              ←
            </NavigationButton>
            <NavigationButton
              direction="right"
              onClick={handleNext}
              disabled={images.length <= 1}
            >
              →
            </NavigationButton>
            <ImageCounter>
              {currentIndex + 1} / {images.length}
            </ImageCounter>
          </>
        )}
      </ImageContainer>
      
      {images.length > 1 && (
        <ImageIndicators>
          {images.map((_, index) => (
            <Indicator
              key={index}
              active={index === currentIndex}
              onClick={() => handleIndicatorClick(index)}
            />
          ))}
        </ImageIndicators>
      )}
    </CarouselContainer>
  );
};

export default ImageCarousel; 
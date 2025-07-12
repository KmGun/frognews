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
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.9);
    transform: translateY(-50%) scale(1.1);
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
      <ImageContainer>
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
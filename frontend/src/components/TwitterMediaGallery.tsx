import React, { useState } from "react";
import styled from "styled-components";

const MediaContainer = styled.div`
  margin: 12px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #333;
`;

const SingleImageContainer = styled.div`
  position: relative;
  width: 100%;
  height: 250px;
  overflow: hidden;
  cursor: pointer;

  &:hover img {
    transform: scale(1.02);
  }
`;

const GridContainer = styled.div<{ $count: number }>`
  display: grid;
  gap: 2px;
  height: 250px;

  ${(props) => {
    if (props.$count === 2) {
      return `
        grid-template-columns: 1fr 1fr;
      `;
    } else if (props.$count === 3) {
      return `
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        
        > div:first-child {
          grid-row: 1 / 3;
        }
      `;
    } else if (props.$count >= 4) {
      return `
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
      `;
    }
  }}
`;

const ImageItem = styled.div<{ $isClickable?: boolean }>`
  position: relative;
  overflow: hidden;
  cursor: ${(props) => (props.$isClickable ? "pointer" : "default")};
  background-color: #2a2a2a;

  &:hover img {
    transform: scale(1.02);
  }
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
`;

const MoreOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: bold;
  backdrop-filter: blur(2px);
`;

const Modal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: ${(props) => (props.$isOpen ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
`;

const ModalContent = styled.div`
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  color: white;
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }
`;

const NavigationButton = styled.button<{ $direction: "prev" | "next" }>`
  position: absolute;
  top: 50%;
  ${(props) => (props.$direction === "prev" ? "left: 20px;" : "right: 20px;")}
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.7);
  border: none;
  color: white;
  font-size: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ImageCounter = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 24px;
`;

interface TwitterMediaGalleryProps {
  media: string[];
}

const TwitterMediaGallery: React.FC<TwitterMediaGalleryProps> = ({ media }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!media || media.length === 0) {
    return null;
  }

  const openModal = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 트윗 카드 클릭 방지
    setCurrentImageIndex(index);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "ArrowLeft") {
      goToPrevImage();
    } else if (e.key === "ArrowRight") {
      goToNextImage();
    }
  };

  const renderSingleImage = () => (
    <SingleImageContainer onClick={(e) => openModal(0, e)}>
      <Image
        src={media[0]}
        alt="트위터 이미지"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            const placeholder = document.createElement("div");
            placeholder.className = "image-placeholder";
            placeholder.style.cssText = `
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #666;
              font-size: 24px;
            `;
            placeholder.textContent = "🖼️";
            parent.appendChild(placeholder);
          }
        }}
      />
    </SingleImageContainer>
  );

  const renderGridImages = () => (
    <GridContainer $count={media.length}>
      {media.slice(0, 4).map((imageUrl, index) => (
        <ImageItem
          key={index}
          $isClickable={true}
          onClick={(e) => openModal(index, e)}
        >
          <Image
            src={imageUrl}
            alt={`트위터 이미지 ${index + 1}`}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                const placeholder = document.createElement("div");
                placeholder.style.cssText = `
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #666;
                  font-size: 24px;
                `;
                placeholder.textContent = "🖼️";
                parent.appendChild(placeholder);
              }
            }}
          />
          {index === 3 && media.length > 4 && (
            <MoreOverlay>+{media.length - 4}</MoreOverlay>
          )}
        </ImageItem>
      ))}
    </GridContainer>
  );

  return (
    <>
      <MediaContainer>
        {media.length === 1 ? renderSingleImage() : renderGridImages()}
      </MediaContainer>

      <Modal
        $isOpen={modalOpen}
        onClick={closeModal}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <ModalImage
            src={media[currentImageIndex]}
            alt={`트위터 이미지 ${currentImageIndex + 1}`}
          />

          <CloseButton onClick={closeModal}>×</CloseButton>

          {media.length > 1 && (
            <>
              <NavigationButton
                $direction="prev"
                onClick={goToPrevImage}
                disabled={media.length <= 1}
              >
                ‹
              </NavigationButton>

              <NavigationButton
                $direction="next"
                onClick={goToNextImage}
                disabled={media.length <= 1}
              >
                ›
              </NavigationButton>

              <ImageCounter>
                {currentImageIndex + 1} / {media.length}
              </ImageCounter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default TwitterMediaGallery;

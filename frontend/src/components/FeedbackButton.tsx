import React, { useState, useEffect } from "react";
import styled from "styled-components";

interface FeedbackButtonProps {
  onFeedbackClick: () => void;
  readArticleCount: number; // 읽은 기사 수
  minimumReads?: number; // 피드백 버튼 표시에 필요한 최소 읽은 기사 수 (기본값: 10)
}

const ButtonContainer = styled.div<{ isVisible: boolean }>`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;

  opacity: ${(props) => (props.isVisible ? 1 : 0)};
  visibility: ${(props) => (props.isVisible ? "visible" : "hidden")};
  transform: translateX(-50%)
    translateY(${(props) => (props.isVisible ? "0" : "20px")});
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 768px) {
    bottom: 16px;
    left: 16px;
    right: 16px;
    transform: translateY(${(props) => (props.isVisible ? "0" : "20px")});
    width: calc(100% - 32px);
  }
`;

const Button = styled.button`
  background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
  border: none;
  border-radius: 50px;
  padding: 16px 32px;
  color: #000;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(74, 222, 128, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(74, 222, 128, 0.5),
      0 4px 12px rgba(0, 0, 0, 0.3);
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    width: 100%;
    font-size: 14px;
    padding: 18px 20px;
  }

  @media (max-width: 480px) {
    font-size: 13px;
    padding: 16px 16px;
  }

  .desktop-text {
    @media (max-width: 480px) {
      display: none;
    }
  }

  .mobile-text {
    @media (max-width: 480px) {
      display: inline !important;
    }
  }
`;

const Icon = styled.span`
  font-size: 18px;

  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #333;
  border: 2px solid #0a0a0a;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: #555;
    color: #fff;
  }
`;

const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  onFeedbackClick,
  readArticleCount,
  minimumReads = 10, // 기본값: 10개
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 로컬 스토리지에서 피드백 버튼 숨김 상태 확인
    const dismissed = localStorage.getItem("feedback-button-dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
      return;
    }

    // 읽은 기사 수가 최소 요구 수치에 도달했을 때 버튼 표시
    if (readArticleCount >= minimumReads) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [readArticleCount, minimumReads]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    setIsDismissed(true);
    // 로컬 스토리지에 숨김 상태 저장 (세션 동안 유지)
    localStorage.setItem("feedback-button-dismissed", "true");
  };

  const handleFeedbackClick = () => {
    onFeedbackClick();
    // 피드백 클릭 시에도 버튼 숨기기
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem("feedback-button-dismissed", "true");
  };

  // 피드백 버튼이 이미 숨겨진 상태라면 렌더링하지 않음
  if (isDismissed) {
    return null;
  }

  return (
    <ButtonContainer isVisible={isVisible}>
      <Button onClick={handleFeedbackClick}>
        <Icon>💡</Icon>
        <span>
          <span className="desktop-text">
            {readArticleCount}개 기사를 읽으셨네요! 서비스는 쓸만한가요?
          </span>
          <span className="mobile-text" style={{ display: "none" }}>
            {readArticleCount}개 기사를 읽으셨네요! 서비스는 쓸만한가요?
          </span>
        </span>
      </Button>
      <CloseButton onClick={handleClose} title="닫기">
        ×
      </CloseButton>
    </ButtonContainer>
  );
};

export default FeedbackButton;

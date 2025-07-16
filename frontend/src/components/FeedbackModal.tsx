import React, { useState } from "react";
import styled from "styled-components";
import { FeedbackSubmission } from "../types";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackSubmission) => Promise<void>;
}

const ModalOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  opacity: ${(props) => (props.isOpen ? 1 : 0)};
  visibility: ${(props) => (props.isOpen ? "visible" : "hidden")};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`;

const ModalContainer = styled.div`
  background-color: #1a1a1a;
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 480px;
  border: 1px solid #333;
  position: relative;
  max-height: 90vh;
  overflow-y: auto;

  @media (max-width: 768px) {
    padding: 24px;
    margin: 0 16px;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    color: #fff;
    background-color: #333;
  }
`;

const Title = styled.h2`
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: center;
`;

const Subtitle = styled.p`
  color: #888;
  font-size: 14px;
  text-align: center;
  margin-bottom: 32px;
  line-height: 1.5;
`;

const FormSection = styled.div`
  margin-bottom: 24px;
`;

const Label = styled.label`
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  display: block;
  margin-bottom: 12px;
`;

const ScoreContainer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
`;

const ScoreButton = styled.button<{ selected: boolean }>`
  flex: 1;
  min-width: 40px;
  height: 48px;
  border: 2px solid ${(props) => (props.selected ? "#4ade80" : "#333")};
  background-color: ${(props) => (props.selected ? "#4ade80" : "transparent")};
  color: ${(props) => (props.selected ? "#000" : "#fff")};
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4ade80;
    background-color: ${(props) =>
      props.selected ? "#4ade80" : "rgba(74, 222, 128, 0.1)"};
  }

  @media (max-width: 480px) {
    min-width: 35px;
    height: 44px;
    font-size: 14px;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  background-color: #0a0a0a;
  border: 2px solid #333;
  border-radius: 12px;
  padding: 16px;
  color: #fff;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;

  &::placeholder {
    color: #666;
  }

  &:focus {
    outline: none;
    border-color: #4ade80;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 32px;
`;

const Button = styled.button<{ variant?: "primary" | "secondary" }>`
  flex: 1;
  height: 48px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  ${(props) =>
    props.variant === "primary"
      ? `
    background-color: #4ade80;
    color: #000;
    
    &:hover:not(:disabled) {
      background-color: #22c55e;
    }
    
    &:disabled {
      background-color: #333;
      color: #666;
      cursor: not-allowed;
    }
  `
      : `
    background-color: transparent;
    color: #888;
    border: 2px solid #333;
    
    &:hover {
      color: #fff;
      border-color: #555;
    }
  `}
`;

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [score, setScore] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score === null) {
      alert("점수를 선택해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        score,
        feedbackText: feedbackText.trim(),
      });

      // 성공 시 모달 닫기 및 상태 초기화
      setScore(null);
      setFeedbackText("");
      onClose();
    } catch (error) {
      console.error("피드백 제출 실패:", error);
      alert("피드백 제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setScore(null);
      setFeedbackText("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClick={handleClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={handleClose} disabled={isSubmitting}>
          ×
        </CloseButton>

        <Title>서비스 피드백</Title>
        <Subtitle>
          FrogNews를 사용해보신 소감을 알려주세요.
          <br />더 나은 서비스를 만들어가는 데 큰 도움이 됩니다.
        </Subtitle>

        <FormSection>
          <Label>서비스 만족도 (1~10점)</Label>
          <ScoreContainer>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
              <ScoreButton
                key={num}
                selected={score === num}
                onClick={() => setScore(num)}
                disabled={isSubmitting}
              >
                {num}
              </ScoreButton>
            ))}
          </ScoreContainer>
        </FormSection>

        <FormSection>
          <Label>개선 의견 또는 추가되었으면 하는 기능</Label>
          <TextArea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="어떤 점이 좋았나요? 개선되었으면 하는 점이나 추가되었으면 하는 기능이 있다면 자유롭게 작성해주세요. (선택사항)"
            disabled={isSubmitting}
          />
        </FormSection>

        <ButtonContainer>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || score === null}
          >
            {isSubmitting ? "제출 중..." : "피드백 제출"}
          </Button>
        </ButtonContainer>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default FeedbackModal;

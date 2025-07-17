import React from "react";
import styled from "styled-components";

const HeaderContainer = styled.header`
  background-color: #0a0a0a;
  padding: 20px 0;
  border-bottom: 1px solid #333;
`;

const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LogoImage = styled.img`
  width: 40px;
  height: 40px;
  object-fit: contain;
`;

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: bold;
  color: #ffffff;
  margin: 0;
  line-height: 1.2;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: #888;
  margin: 0;
  line-height: 1.2;
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SettingsButton = styled.button<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: ${(props) => (props.$isActive ? "#10b981" : "#333")};
  color: ${(props) => (props.$isActive ? "#ffffff" : "#888")};
  border: 1px solid ${(props) => (props.$isActive ? "#10b981" : "#555")};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${(props) => (props.$isActive ? "#059669" : "#444")};
    color: #ffffff;
    border-color: ${(props) => (props.$isActive ? "#059669" : "#666")};
  }

  @media (max-width: 768px) {
    font-size: 12px;
    padding: 6px 8px;
    gap: 4px;
  }
`;

const SettingsIcon = styled.span`
  font-size: 16px;

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const SettingsText = styled.span`
  @media (max-width: 480px) {
    display: none;
  }
`;

interface HeaderProps {
  hideReadArticles?: boolean;
  onToggleHideReadArticles?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  hideReadArticles = false,
  onToggleHideReadArticles,
}) => {
  return (
    <HeaderContainer>
      <HeaderContent>
        <LeftSection>
          <LogoContainer>
            <LogoImage src="/frognewslogo.png" alt="FrogNews Logo" />
          </LogoContainer>
          <TextContainer>
            <Title>FrogNews</Title>
            <Subtitle>핵심만 전달하는 AI 뉴스</Subtitle>
          </TextContainer>
        </LeftSection>

        {onToggleHideReadArticles && (
          <RightSection>
            <SettingsButton
              $isActive={hideReadArticles}
              onClick={onToggleHideReadArticles}
              title={
                hideReadArticles ? "읽은 기사 다시 보기" : "읽은 기사 숨기기"
              }
            >
              <SettingsIcon>{hideReadArticles ? "👁️" : "🙈"}</SettingsIcon>
              <SettingsText>
                {hideReadArticles ? "읽은 기사 보기" : "읽은 기사 숨기기"}
              </SettingsText>
            </SettingsButton>
          </RightSection>
        )}
      </HeaderContent>
    </HeaderContainer>
  );
};

export default Header;

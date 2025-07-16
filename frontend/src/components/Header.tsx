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

const Header: React.FC = () => {
  return (
    <HeaderContainer>
      <HeaderContent>
        <LogoContainer>
          <LogoImage src="/frognewslogo.png" alt="FrogNews Logo" />
        </LogoContainer>
        <TextContainer>
          <Title>FrogNews</Title>
          <Subtitle>핵심만 전달하는 AI 뉴스</Subtitle>
        </TextContainer>
      </HeaderContent>
    </HeaderContainer>
  );
};

export default Header;

import React from 'react';
import styled from 'styled-components';

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
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

const Logo = styled.div`
  font-size: 48px;
  margin-bottom: 10px;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: bold;
  color: #ffffff;
  text-align: center;
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #888;
  text-align: center;
  margin: 0;
`;

const Header: React.FC = () => {
  return (
    <HeaderContainer>
      <HeaderContent>
        <Logo>🐸</Logo>
        <Title>FrogNews</Title>
        <Subtitle>인공지능 AI 뉴스</Subtitle>
      </HeaderContent>
    </HeaderContainer>
  );
};

export default Header; 
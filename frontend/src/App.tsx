import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import MainPage from './pages/MainPage';
import ArticlePage from './pages/ArticlePage';
import GlobalStyle from './styles/GlobalStyle';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #0a0a0a;
  color: #ffffff;
`;

// 스크롤 복원을 위한 컴포넌트
const ScrollRestorer = () => {
  const location = useLocation();

  useEffect(() => {
    // 메인 페이지로 돌아올 때 스크롤 복원
    if (location.pathname === '/') {
      console.log('🏠 메인 페이지로 돌아옴, 스크롤 복원 준비');
      
      // 잠시 후 스크롤 복원
      setTimeout(() => {
        const scrollPositions = sessionStorage.getItem('scroll_positions');
        if (scrollPositions) {
          try {
            const positions = JSON.parse(scrollPositions);
            const savedPosition = positions['main-page'];
            
            // 데이터 유효성 검증
            if (typeof savedPosition === 'number' && !isNaN(savedPosition) && savedPosition > 50) {
              console.log(`🔄 스크롤 복원: ${savedPosition}px`);
              window.scrollTo(0, savedPosition);
              
              // 복원 확인
              setTimeout(() => {
                const currentPosition = window.pageYOffset || document.documentElement.scrollTop || 0;
                console.log(`📍 복원 후 위치: ${currentPosition}px`);
              }, 100);
            } else if (typeof savedPosition === 'object') {
              // 잘못된 데이터 형식 감지
              console.warn('⚠️ App: 잘못된 스크롤 데이터 형식 감지, 초기화합니다.');
              sessionStorage.removeItem('scroll_positions');
            } else {
              console.log('❌ 유효한 스크롤 위치가 없음');
            }
          } catch (error) {
            console.error('스크롤 복원 오류:', error);
            sessionStorage.removeItem('scroll_positions');
          }
        }
      }, 200);
    }
  }, [location.pathname]);

  return null;
};

function App() {
  return (
    <Router>
      <GlobalStyle />
      <AppContainer>
        <ScrollRestorer />
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/article/:articleId" element={<ArticlePage />} />
        </Routes>
      </AppContainer>
    </Router>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import MainPage from './pages/MainPage';
import ArticlePage from './pages/ArticlePage';
import GlobalStyle from './styles/GlobalStyle';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #0a0a0a;
  color: #ffffff;
`;

function App() {
  return (
    <Router>
      <GlobalStyle />
      <AppContainer>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/article/:articleId" element={<ArticlePage />} />
        </Routes>
      </AppContainer>
    </Router>
  );
}

export default App;

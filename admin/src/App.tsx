import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GlobalStyle } from './styles/GlobalStyle';
import { Layout } from './components/Layout/Layout';
import { PendingPage } from './pages/PendingPage';

function App() {
  return (
    <>
      <GlobalStyle />
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PendingPage />} />
          </Route>
        </Routes>
      </Router>
    </>
  );
}

export default App; 
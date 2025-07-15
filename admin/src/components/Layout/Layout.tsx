import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from './Header';
import { statsApi } from '../../services/api';

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f8fafc;
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px);
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 1.5rem;
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

interface LayoutProps {
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ title = 'FrogNews Admin' }) => {
  const [dbStatus, setDbStatus] = useState<'online' | 'offline'>('online');

  // DB 상태 체크
  useEffect(() => {
    const checkDbStatus = async () => {
      try {
        await statsApi.getDashboardStats();
        setDbStatus('online');
      } catch (error) {
        console.error('DB 연결 확인 실패:', error);
        setDbStatus('offline');
      }
    };

    checkDbStatus();
    
    // 30초마다 DB 상태 체크
    const interval = setInterval(checkDbStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <LayoutContainer>
      <Header 
        title={title}
        dbStatus={dbStatus}
      />
      
      <MainContent>
        <ContentArea>
          <Outlet />
        </ContentArea>
      </MainContent>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'white',
            color: '#1e293b',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: {
              primary: '#059669',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: 'white',
            },
          },
        }}
      />
    </LayoutContainer>
  );
}; 
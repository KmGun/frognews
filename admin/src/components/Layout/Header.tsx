import React from 'react';
import styled from 'styled-components';
import { Text } from '../../styles/GlobalStyle';

const HeaderContainer = styled.header`
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 1rem;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: 768px) {
    padding: 0 0.75rem;
  }
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const PageTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const StatusIndicator = styled.div<{ status: 'online' | 'offline' }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: ${props => props.status === 'online' ? '#dcfce7' : '#fecaca'};
  border: 1px solid ${props => props.status === 'online' ? '#bbf7d0' : '#fca5a5'};

  @media (max-width: 640px) {
    padding: 0.375rem 0.5rem;
  }
`;

const StatusDot = styled.div<{ status: 'online' | 'offline' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.status === 'online' ? '#059669' : '#dc2626'};
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #f8fafc;
  }

  @media (max-width: 640px) {
    gap: 0.5rem;
  }
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  @media (max-width: 640px) {
    display: none;
  }
`;

interface HeaderProps {
  title: string;
  user?: {
    name: string;
    email: string;
  };
  dbStatus?: 'online' | 'offline';
}

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  user = { name: 'Admin', email: 'admin@frognews.com' },
  dbStatus = 'online'
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <HeaderContainer>
      <LeftSection>
        <PageTitle>{title}</PageTitle>
      </LeftSection>

      <RightSection>
        <StatusIndicator status={dbStatus}>
          <StatusDot status={dbStatus} />
          <Text size="sm" weight="medium" color={dbStatus === 'online' ? 'success' : 'danger'}>
            {dbStatus === 'online' ? 'DB 연결됨' : 'DB 연결 끊김'}
          </Text>
        </StatusIndicator>

        <UserSection>
          <Avatar>{getInitials(user.name)}</Avatar>
          <UserInfo>
            <Text size="sm" weight="medium">{user.name}</Text>
            <Text size="xs" color="muted">{user.email}</Text>
          </UserInfo>
        </UserSection>
      </RightSection>
    </HeaderContainer>
  );
}; 
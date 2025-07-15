import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { Flex, Text } from '../../styles/GlobalStyle';

const SidebarContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 260px;
  background: white;
  border-right: 1px solid #e2e8f0;
  z-index: 1000;
  transform: ${props => props.isOpen ? 'translateX(0)' : 'translateX(-100%)'};
  transition: transform 0.3s ease;

  @media (min-width: 768px) {
    position: relative;
    transform: translateX(0);
    width: 240px;
  }
`;

const SidebarHeader = styled.div`
  padding: 1.5rem 1rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Logo = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
`;

const NavList = styled.ul`
  list-style: none;
  padding: 1rem 0;
`;

const NavItem = styled.li<{ isActive?: boolean }>`
  margin: 0.25rem 0;
`;

const NavLink = styled.button<{ isActive?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: ${props => props.isActive ? '#3b82f6' : '#64748b'};
  background: ${props => props.isActive ? '#eff6ff' : 'transparent'};
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    background: ${props => props.isActive ? '#eff6ff' : '#f8fafc'};
    color: ${props => props.isActive ? '#3b82f6' : '#1e293b'};
  }

  &::before {
    content: '';
    width: 3px;
    height: 100%;
    background: ${props => props.isActive ? '#3b82f6' : 'transparent'};
    position: absolute;
    left: 0;
  }

  position: relative;
`;

const Icon = styled.span`
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
`;

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: ${props => props.isOpen ? 'block' : 'none'};

  @media (min-width: 768px) {
    display: none;
  }
`;

const StatsSection = styled.div`
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  margin-top: auto;
`;

const StatItem = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.875rem;
`;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  stats?: {
    articles: { total: number; approved: number; pending: number };
    tweets: { total: number; approved: number; pending: number };
    youtube: { total: number; approved: number; pending: number };
  };
}

const navigation = [
  {
    name: '대시보드',
    path: '/',
    icon: '📊',
  },
  {
    name: '기사 관리',
    path: '/articles',
    icon: '📰',
  },
  {
    name: '트위터 관리',
    path: '/tweets',
    icon: '🐦',
  },
  {
    name: '유튜브 관리',
    path: '/youtube',
    icon: '🎥',
  },
  {
    name: '승인 대기',
    path: '/pending',
    icon: '⏳',
  },
  {
    name: '설정',
    path: '/settings',
    icon: '⚙️',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, stats }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose(); // 모바일에서 메뉴 선택 시 사이드바 닫기
  };

  return (
    <>
      <Overlay isOpen={isOpen} onClick={onClose} />
      <SidebarContainer isOpen={isOpen}>
        <SidebarHeader>
          <Logo>FrogNews Admin</Logo>
        </SidebarHeader>

        <NavList>
          {navigation.map((item) => (
            <NavItem key={item.path}>
              <NavLink
                isActive={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
              >
                <Icon>{item.icon}</Icon>
                <span>{item.name}</span>
              </NavLink>
            </NavItem>
          ))}
        </NavList>

        {stats && (
          <StatsSection>
            <Text size="sm" weight="semibold" color="secondary">
              현재 상태
            </Text>
            <StatItem>
              <Flex justify="between" align="center" style={{ width: '100%' }}>
                <Text size="xs" color="muted">승인 대기</Text>
                <Text size="xs" weight="medium" color="danger">
                  {stats.articles.pending + stats.tweets.pending + stats.youtube.pending}
                </Text>
              </Flex>
            </StatItem>
            <StatItem>
              <Flex justify="between" align="center" style={{ width: '100%' }}>
                <Text size="xs" color="muted">전체 컨텐츠</Text>
                <Text size="xs" weight="medium">
                  {stats.articles.total + stats.tweets.total + stats.youtube.total}
                </Text>
              </Flex>
            </StatItem>
          </StatsSection>
        )}
      </SidebarContainer>
    </>
  );
}; 
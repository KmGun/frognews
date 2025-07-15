import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card, Grid, Text, Badge, Flex } from '../styles/GlobalStyle';
import { statsApi } from '../services/api';

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const StatsGrid = styled(Grid)`
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  margin-bottom: 2rem;
`;

const StatCard = styled(Card)`
  position: relative;
  overflow: hidden;
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const StatIcon = styled.div<{ color: string }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${props => props.color}20;
  color: ${props => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
`;

const StatNumbers = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
`;

const StatProgress = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
`;

const ProgressBar = styled.div<{ width: number; color: string }>`
  height: 4px;
  background: #f1f5f9;
  border-radius: 2px;
  overflow: hidden;
  flex: 1;
  margin-right: 0.75rem;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.width}%;
    background: ${props => props.color};
    transition: width 0.3s ease;
  }
`;

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<{
    articles: { total: number; approved: number; pending: number };
    tweets: { total: number; approved: number; pending: number };
    youtube: { total: number; approved: number; pending: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await statsApi.getDashboardStats();
        if (response.success && response.data) {
          setStats(response.data);
        }
      } catch (error) {
        console.error('통계 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <DashboardContainer>
        <Text>로딩 중...</Text>
      </DashboardContainer>
    );
  }

  if (!stats) {
    return (
      <DashboardContainer>
        <Text color="danger">통계를 불러올 수 없습니다.</Text>
      </DashboardContainer>
    );
  }

  const statsData = [
    {
      title: '뉴스 기사',
      icon: '📰',
      color: '#3b82f6',
      total: stats.articles.total,
      approved: stats.articles.approved,
      pending: stats.articles.pending,
    },
    {
      title: '트위터 게시물',
      icon: '🐦',
      color: '#1da1f2',
      total: stats.tweets.total,
      approved: stats.tweets.approved,
      pending: stats.tweets.pending,
    },
    {
      title: '유튜브 영상',
      icon: '🎥',
      color: '#ff0000',
      total: stats.youtube.total,
      approved: stats.youtube.approved,
      pending: stats.youtube.pending,
    },
  ];

  const totalPending = stats.articles.pending + stats.tweets.pending + stats.youtube.pending;
  const totalContent = stats.articles.total + stats.tweets.total + stats.youtube.total;

  return (
    <DashboardContainer>
      <div>
        <Text size="xl" weight="bold">대시보드</Text>
        <Text color="muted" style={{ marginTop: '0.5rem', display: 'block' }}>
          FrogNews 컨텐츠 관리 현황
        </Text>
      </div>

      <StatsGrid>
        {statsData.map((stat) => {
          const approvalRate = stat.total > 0 ? (stat.approved / stat.total) * 100 : 0;
          
          return (
            <StatCard key={stat.title}>
              <StatHeader>
                <StatIcon color={stat.color}>
                  {stat.icon}
                </StatIcon>
                {stat.pending > 0 && (
                  <Badge variant="danger">
                    {stat.pending}개 대기
                  </Badge>
                )}
              </StatHeader>
              
              <StatNumbers>
                <StatValue>{stat.total}</StatValue>
                <StatLabel>{stat.title}</StatLabel>
              </StatNumbers>

              <StatProgress>
                <ProgressBar 
                  width={approvalRate} 
                  color={stat.color} 
                />
                <Text size="sm" color="muted">
                  {approvalRate.toFixed(0)}% 승인됨
                </Text>
              </StatProgress>
            </StatCard>
          );
        })}
      </StatsGrid>

      {totalPending > 0 && (
        <Card>
          <Flex justify="between" align="center">
            <div>
              <Text weight="semibold">승인 대기 중인 컨텐츠</Text>
              <Text size="sm" color="muted" style={{ marginTop: '0.25rem', display: 'block' }}>
                총 {totalPending}개의 컨텐츠가 승인을 기다리고 있습니다.
              </Text>
            </div>
            <Badge variant="warning">
              {totalPending}
            </Badge>
          </Flex>
        </Card>
      )}

      <Card>
        <Text weight="semibold" style={{ marginBottom: '1rem', display: 'block' }}>
          전체 통계
        </Text>
        <Grid columns={3} gap="1rem">
          <div>
            <Text size="lg" weight="bold" color="primary">{totalContent}</Text>
            <Text size="sm" color="muted" style={{ display: 'block' }}>전체 컨텐츠</Text>
          </div>
          <div>
            <Text size="lg" weight="bold" color="success">
              {stats.articles.approved + stats.tweets.approved + stats.youtube.approved}
            </Text>
            <Text size="sm" color="muted" style={{ display: 'block' }}>승인된 컨텐츠</Text>
          </div>
          <div>
            <Text size="lg" weight="bold" color="danger">{totalPending}</Text>
            <Text size="sm" color="muted" style={{ display: 'block' }}>승인 대기</Text>
          </div>
        </Grid>
      </Card>
    </DashboardContainer>
  );
}; 
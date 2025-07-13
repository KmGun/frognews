import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const SummaryContainer = styled.div`
  margin-top: 30px;
`;

const SectionTitle = styled.h2`
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #10b981, #059669);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const SummaryItem = styled.div`
  margin-bottom: 16px;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  background: linear-gradient(135deg, #1a1a1a, #1f1f1f);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #10b981;
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.1);
    transform: translateY(-2px);
  }
`;

const SummaryHeader = styled.button`
  width: 100%;
  padding: 20px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
  position: relative;
  
  &:hover {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.05));
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const SummaryText = styled.div`
  color: #ffffff;
  font-size: 16px;
  line-height: 1.6;
  font-weight: 500;
  flex: 1;
  margin-right: 16px;
`;

const ExpandIcon = styled.div<{ expanded: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981, #059669);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.3s ease;
  transform: ${props => props.expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  
  &:hover {
    transform: ${props => props.expanded ? 'rotate(180deg) scale(1.1)' : 'rotate(0deg) scale(1.1)'};
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }
`;

const DetailContainer = styled.div<{ expanded: boolean }>`
  max-height: ${props => props.expanded ? '800px' : '0'};
  overflow: hidden;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
`;

const DetailContent = styled.div`
  padding: 0 20px 20px 20px;
  color: #e0e0e0;
  font-size: 14px;
  line-height: 1.7;
  border-top: 1px solid rgba(16, 185, 129, 0.2);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.02), rgba(5, 150, 105, 0.02));
  animation: ${fadeIn} 0.3s ease;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 20px;
    right: 20px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #10b981, transparent);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #666;
  padding: 40px;
  font-size: 16px;
  background: linear-gradient(135deg, #1a1a1a, #1f1f1f);
  border-radius: 12px;
  border: 1px solid #2a2a2a;
`;

interface SummarySectionProps {
  summaryLines: string[];
  details: string[];
}

const SummarySection: React.FC<SummarySectionProps> = ({ summaryLines, details }) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (!summaryLines || summaryLines.length === 0) {
    return (
      <SummaryContainer>
        <SectionTitle>요약</SectionTitle>
        <EmptyState>요약 정보가 없습니다.</EmptyState>
      </SummaryContainer>
    );
  }

  return (
    <SummaryContainer>
      <SectionTitle>요약</SectionTitle>
      {summaryLines.map((line, index) => {
        const isExpanded = expandedItems.has(index);
        const hasDetail = details && details[index];
        
        return (
          <SummaryItem key={index}>
            <SummaryHeader
              onClick={() => hasDetail && toggleExpanded(index)}
              style={{ cursor: hasDetail ? 'pointer' : 'default' }}
            >
              <SummaryText>{line}</SummaryText>
              {hasDetail && (
                <ExpandIcon expanded={isExpanded}>
                  ▼
                </ExpandIcon>
              )}
            </SummaryHeader>
            
            {hasDetail && (
              <DetailContainer expanded={isExpanded}>
                <DetailContent>
                  {details[index]}
                </DetailContent>
              </DetailContainer>
            )}
          </SummaryItem>
        );
      })}
    </SummaryContainer>
  );
};

export default SummarySection; 
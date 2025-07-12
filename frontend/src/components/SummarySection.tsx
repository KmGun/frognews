import React, { useState } from 'react';
import styled from 'styled-components';

const SummaryContainer = styled.div`
  margin-top: 30px;
`;

const SectionTitle = styled.h2`
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
`;

const SummaryItem = styled.div`
  margin-bottom: 16px;
  border: 1px solid #333;
  border-radius: 8px;
  background-color: #1a1a1a;
  overflow: hidden;
`;

const SummaryHeader = styled.button`
  width: 100%;
  padding: 16px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.3s ease;
  
  &:hover {
    background-color: #222;
  }
`;

const SummaryText = styled.div`
  color: #ffffff;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 500;
  flex: 1;
  margin-right: 16px;
`;

const ExpandIcon = styled.div<{ expanded: boolean }>`
  color: #10b981;
  font-size: 20px;
  transition: transform 0.3s ease;
  transform: ${props => props.expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
`;

const DetailContainer = styled.div<{ expanded: boolean }>`
  max-height: ${props => props.expanded ? '500px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
`;

const DetailContent = styled.div`
  padding: 0 16px 16px 16px;
  color: #cccccc;
  font-size: 14px;
  line-height: 1.6;
  border-top: 1px solid #333;
  background-color: #0f0f0f;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #666;
  padding: 40px;
  font-size: 16px;
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
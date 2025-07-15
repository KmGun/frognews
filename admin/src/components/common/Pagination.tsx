import React from 'react';
import styled from 'styled-components';
import { Button, Flex, Text } from '../../styles/GlobalStyle';

const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: between;
  gap: 1rem;
  flex-wrap: wrap;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const PageInfo = styled.div`
  @media (max-width: 640px) {
    order: -1;
  }
`;

const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PageButton = styled(Button)<{ isActive?: boolean }>`
  min-width: 36px;
  height: 36px;
  padding: 0;
  ${props => props.isActive && `
    background: #3b82f6 !important;
    color: white !important;
    &:hover {
      background: #2563eb !important;
    }
  `}
`;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <PaginationContainer>
      <PageInfo>
        <Text size="sm" color="muted">
          {totalItems}개 중 {startItem}-{endItem}개 표시
        </Text>
      </PageInfo>

      <PaginationControls>
        <Button
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          이전
        </Button>

        {getVisiblePages().map((page, index) => (
          <React.Fragment key={index}>
            {page === 'ellipsis' ? (
              <Text color="muted">...</Text>
            ) : (
              <PageButton
                size="sm"
                isActive={page === currentPage}
                onClick={() => onPageChange(page)}
              >
                {page}
              </PageButton>
            )}
          </React.Fragment>
        ))}

        <Button
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          다음
        </Button>
      </PaginationControls>
    </PaginationContainer>
  );
}; 
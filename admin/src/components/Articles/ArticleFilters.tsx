import React from 'react';
import styled from 'styled-components';
import { Input, Select, Button, Flex, Label } from '../../styles/GlobalStyle';
import { FilterOptions, CATEGORIES } from '../../types';

const FiltersContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: end;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

interface ArticleFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onReset: () => void;
}

export const ArticleFilters: React.FC<ArticleFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
}) => {
  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? undefined : value,
    });
  };

  return (
    <FiltersContainer>
      <FilterGroup>
        <Label>검색어</Label>
        <Input
          type="text"
          placeholder="제목으로 검색..."
          value={filters.searchQuery || ''}
          onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
        />
      </FilterGroup>

      <FilterGroup>
        <Label>카테고리</Label>
        <Select
          value={filters.category?.toString() || ''}
          onChange={(e) => handleFilterChange('category', e.target.value ? parseInt(e.target.value) : undefined)}
        >
          <option value="">전체 카테고리</option>
          {Object.entries(CATEGORIES).map(([value, category]) => (
            <option key={value} value={value}>
              {category.name}
            </option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup>
        <Label>승인 상태</Label>
        <Select
          value={
            filters.isApproved === undefined 
              ? '' 
              : filters.isApproved 
                ? 'approved' 
                : 'pending'
          }
          onChange={(e) => {
            const value = e.target.value;
            handleFilterChange(
              'isApproved', 
              value === '' ? undefined : value === 'approved'
            );
          }}
        >
          <option value="">전체</option>
          <option value="approved">승인됨</option>
          <option value="pending">승인 대기</option>
        </Select>
      </FilterGroup>

      <FilterGroup>
        <Label>날짜 범위</Label>
        <Flex gap="0.5rem">
          <Input
            type="date"
            value={filters.dateRange?.start?.toISOString().split('T')[0] || ''}
            onChange={(e) => {
              const startDate = e.target.value ? new Date(e.target.value) : undefined;
              handleFilterChange('dateRange', startDate ? {
                start: startDate,
                end: filters.dateRange?.end || new Date(),
              } : undefined);
            }}
          />
          <Input
            type="date"
            value={filters.dateRange?.end?.toISOString().split('T')[0] || ''}
            onChange={(e) => {
              const endDate = e.target.value ? new Date(e.target.value) : undefined;
              handleFilterChange('dateRange', endDate ? {
                start: filters.dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: endDate,
              } : undefined);
            }}
          />
        </Flex>
      </FilterGroup>

      <ButtonGroup>
        <Button onClick={onReset} size="sm">
          필터 초기화
        </Button>
      </ButtonGroup>
    </FiltersContainer>
  );
}; 
import React from 'react';
import styled from 'styled-components';
import { CATEGORIES } from '../types';

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin: 30px 0;
`;

const TagButton = styled.button<{ active: boolean; color: string }>`
  background-color: ${props => props.active ? props.color : 'transparent'};
  color: ${props => props.active ? '#ffffff' : '#cccccc'};
  border: 2px solid ${props => props.color};
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background-color: ${props => props.color};
    color: #ffffff;
    transform: translateY(-2px);
  }
`;

const AllButton = styled.button<{ active: boolean }>`
  background-color: ${props => props.active ? '#ffffff' : 'transparent'};
  color: ${props => props.active ? '#0a0a0a' : '#cccccc'};
  border: 2px solid #ffffff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background-color: #ffffff;
    color: #0a0a0a;
    transform: translateY(-2px);
  }
`;

interface CategoryTagsProps {
  categories: typeof CATEGORIES;
  selectedCategory: number | null;
  onCategorySelect: (category: number | null) => void;
}

const CategoryTags: React.FC<CategoryTagsProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
}) => {
  return (
    <TagsContainer>
      <AllButton
        active={selectedCategory === null}
        onClick={() => onCategorySelect(null)}
      >
        전체
      </AllButton>
      {Object.entries(categories).map(([key, category]) => (
        <TagButton
          key={key}
          active={selectedCategory === Number(key)}
          color={category.color}
          onClick={() => onCategorySelect(Number(key))}
        >
          {category.name}
        </TagButton>
      ))}
    </TagsContainer>
  );
};

export default CategoryTags; 
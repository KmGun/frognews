import styled, { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #f8fafc;
    color: #1e293b;
    line-height: 1.6;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    cursor: pointer;
    border: none;
    background: none;
    font-family: inherit;
  }

  input, textarea, select {
    font-family: inherit;
    border: none;
    outline: none;
  }

  /* 스크롤바 스타일링 */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: #f1f5f9;
  }

  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* 모바일 터치 개선 */
  @media (max-width: 768px) {
    body {
      -webkit-tap-highlight-color: transparent;
    }
  }
`;

// 공통 컨테이너
export const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;

  @media (max-width: 768px) {
    padding: 0 0.75rem;
  }
`;

// 카드 스타일
export const Card = styled.div<{ padding?: string }>`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  padding: ${props => props.padding || '1.5rem'};
  border: 1px solid #e2e8f0;

  @media (max-width: 768px) {
    padding: ${props => props.padding || '1rem'};
    border-radius: 6px;
  }
`;

// 버튼 스타일
export const Button = styled.button<{
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  
  ${props => {
    switch (props.size) {
      case 'sm':
        return 'padding: 0.5rem 0.75rem; font-size: 0.875rem;';
      case 'lg':
        return 'padding: 0.75rem 1.5rem; font-size: 1rem;';
      default:
        return 'padding: 0.625rem 1rem; font-size: 0.875rem;';
    }
  }}

  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #3b82f6;
          color: white;
          &:hover:not(:disabled) { background: #2563eb; }
        `;
      case 'danger':
        return `
          background: #dc2626;
          color: white;
          &:hover:not(:disabled) { background: #b91c1c; }
        `;
      case 'success':
        return `
          background: #059669;
          color: white;
          &:hover:not(:disabled) { background: #047857; }
        `;
      default:
        return `
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
          &:hover:not(:disabled) { background: #e2e8f0; }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  ${props => props.fullWidth && 'width: 100%;'}
`;

// 입력 필드 스타일
export const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s;

  &:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

// 텍스트영역 스타일
export const Textarea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
  resize: vertical;
  min-height: 100px;

  &:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

// 선택 박스 스타일
export const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;

  &:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

// 레이블 스타일
export const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
`;

// 뱃지 스타일
export const Badge = styled.span<{
  variant?: 'default' | 'success' | 'warning' | 'danger';
}>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;

  ${props => {
    switch (props.variant) {
      case 'success':
        return 'background: #dcfce7; color: #166534;';
      case 'warning':
        return 'background: #fef3c7; color: #92400e;';
      case 'danger':
        return 'background: #fecaca; color: #991b1b;';
      default:
        return 'background: #f1f5f9; color: #475569;';
    }
  }}
`;

// 플렉스 레이아웃
export const Flex = styled.div<{
  direction?: 'row' | 'column';
  gap?: string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
}>`
  display: flex;
  flex-direction: ${props => props.direction || 'row'};
  gap: ${props => props.gap || '0'};
  align-items: ${props => {
    switch (props.align) {
      case 'start': return 'flex-start';
      case 'end': return 'flex-end';
      case 'stretch': return 'stretch';
      default: return 'center';
    }
  }};
  justify-content: ${props => {
    switch (props.justify) {
      case 'start': return 'flex-start';
      case 'end': return 'flex-end';
      case 'between': return 'space-between';
      case 'around': return 'space-around';
      default: return 'center';
    }
  }};
  ${props => props.wrap && 'flex-wrap: wrap;'}
`;

// 그리드 레이아웃
export const Grid = styled.div<{
  columns?: number;
  gap?: string;
}>`
  display: grid;
  grid-template-columns: repeat(${props => props.columns || 1}, 1fr);
  gap: ${props => props.gap || '1rem'};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

// 로딩 스피너
export const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid #f3f4f6;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// 텍스트 스타일
export const Text = styled.span<{
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted' | 'danger' | 'success';
}>`
  ${props => {
    switch (props.size) {
      case 'xs': return 'font-size: 0.75rem;';
      case 'sm': return 'font-size: 0.875rem;';
      case 'lg': return 'font-size: 1.125rem;';
      case 'xl': return 'font-size: 1.25rem;';
      default: return 'font-size: 1rem;';
    }
  }}

  ${props => {
    switch (props.weight) {
      case 'medium': return 'font-weight: 500;';
      case 'semibold': return 'font-weight: 600;';
      case 'bold': return 'font-weight: 700;';
      default: return 'font-weight: 400;';
    }
  }}

  ${props => {
    switch (props.color) {
      case 'primary': return 'color: #3b82f6;';
      case 'secondary': return 'color: #6b7280;';
      case 'muted': return 'color: #9ca3af;';
      case 'danger': return 'color: #dc2626;';
      case 'success': return 'color: #059669;';
      default: return 'color: inherit;';
    }
  }}
`;

// 반응형 헬퍼
export const breakpoints = {
  mobile: '@media (max-width: 768px)',
  tablet: '@media (max-width: 1024px)',
  desktop: '@media (min-width: 1024px)',
}; 
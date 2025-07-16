import React, { useState } from 'react';
import styled from 'styled-components';
import { ParsedArticle, ParsedTweet, ParsedYouTubeVideo } from '../../types';

interface ContentCardProps {
  content: ParsedArticle | ParsedTweet | ParsedYouTubeVideo;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSave?: (content: ParsedArticle | ParsedTweet | ParsedYouTubeVideo) => void;
}

// 카테고리 정보
const CATEGORIES = {
  1: { name: '오픈소스', color: '#10b981' },
  2: { name: '서비스', color: '#3b82f6' },
  3: { name: '연구', color: '#8b5cf6' },
  4: { name: '비즈니스', color: '#f59e0b' },
  5: { name: '기타', color: '#6b7280' }
};

// 공통 스타일
const CardContainer = styled.div<{ $isEditing: boolean }>`
  position: relative;
  background: ${props => props.$isEditing ? '#1e2a1a' : '#1a1a1a'};
  border-radius: 12px;
  border: 1px solid ${props => props.$isEditing ? '#10b981' : '#333'};
  overflow: hidden;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-color: ${props => props.$isEditing ? '#10b981' : '#555'};
  }
`;

const CheckboxContainer = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
`;

const Checkbox = styled.input`
  width: 20px;
  height: 20px;
  cursor: pointer;
`;

const ActionButtons = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 10;
`;

const ActionButton = styled.button<{ $variant: 'approve' | 'reject' | 'edit' | 'save' | 'cancel' }>`
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: ${props => 
    props.$variant === 'approve' ? '#10b981' : 
    props.$variant === 'reject' ? '#ef4444' : 
    props.$variant === 'save' ? '#059669' :
    props.$variant === 'cancel' ? '#6b7280' : '#3b82f6'};
  color: white;
  
  &:hover {
    background: ${props => 
      props.$variant === 'approve' ? '#059669' : 
      props.$variant === 'reject' ? '#dc2626' : 
      props.$variant === 'save' ? '#047857' :
      props.$variant === 'cancel' ? '#4b5563' : '#2563eb'};
  }
`;

// 편집 가능한 필드들
const EditableField = styled.div<{ $isEditing: boolean }>`
  position: relative;
  cursor: ${props => props.$isEditing ? 'default' : 'pointer'};
  color: #ffffff;
  font-size: 14px;
  line-height: 1.5;
  min-height: 20px;
  
  &:hover {
    background: ${props => props.$isEditing ? 'transparent' : 'rgba(16, 185, 129, 0.05)'};
    border-radius: 4px;
    transition: background 0.2s ease;
  }
`;

const EditIcon = styled.span<{ $visible: boolean }>`
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.2s ease;
  font-size: 12px;
  color: #10b981;
  pointer-events: none;
`;

const Input = styled.input`
  width: 100%;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ffffff;
  font-size: 14px;
  padding: 8px;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ffffff;
  font-size: 14px;
  padding: 8px;
  min-height: 60px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ffffff;
  font-size: 14px;
  padding: 8px;
  
  &:focus {
    outline: none;
    border-color: #10b981;
  }
  
  option {
    background: #2a2a2a;
    color: #ffffff;
  }
`;

// Article 스타일
const ArticleCard = styled(CardContainer)``;

const ArticleImageContainer = styled.div`
  width: 100%;
  height: 200px;
  position: relative;
  overflow: hidden;
`;

const ArticleImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ArticleImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  color: #666;
  font-size: 48px;
`;

const ArticleTitleOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 16px;
  color: white;
`;

const ArticleTitle = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
`;

const ArticleContent = styled.div`
  padding: 16px;
  padding-top: 50px;
`;

const CategoryTag = styled.div<{ color: string }>`
  display: inline-block;
  background-color: ${props => props.color};
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
`;

const FieldLabel = styled.label`
  display: block;
  color: #888;
  font-size: 12px;
  margin-bottom: 4px;
  font-weight: 500;
`;

const FieldContainer = styled.div`
  margin-bottom: 16px;
`;

const ArrayFieldContainer = styled.div`
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
  background: #1e1e1e;
`;

const ArrayItem = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
`;

const ArrayButton = styled.button`
  padding: 4px 8px;
  background: #ef4444;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 11px;
  cursor: pointer;
  
  &:hover {
    background: #dc2626;
  }
  
  &.add {
    background: #10b981;
    
    &:hover {
      background: #059669;
    }
  }
`;

// Twitter 스타일
const TwitterCard = styled(CardContainer)`
  padding: 16px;
  padding-top: 50px;
`;

const TwitterHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const ProfileImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
`;

const ProfileImagePlaceholder = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
`;

const AuthorInfo = styled.div`
  flex: 1;
`;

const AuthorName = styled.div`
  color: #ffffff;
  font-weight: 600;
  font-size: 16px;
`;

const AuthorUsername = styled.div`
  color: #888;
  font-size: 14px;
`;

const TwitterIcon = styled.div`
  font-size: 20px;
`;

const TwitterContent = styled.div`
  color: #ffffff;
  font-size: 15px;
  line-height: 1.5;
  margin: 16px 0;
  white-space: pre-wrap;
`;

// YouTube 스타일
const YouTubeCard = styled(CardContainer)``;

const YouTubeThumbnailContainer = styled.div`
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
`;

const YouTubeThumbnail = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PlayButton = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  background: rgba(255, 0, 0, 0.8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &::after {
    content: '▶';
    color: white;
    font-size: 20px;
    margin-left: 4px;
  }
`;

const YouTubeContent = styled.div`
  padding: 16px;
  padding-top: 50px;
`;

const YouTubeTitle = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 8px 0;
`;

const ChannelName = styled.div`
  color: #888;
  font-size: 14px;
  margin-bottom: 12px;
`;

const VideoInfo = styled.div`
  display: flex;
  gap: 8px;
  color: #888;
  font-size: 12px;
  margin-top: 8px;
`;

const ContentCard: React.FC<ContentCardProps> = ({ 
  content, 
  isSelected, 
  onSelect, 
  onApprove, 
  onReject,
  onSave 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ParsedArticle | ParsedTweet | ParsedYouTubeVideo>(content);
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(content.id, e.target.checked);
  };

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApprove(content.id);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReject(content.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditData({ ...content });
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSave) {
      await onSave(editData);
    }
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditData({ ...content });
  };

  const updateField = (field: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateNestedField = (parentField: string, childField: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [parentField]: {
        ...(prev as any)[parentField],
        [childField]: value
      }
    }));
  };

  const updateArrayField = (field: string, index: number, value: string) => {
    setEditData(prev => ({
      ...prev,
      [field]: (prev as any)[field].map((item: string, i: number) => i === index ? value : item)
    }));
  };

  const addArrayItem = (field: string) => {
    setEditData(prev => ({
      ...prev,
      [field]: [...(prev as any)[field], '']
    }));
  };

  const removeArrayItem = (field: string, index: number) => {
    setEditData(prev => ({
      ...prev,
      [field]: (prev as any)[field].filter((_: any, i: number) => i !== index)
    }));
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatViewCount = (count: number | undefined) => {
    if (!count) return '알 수 없음';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatPublishedAt = (date: Date | undefined) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '오늘';
    if (days === 1) return '1일 전';
    if (days < 30) return `${days}일 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
  };

  const getCategoryInfo = (category: number | undefined) => {
    return CATEGORIES[category as keyof typeof CATEGORIES] || CATEGORIES[5];
  };

  const renderEditableField = (
    fieldName: string,
    value: string,
    placeholder: string,
    isTextArea = false,
    onFieldClick?: () => void
  ) => {
    if (isEditing) {
      if (isTextArea) {
        return (
          <TextArea
            value={value}
            onChange={(e) => updateField(fieldName, e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        );
      }
      return (
        <Input
          value={value}
          onChange={(e) => updateField(fieldName, e.target.value)}
          placeholder={placeholder}
        />
      );
    }

    return (
      <EditableField
        $isEditing={false}
        onClick={onFieldClick || (() => setIsEditing(true))}
        onMouseEnter={() => setHoveredField(fieldName)}
        onMouseLeave={() => setHoveredField(null)}
      >
        {value || placeholder}
        <EditIcon $visible={hoveredField === fieldName}>✏️</EditIcon>
      </EditableField>
    );
  };

  // Article 렌더링
  if (content.type === 'article') {
    const article = editData as ParsedArticle;
    const categoryInfo = getCategoryInfo(article.category);

    return (
      <ArticleCard $isEditing={isEditing}>
        <CheckboxContainer>
          <Checkbox
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
          />
        </CheckboxContainer>
        
        <ActionButtons>
          {isEditing ? (
            <>
              <ActionButton $variant="save" onClick={handleSave}>
                저장
              </ActionButton>
              <ActionButton $variant="cancel" onClick={handleCancel}>
                취소
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton $variant="edit" onClick={handleEdit}>
                편집
              </ActionButton>
              <ActionButton $variant="approve" onClick={handleApprove}>
                승인
              </ActionButton>
              <ActionButton $variant="reject" onClick={handleReject}>
                삭제
              </ActionButton>
            </>
          )}
        </ActionButtons>

        <ArticleImageContainer>
          {article.imageUrls && article.imageUrls.length > 0 ? (
            <ArticleImage
              src={article.imageUrls[0]}
              alt={article.titleSummary}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <ArticleImagePlaceholder>📰</ArticleImagePlaceholder>
          )}
          
          <ArticleTitleOverlay>
            <ArticleTitle>
              {isEditing ? (
                <Input
                  value={article.titleSummary}
                  onChange={(e) => updateField('titleSummary', e.target.value)}
                  placeholder="기사 제목"
                  style={{ background: 'rgba(42, 42, 42, 0.9)' }}
                />
              ) : (
                article.titleSummary
              )}
            </ArticleTitle>
          </ArticleTitleOverlay>
        </ArticleImageContainer>

        <ArticleContent>
          <FieldContainer>
            <FieldLabel>카테고리</FieldLabel>
            {isEditing ? (
              <Select
                value={article.category || 5}
                onChange={(e) => updateField('category', parseInt(e.target.value))}
              >
                {Object.entries(CATEGORIES).map(([key, value]) => (
                  <option key={key} value={key}>{value.name}</option>
                ))}
              </Select>
            ) : (
              <CategoryTag color={categoryInfo.color}>
                {categoryInfo.name}
              </CategoryTag>
            )}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>URL</FieldLabel>
            {renderEditableField('url', article.url, '기사 URL을 입력하세요')}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>발행일</FieldLabel>
            <div style={{ color: '#888', fontSize: '14px' }}>
              {formatDate(article.publishedAt)}
            </div>
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>이미지 URL</FieldLabel>
            {isEditing ? (
              <ArrayFieldContainer>
                {article.imageUrls.map((url: string, index: number) => (
                  <ArrayItem key={index}>
                    <TextArea
                      value={url}
                      onChange={(e) => updateArrayField('imageUrls', index, e.target.value)}
                      placeholder="이미지 URL"
                      rows={1}
                      style={{ minHeight: '40px' }}
                    />
                    <ArrayButton onClick={() => removeArrayItem('imageUrls', index)}>
                      삭제
                    </ArrayButton>
                  </ArrayItem>
                ))}
                <ArrayButton className="add" onClick={() => addArrayItem('imageUrls')}>
                  이미지 추가
                </ArrayButton>
              </ArrayFieldContainer>
            ) : (
              <div style={{ color: '#888', fontSize: '14px' }}>
                {article.imageUrls.length}개의 이미지
              </div>
            )}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>요약 및 상세 내용</FieldLabel>
            {isEditing ? (
              <ArrayFieldContainer>
                {article.summaryLines.map((line: string, index: number) => (
                  <div key={index} style={{ marginBottom: '16px', border: '1px solid #333', borderRadius: '6px', background: '#1e1e1e' }}>
                    <ArrayItem>
                      <TextArea
                        value={line}
                        onChange={(e) => updateArrayField('summaryLines', index, e.target.value)}
                        placeholder="요약 내용"
                        rows={2}
                        style={{ marginBottom: '8px' }}
                      />
                      <ArrayButton onClick={() => removeArrayItem('summaryLines', index)}>
                        삭제
                      </ArrayButton>
                    </ArrayItem>
                    <div style={{ padding: '0 8px 8px 8px' }}>
                      <TextArea
                        value={article.details[index] || ''}
                        onChange={(e) => updateArrayField('details', index, e.target.value)}
                        placeholder="상세 설명"
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
                <ArrayButton className="add" onClick={() => {
                  addArrayItem('summaryLines');
                  addArrayItem('details');
                }}>
                  요약 항목 추가
                </ArrayButton>
              </ArrayFieldContainer>
            ) : (
              <div style={{ color: '#fff', fontSize: '14px', lineHeight: '1.5' }}>
                {article.summaryLines.map((line, index) => (
                  <div key={index} style={{ marginBottom: '16px', padding: '12px', background: '#1e1e1e', borderRadius: '6px', border: '1px solid #333' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#10b981' }}>
                      {line}
                    </div>
                    {article.details[index] && (
                      <div style={{ color: '#e0e0e0', fontSize: '13px', lineHeight: '1.6', paddingLeft: '12px', borderLeft: '3px solid #10b981' }}>
                        {article.details[index]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </FieldContainer>
        </ArticleContent>
      </ArticleCard>
    );
  }

  // Tweet 렌더링
  if (content.type === 'tweet') {
    const tweet = editData as ParsedTweet;
    const categoryInfo = getCategoryInfo(tweet.category);

    return (
      <TwitterCard $isEditing={isEditing}>
        <CheckboxContainer>
          <Checkbox
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
          />
        </CheckboxContainer>
        
        <ActionButtons>
          {isEditing ? (
            <>
              <ActionButton $variant="save" onClick={handleSave}>
                저장
              </ActionButton>
              <ActionButton $variant="cancel" onClick={handleCancel}>
                취소
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton $variant="edit" onClick={handleEdit}>
                편집
              </ActionButton>
              <ActionButton $variant="approve" onClick={handleApprove}>
                승인
              </ActionButton>
              <ActionButton $variant="reject" onClick={handleReject}>
                삭제
              </ActionButton>
            </>
          )}
        </ActionButtons>

        <TwitterHeader>
          {tweet.author.profileImageUrl ? (
            <ProfileImage src={tweet.author.profileImageUrl} alt={tweet.author.name} />
          ) : (
            <ProfileImagePlaceholder>👤</ProfileImagePlaceholder>
          )}
          <AuthorInfo>
            <AuthorName>
              {isEditing ? (
                <Input
                  value={tweet.author.name}
                  onChange={(e) => updateNestedField('author', 'name', e.target.value)}
                  placeholder="작성자 이름"
                />
              ) : (
                tweet.author.name
              )}
            </AuthorName>
            <AuthorUsername>
              {isEditing ? (
                <Input
                  value={`@${tweet.author.username}`}
                  onChange={(e) => updateNestedField('author', 'username', e.target.value.replace('@', ''))}
                  placeholder="@사용자명"
                />
              ) : (
                `@${tweet.author.username}`
              )}
            </AuthorUsername>
          </AuthorInfo>
          <TwitterIcon>🐦</TwitterIcon>
        </TwitterHeader>

        <FieldContainer>
          <FieldLabel>원문</FieldLabel>
          {renderEditableField('text', tweet.text, '트위터 원문을 입력하세요', true)}
        </FieldContainer>

        <FieldContainer>
          <FieldLabel>번역문</FieldLabel>
          {renderEditableField('textKo', tweet.textKo || '', '한국어 번역을 입력하세요', true)}
        </FieldContainer>

        <FieldContainer>
          <FieldLabel>프로필 이미지 URL</FieldLabel>
          {isEditing ? (
            <Input
              value={tweet.author.profileImageUrl || ''}
              onChange={(e) => updateNestedField('author', 'profileImageUrl', e.target.value)}
              placeholder="프로필 이미지 URL"
            />
          ) : (
            <div style={{ color: '#888', fontSize: '14px' }}>
              {tweet.author.profileImageUrl || '없음'}
            </div>
          )}
        </FieldContainer>

        <FieldContainer>
          <FieldLabel>URL</FieldLabel>
          {renderEditableField('url', tweet.url, '트위터 URL을 입력하세요')}
        </FieldContainer>

        <FieldContainer>
          <FieldLabel>카테고리</FieldLabel>
          {isEditing ? (
            <Select
              value={tweet.category || 5}
              onChange={(e) => updateField('category', parseInt(e.target.value))}
            >
              {Object.entries(CATEGORIES).map(([key, value]) => (
                <option key={key} value={key}>{value.name}</option>
              ))}
            </Select>
          ) : (
            <CategoryTag color={categoryInfo.color}>
              {categoryInfo.name}
            </CategoryTag>
          )}
        </FieldContainer>
      </TwitterCard>
    );
  }

  // YouTube 렌더링
  if (content.type === 'youtube') {
    const video = editData as ParsedYouTubeVideo;
    const categoryInfo = getCategoryInfo(video.category);

    return (
      <YouTubeCard $isEditing={isEditing}>
        <CheckboxContainer>
          <Checkbox
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
          />
        </CheckboxContainer>
        
        <ActionButtons>
          {isEditing ? (
            <>
              <ActionButton $variant="save" onClick={handleSave}>
                저장
              </ActionButton>
              <ActionButton $variant="cancel" onClick={handleCancel}>
                취소
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton $variant="edit" onClick={handleEdit}>
                편집
              </ActionButton>
              <ActionButton $variant="approve" onClick={handleApprove}>
                승인
              </ActionButton>
              <ActionButton $variant="reject" onClick={handleReject}>
                삭제
              </ActionButton>
            </>
          )}
        </ActionButtons>

        <YouTubeThumbnailContainer>
          <YouTubeThumbnail src={video.thumbnailUrl} alt={video.title} />
          <PlayButton />
        </YouTubeThumbnailContainer>

        <YouTubeContent>
          <FieldContainer>
            <FieldLabel>제목</FieldLabel>
            {renderEditableField('title', video.title, '영상 제목을 입력하세요')}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>채널명</FieldLabel>
            {renderEditableField('channelName', video.channelName, '채널명을 입력하세요')}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>썸네일 URL</FieldLabel>
            {renderEditableField('thumbnailUrl', video.thumbnailUrl, '썸네일 URL을 입력하세요')}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>재생 시간</FieldLabel>
            {renderEditableField('duration', video.duration || '', '재생 시간 (예: 10:30)')}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>조회수</FieldLabel>
            {isEditing ? (
              <Input
                type="number"
                value={video.viewCount || ''}
                onChange={(e) => updateField('viewCount', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="조회수"
              />
            ) : (
              <div style={{ color: '#888', fontSize: '14px' }}>
                {formatViewCount(video.viewCount)}
              </div>
            )}
          </FieldContainer>

          <FieldContainer>
            <FieldLabel>카테고리</FieldLabel>
            {isEditing ? (
              <Select
                value={video.category || 5}
                onChange={(e) => updateField('category', parseInt(e.target.value))}
              >
                {Object.entries(CATEGORIES).map(([key, value]) => (
                  <option key={key} value={key}>{value.name}</option>
                ))}
              </Select>
            ) : (
              <CategoryTag color={categoryInfo.color}>
                {categoryInfo.name}
              </CategoryTag>
            )}
          </FieldContainer>

          <VideoInfo>
            <span>{formatViewCount(video.viewCount)}</span>
            <span>•</span>
            <span>{formatPublishedAt(video.publishedAt)}</span>
          </VideoInfo>
        </YouTubeContent>
      </YouTubeCard>
    );
  }

  return null;
};

export default ContentCard; 
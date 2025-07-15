import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { ParsedArticle, ParsedTweet, ParsedYouTubeVideo } from '../../types';
import { Button, Card } from '../../styles/GlobalStyle';

interface EditModalProps {
  isOpen: boolean;
  content: ParsedArticle | ParsedTweet | ParsedYouTubeVideo | null;
  onClose: () => void;
  onSave: (content: ParsedArticle | ParsedTweet | ParsedYouTubeVideo) => void;
}

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContainer = styled(Card)`
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  background: #1a1a1a;
  border: 1px solid #333;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #333;
`;

const ModalTitle = styled.h2`
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  
  &:hover {
    color: #ffffff;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
  
  option {
    background: #2a2a2a;
    color: #ffffff;
  }
`;

const ArrayInput = styled.div`
  border: 1px solid #444;
  border-radius: 6px;
  background: #2a2a2a;
  padding: 12px;
`;

const ArrayItem = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
`;

const ArrayItemInput = styled.textarea`
  flex: 1;
  min-height: 40px;
  padding: 8px;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ffffff;
  font-size: 13px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #10b981;
  }
`;

const ArrayButton = styled.button`
  padding: 8px 12px;
  background: #ef4444;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
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

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #333;
`;

const CATEGORIES = {
  1: '오픈소스',
  2: '서비스',
  3: '연구',
  4: '비즈니스',
  5: '기타'
};

const EditModal: React.FC<EditModalProps> = ({ isOpen, content, onClose, onSave }) => {
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    if (content) {
      setEditData({ ...content });
    }
  }, [content]);

  const handleSave = () => {
    if (editData) {
      onSave(editData);
    }
  };

  const updateField = (field: string, value: any) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateArrayField = (field: string, index: number, value: string) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: prev[field].map((item: string, i: number) => i === index ? value : item)
    }));
  };

  const addArrayItem = (field: string) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayItem = (field: string, index: number) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index)
    }));
  };

  if (!isOpen || !content || !editData) return null;

  const renderArticleForm = () => {
    const article = editData as ParsedArticle;
    
    return (
      <>
        <FormGroup>
          <Label>제목</Label>
          <Input
            value={article.titleSummary}
            onChange={(e) => updateField('titleSummary', e.target.value)}
            placeholder="기사 제목을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>URL</Label>
          <Input
            value={article.url}
            onChange={(e) => updateField('url', e.target.value)}
            placeholder="기사 URL을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>카테고리</Label>
          <Select
            value={article.category || 5}
            onChange={(e) => updateField('category', parseInt(e.target.value))}
          >
            {Object.entries(CATEGORIES).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>이미지 URL</Label>
          <ArrayInput>
            {article.imageUrls.map((url: string, index: number) => (
              <ArrayItem key={index}>
                <ArrayItemInput
                  value={url}
                  onChange={(e) => updateArrayField('imageUrls', index, e.target.value)}
                  placeholder="이미지 URL을 입력하세요"
                  rows={1}
                />
                <ArrayButton onClick={() => removeArrayItem('imageUrls', index)}>
                  삭제
                </ArrayButton>
              </ArrayItem>
            ))}
            <ArrayButton className="add" onClick={() => addArrayItem('imageUrls')}>
              이미지 추가
            </ArrayButton>
          </ArrayInput>
        </FormGroup>

        <FormGroup>
          <Label>요약</Label>
          <ArrayInput>
            {article.summaryLines.map((line: string, index: number) => (
              <ArrayItem key={index}>
                <ArrayItemInput
                  value={line}
                  onChange={(e) => updateArrayField('summaryLines', index, e.target.value)}
                  placeholder="요약 내용을 입력하세요"
                  rows={2}
                />
                <ArrayButton onClick={() => removeArrayItem('summaryLines', index)}>
                  삭제
                </ArrayButton>
              </ArrayItem>
            ))}
            <ArrayButton className="add" onClick={() => addArrayItem('summaryLines')}>
              요약 추가
            </ArrayButton>
          </ArrayInput>
        </FormGroup>

        <FormGroup>
          <Label>상세 내용</Label>
          <ArrayInput>
            {article.details.map((detail: string, index: number) => (
              <ArrayItem key={index}>
                <ArrayItemInput
                  value={detail}
                  onChange={(e) => updateArrayField('details', index, e.target.value)}
                  placeholder="상세 내용을 입력하세요"
                  rows={3}
                />
                <ArrayButton onClick={() => removeArrayItem('details', index)}>
                  삭제
                </ArrayButton>
              </ArrayItem>
            ))}
            <ArrayButton className="add" onClick={() => addArrayItem('details')}>
              상세 내용 추가
            </ArrayButton>
          </ArrayInput>
        </FormGroup>
      </>
    );
  };

  const renderTweetForm = () => {
    const tweet = editData as ParsedTweet;
    
    return (
      <>
        <FormGroup>
          <Label>원문</Label>
          <TextArea
            value={tweet.text}
            onChange={(e) => updateField('text', e.target.value)}
            placeholder="트위터 원문을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>번역문</Label>
          <TextArea
            value={tweet.textKo || ''}
            onChange={(e) => updateField('textKo', e.target.value)}
            placeholder="한국어 번역을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>작성자 이름</Label>
          <Input
            value={tweet.author.name}
            onChange={(e) => updateField('author', { ...tweet.author, name: e.target.value })}
            placeholder="작성자 이름을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>작성자 사용자명</Label>
          <Input
            value={tweet.author.username}
            onChange={(e) => updateField('author', { ...tweet.author, username: e.target.value })}
            placeholder="@사용자명을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>프로필 이미지 URL</Label>
          <Input
            value={tweet.author.profileImageUrl || ''}
            onChange={(e) => updateField('author', { ...tweet.author, profileImageUrl: e.target.value })}
            placeholder="프로필 이미지 URL을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>카테고리</Label>
          <Select
            value={tweet.category || 5}
            onChange={(e) => updateField('category', parseInt(e.target.value))}
          >
            {Object.entries(CATEGORIES).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>URL</Label>
          <Input
            value={tweet.url}
            onChange={(e) => updateField('url', e.target.value)}
            placeholder="트위터 URL을 입력하세요"
          />
        </FormGroup>
      </>
    );
  };

  const renderYouTubeForm = () => {
    const video = editData as ParsedYouTubeVideo;
    
    return (
      <>
        <FormGroup>
          <Label>제목</Label>
          <Input
            value={video.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="영상 제목을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>채널명</Label>
          <Input
            value={video.channelName}
            onChange={(e) => updateField('channelName', e.target.value)}
            placeholder="채널명을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>썸네일 URL</Label>
          <Input
            value={video.thumbnailUrl}
            onChange={(e) => updateField('thumbnailUrl', e.target.value)}
            placeholder="썸네일 URL을 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>재생 시간</Label>
          <Input
            value={video.duration || ''}
            onChange={(e) => updateField('duration', e.target.value)}
            placeholder="재생 시간을 입력하세요 (예: 10:30)"
          />
        </FormGroup>

        <FormGroup>
          <Label>조회수</Label>
          <Input
            type="number"
            value={video.viewCount || ''}
            onChange={(e) => updateField('viewCount', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="조회수를 입력하세요"
          />
        </FormGroup>

        <FormGroup>
          <Label>카테고리</Label>
          <Select
            value={video.category || 5}
            onChange={(e) => updateField('category', parseInt(e.target.value))}
          >
            {Object.entries(CATEGORIES).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </Select>
        </FormGroup>
      </>
    );
  };

  const getModalTitle = () => {
    switch (content.type) {
      case 'article': return '기사 편집';
      case 'tweet': return '트위터 편집';
      case 'youtube': return '유튜브 영상 편집';
      default: return '컨텐츠 편집';
    }
  };

  return (
    <Overlay isOpen={isOpen} onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{getModalTitle()}</ModalTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>

        {content.type === 'article' && renderArticleForm()}
        {content.type === 'tweet' && renderTweetForm()}
        {content.type === 'youtube' && renderYouTubeForm()}

        <ModalActions>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSave}>
            저장
          </Button>
        </ModalActions>
      </ModalContainer>
    </Overlay>
  );
};

export default EditModal; 
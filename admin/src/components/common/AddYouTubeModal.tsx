import React, { useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { 
  Button, 
  Input, 
  Text, 
  LoadingSpinner,
  Select 
} from '../../styles/GlobalStyle';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  color: #64748b;
  
  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
`;

const VideoPreview = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  background: #f8fafc;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 1rem;
`;

const VideoDetails = styled.div`
  display: grid;
  gap: 1rem;
`;

const DetailRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const DetailLabel = styled.span`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const DetailValue = styled.span`
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  resize: vertical;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &:disabled {
    background: #f9fafb;
    color: #6b7280;
  }
`;

const CategoryInfo = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 0.5rem;
`;

const CategoryList = styled.ul`
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
`;

interface VideoInfo {
  title: string;
  channel: string;
  thumbnail: string;
  videoId: string;
  uploadDate: string;
  duration: string;
  viewCount: number;
  description: string;
}

interface AddYouTubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (videoInfo: VideoInfo & { customTitle: string; category: number }) => Promise<void>;
}

export const AddYouTubeModal: React.FC<AddYouTubeModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [category, setCategory] = useState<number>(5); // 기본값: 기타
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 유튜브 URL에서 비디오 ID 추출
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  };

  // YouTube Data API를 통해 비디오 정보 가져오기
  const fetchVideoInfo = async (videoId: string): Promise<VideoInfo> => {
    const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;
    
    try {
      // YouTube Data API가 설정되어 있는 경우 실제 API 호출
      if (API_KEY && API_KEY !== 'your_youtube_api_key_here') {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${API_KEY}&part=snippet,contentDetails,statistics`
        );
        
        if (response.ok) {
          const data = await response.json();
          const video = data.items?.[0];
          
          if (video) {
            // ISO 8601 duration을 사람이 읽기 쉬운 형태로 변환
            const duration = parseDuration(video.contentDetails.duration);
            
            return {
              title: video.snippet.title,
              channel: video.snippet.channelTitle,
              thumbnail: video.snippet.thumbnails.maxresdefault?.url || 
                        video.snippet.thumbnails.high?.url || 
                        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              videoId,
              uploadDate: video.snippet.publishedAt.split('T')[0],
              duration,
              viewCount: parseInt(video.statistics.viewCount || '0'),
              description: video.snippet.description || ''
            };
          }
        }
      }
      
      // API가 없거나 실패한 경우 더미 데이터 제공
      return {
        title: `🎥 YouTube 영상 (${videoId})`,
        channel: 'YouTube',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId,
        uploadDate: new Date().toISOString().split('T')[0],
        duration: '정보 없음',
        viewCount: 0,
        description: 'YouTube API 키가 설정되지 않아 상세 정보를 가져올 수 없습니다.'
      };
    } catch (error) {
      console.error('YouTube API 오류:', error);
      
      // 오류 발생 시 기본 정보 제공
      return {
        title: `YouTube 영상 ${videoId}`,
        channel: '알 수 없음',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId,
        uploadDate: new Date().toISOString().split('T')[0],
        duration: '00:00',
        viewCount: 0,
        description: '영상 정보를 가져오는데 실패했습니다.'
      };
    }
  };

  // YouTube의 ISO 8601 duration을 사람이 읽기 쉬운 형태로 변환
  const parseDuration = (duration: string): string => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '00:00';
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setVideoInfo(null);
    setCustomTitle('');

    if (!newUrl.trim()) return;

    const videoId = extractVideoId(newUrl);
    if (!videoId) {
      toast.error('올바른 유튜브 URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const info = await fetchVideoInfo(videoId);
      setVideoInfo(info);
      setCustomTitle(info.title); // 기본값으로 원본 제목 설정
    } catch (error) {
      console.error('비디오 정보 로드 실패:', error);
      toast.error('비디오 정보를 가져올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카테고리 정보
  const categories = [
    { value: 1, label: '오픈소스', description: '오픈소스 프로젝트, 라이브러리, 도구' },
    { value: 2, label: '서비스', description: '새로운 서비스, 플랫폼, 제품 출시' },
    { value: 3, label: '연구', description: '학술 연구, 논문, 기술 연구' },
    { value: 4, label: '비즈니스/산업', description: '산업 동향, 기업 소식, 투자' },
    { value: 5, label: '기타', description: '기타 기술 관련 소식' }
  ];

  const getCategoryLabel = (categoryValue: number) => {
    const cat = categories.find(c => c.value === categoryValue);
    return cat ? cat.label : '기타';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoInfo) {
      toast.error('먼저 유효한 유튜브 URL을 입력해주세요.');
      return;
    }

    if (!customTitle.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...videoInfo,
        customTitle: customTitle.trim(),
        category
      });
      handleClose();
      toast.success('유튜브 영상이 추가되었습니다.');
    } catch (error) {
      console.error('영상 추가 실패:', error);
      toast.error('영상 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setVideoInfo(null);
    setCustomTitle('');
    setCategory(5);
    setLoading(false);
    setSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={handleClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <Text size="lg" weight="bold">유튜브 영상 추가</Text>
          <CloseButton onClick={handleClose}>×</CloseButton>
        </ModalHeader>

        <Form onSubmit={handleSubmit}>
          <InputGroup>
            <Label htmlFor="youtube-url">유튜브 URL</Label>
            <Input
              id="youtube-url"
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading || submitting}
            />
            <Text size="sm" color="muted">
              <span>
                유튜브 영상 링크를 붙여넣으면 자동으로 정보를 가져옵니다.
                {!process.env.REACT_APP_YOUTUBE_API_KEY && (
                  <>
                    <br />
                    <span style={{ color: '#f59e0b' }}>
                      ⚠️ YouTube API 키가 설정되지 않아 기본 정보만 제공됩니다.
                    </span>
                  </>
                )}
              </span>
            </Text>
          </InputGroup>

          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <LoadingSpinner />
              <Text size="sm" color="muted" style={{ marginTop: '0.5rem' }}>
                영상 정보를 가져오는 중...
              </Text>
            </div>
          )}

          {videoInfo && !loading && (
            <>
              <VideoPreview>
                <PreviewImage 
                  src={videoInfo.thumbnail} 
                  alt={videoInfo.title}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://img.youtube.com/vi/${videoInfo.videoId}/hqdefault.jpg`;
                  }}
                />
                <VideoDetails>
                  <DetailRow>
                    <DetailLabel>원본 제목</DetailLabel>
                    <DetailValue>{videoInfo.title}</DetailValue>
                  </DetailRow>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <DetailRow>
                      <DetailLabel>채널</DetailLabel>
                      <DetailValue>{videoInfo.channel}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                      <DetailLabel>업로드일</DetailLabel>
                      <DetailValue>{formatDate(videoInfo.uploadDate)}</DetailValue>
                    </DetailRow>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <DetailRow>
                      <DetailLabel>재생시간</DetailLabel>
                      <DetailValue>{videoInfo.duration}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                      <DetailLabel>조회수</DetailLabel>
                      <DetailValue>{formatNumber(videoInfo.viewCount)}회</DetailValue>
                    </DetailRow>
                  </div>
                </VideoDetails>
              </VideoPreview>

              <InputGroup>
                <Label htmlFor="custom-title">커스텀 제목</Label>
                <TextArea
                  id="custom-title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="뉴스에 표시될 제목을 입력하세요..."
                  disabled={submitting}
                  rows={2}
                />
                <Text size="sm" color="muted">
                  원본 제목을 수정하여 뉴스에 적합한 제목으로 변경할 수 있습니다.
                </Text>
              </InputGroup>

              <InputGroup>
                <Label htmlFor="category">카테고리</Label>
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(Number(e.target.value))}
                  disabled={submitting}
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </Select>
                <CategoryInfo>
                  <Text size="sm" weight="medium" color="primary">
                    {getCategoryLabel(category)}
                  </Text>
                  <Text size="sm" color="muted" style={{ marginTop: '0.25rem' }}>
                    {categories.find(c => c.value === category)?.description}
                  </Text>
                  <CategoryList>
                    <li><strong>1. 오픈소스:</strong> 오픈소스 프로젝트, 라이브러리, 도구</li>
                    <li><strong>2. 서비스:</strong> 새로운 서비스, 플랫폼, 제품 출시</li>
                    <li><strong>3. 연구:</strong> 학술 연구, 논문, 기술 연구</li>
                    <li><strong>4. 비즈니스/산업:</strong> 산업 동향, 기업 소식, 투자</li>
                    <li><strong>5. 기타:</strong> 기타 기술 관련 소식</li>
                  </CategoryList>
                </CategoryInfo>
              </InputGroup>
            </>
          )}

          <ButtonGroup>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={handleClose}
              disabled={submitting}
            >
              취소
            </Button>
            <Button 
              type="submit" 
              disabled={!videoInfo || !customTitle.trim() || loading || submitting}
            >
              {submitting ? '추가 중...' : '영상 추가'}
            </Button>
          </ButtonGroup>
        </Form>
      </ModalContent>
    </ModalOverlay>
  );
}; 
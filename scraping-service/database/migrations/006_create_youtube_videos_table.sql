-- 유튜브 영상 테이블 생성
CREATE TABLE IF NOT EXISTS youtube_videos (
  id VARCHAR(20) PRIMARY KEY,  -- YouTube 영상 ID (예: DQacCB9tDaw)
  title TEXT NOT NULL,         -- 영상 제목
  thumbnail_url TEXT NOT NULL, -- 썸네일 URL
  channel_name TEXT NOT NULL,  -- 채널명
  published_at TIMESTAMP NOT NULL, -- 영상 업로드 시간
  duration VARCHAR(10),        -- 영상 길이 (예: 15:42)
  view_count INTEGER,          -- 조회수
  
  -- 메타 정보
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 스크래핑 시간
  is_active BOOLEAN DEFAULT TRUE,  -- 활성 상태
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published_at ON youtube_videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_is_active ON youtube_videos(is_active);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_scraped_at ON youtube_videos(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_name ON youtube_videos(channel_name);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_youtube_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_youtube_videos_updated_at
  BEFORE UPDATE ON youtube_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_youtube_videos_updated_at();

-- 샘플 데이터 삽입 (개발용)
INSERT INTO youtube_videos (id, title, thumbnail_url, channel_name, published_at, duration, view_count) VALUES
('DQacCB9tDaw', 'GPT-4o 완전 분석: 새로운 멀티모달 AI의 모든 것', 'https://img.youtube.com/vi/DQacCB9tDaw/maxresdefault.jpg', '딥러닝 논문 읽기', '2024-01-10 14:30:00', '15:42', 125000),
('abc123def45', 'Claude 3.5 vs GPT-4: 실제 코딩 테스트 비교', 'https://img.youtube.com/vi/abc123def45/maxresdefault.jpg', 'AI 코딩 채널', '2024-01-08 09:15:00', '22:18', 89000),
('xyz789uvw12', '2024년 AI 트렌드 총정리: 올해 놓치면 안 될 기술들', 'https://img.youtube.com/vi/xyz789uvw12/maxresdefault.jpg', 'AI 트렌드', '2024-01-05 16:45:00', '18:33', 203000)
ON CONFLICT (id) DO NOTHING; 
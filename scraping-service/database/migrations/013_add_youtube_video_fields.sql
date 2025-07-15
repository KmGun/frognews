-- 유튜브 영상 테이블에 추가 필드들 추가

-- 설명 컬럼 추가
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- tags 컬럼은 제거 (카테고리 시스템 사용)

-- 영상 URL 컬럼 추가
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 좋아요 수 컬럼 추가
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- 댓글 수 컬럼 추가
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- 카테고리 컬럼 추가 (1=오픈소스, 2=서비스, 3=연구, 4=비즈니스/산업, 5=기타)
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS category INTEGER DEFAULT 5;

-- 코멘트 추가
COMMENT ON COLUMN youtube_videos.category IS '영상 카테고리: 1=오픈소스, 2=서비스, 3=연구, 4=비즈니스/산업, 5=기타';

-- 값 범위 제약조건 (1~5)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_youtube_category_range' 
        AND table_name = 'youtube_videos'
    ) THEN
        ALTER TABLE youtube_videos 
        ADD CONSTRAINT check_youtube_category_range 
        CHECK (category IS NULL OR (category >= 1 AND category <= 5));
    END IF;
END $$;

-- 승인 상태 컬럼 추가
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- 기존 데이터의 video_url 업데이트
UPDATE youtube_videos 
SET video_url = 'https://www.youtube.com/watch?v=' || id 
WHERE video_url IS NULL;

-- video_url을 NOT NULL로 변경
ALTER TABLE youtube_videos 
ALTER COLUMN video_url SET NOT NULL;

-- 새로운 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_youtube_videos_category ON youtube_videos(category);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_is_approved ON youtube_videos(is_approved); 
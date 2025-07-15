-- 모든 컨텐츠 테이블에 승인 상태 필드 추가
-- 기본값은 false로 설정하여 관리자 승인 후에만 프론트엔드에 표시되도록 함

-- 1. articles 테이블에 is_approved 컬럼 추가
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. tweets 테이블에 is_approved 컬럼 추가  
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 3. youtube_videos 테이블에 is_approved 컬럼 추가
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 4. 인덱스 추가 (승인된 컨텐츠 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_articles_is_approved ON articles(is_approved);
CREATE INDEX IF NOT EXISTS idx_tweets_is_approved ON tweets(is_approved);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_is_approved ON youtube_videos(is_approved);

-- 5. 복합 인덱스 추가 (승인된 활성 컨텐츠 조회)
-- articles는 is_approved + created_at
CREATE INDEX IF NOT EXISTS idx_articles_approved_created ON articles(is_approved, created_at DESC) WHERE is_approved = TRUE;

-- tweets는 is_approved + created_at  
CREATE INDEX IF NOT EXISTS idx_tweets_approved_created ON tweets(is_approved, created_at DESC) WHERE is_approved = TRUE;

-- youtube_videos는 is_approved + published_at
CREATE INDEX IF NOT EXISTS idx_youtube_videos_approved_published ON youtube_videos(is_approved, published_at DESC) WHERE is_approved = TRUE;

-- 6. 컬럼 설명 추가
COMMENT ON COLUMN articles.is_approved IS '관리자 승인 여부 (TRUE: 승인됨, FALSE: 미승인)';
COMMENT ON COLUMN tweets.is_approved IS '관리자 승인 여부 (TRUE: 승인됨, FALSE: 미승인)';
COMMENT ON COLUMN youtube_videos.is_approved IS '관리자 승인 여부 (TRUE: 승인됨, FALSE: 미승인)';

-- 7. 기존 데이터 일괄 승인 (선택사항 - 필요시 주석 해제)
-- UPDATE articles SET is_approved = TRUE WHERE is_approved = FALSE;
-- UPDATE tweets SET is_approved = TRUE WHERE is_approved = FALSE;
-- UPDATE youtube_videos SET is_approved = TRUE WHERE is_approved = FALSE; 
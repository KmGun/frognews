-- Create tweets table for storing Twitter posts
-- This migration creates a separate table for Twitter posts with all necessary fields

-- 1. Create tweets table
CREATE TABLE IF NOT EXISTS tweets (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  url TEXT NOT NULL UNIQUE,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- 2. Add comments to explain the columns
COMMENT ON TABLE tweets IS '트위터 게시물 저장 테이블';
COMMENT ON COLUMN tweets.id IS '트위터 게시물 고유 ID';
COMMENT ON COLUMN tweets.text IS '트위터 게시물 본문';
COMMENT ON COLUMN tweets.author_name IS '작성자 표시 이름';
COMMENT ON COLUMN tweets.author_username IS '작성자 사용자명 (@username)';
COMMENT ON COLUMN tweets.author_profile_image_url IS '작성자 프로필 이미지 URL';
COMMENT ON COLUMN tweets.created_at IS '트위터 게시물 작성 시간';
COMMENT ON COLUMN tweets.url IS '트위터 게시물 원본 URL';
COMMENT ON COLUMN tweets.likes IS '좋아요 수';
COMMENT ON COLUMN tweets.retweets IS '리트윗 수';
COMMENT ON COLUMN tweets.replies IS '댓글 수';
COMMENT ON COLUMN tweets.scraped_at IS '스크래핑 시간';
COMMENT ON COLUMN tweets.is_active IS '활성 상태 (삭제된 트윗은 false)';

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_author_username ON tweets(author_username);
CREATE INDEX IF NOT EXISTS idx_tweets_scraped_at ON tweets(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_is_active ON tweets(is_active);

-- 4. Add constraint for URL uniqueness
ALTER TABLE tweets 
ADD CONSTRAINT unique_tweet_url UNIQUE (url);

-- 5. Check current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position; 
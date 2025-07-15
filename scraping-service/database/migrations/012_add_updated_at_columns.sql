-- 012_add_updated_at_columns.sql
-- 모든 테이블에 updated_at 컬럼 추가 및 자동 업데이트 트리거 설정
-- Supabase Dashboard SQL Editor에서 실행하세요

-- 1. updated_at 자동 업데이트를 위한 트리거 함수 생성 (이미 있으면 덮어쓰기)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. articles 테이블에 updated_at 컬럼 추가
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 기존 레코드의 updated_at을 created_at 값으로 초기화
UPDATE articles 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

-- updated_at을 NOT NULL로 변경
ALTER TABLE articles 
ALTER COLUMN updated_at SET NOT NULL;

-- articles 테이블의 updated_at 자동 업데이트 트리거 생성
DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 3. tweets 테이블에 updated_at 컬럼 추가
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 기존 레코드의 updated_at을 created_at 값으로 초기화
UPDATE tweets 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

-- updated_at을 NOT NULL로 변경
ALTER TABLE tweets 
ALTER COLUMN updated_at SET NOT NULL;

-- tweets 테이블의 updated_at 자동 업데이트 트리거 생성
DROP TRIGGER IF EXISTS update_tweets_updated_at ON tweets;
CREATE TRIGGER update_tweets_updated_at 
    BEFORE UPDATE ON tweets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 4. youtube_videos 테이블은 이미 updated_at이 있으므로 트리거만 확인
-- (006_create_youtube_videos_table.sql에서 이미 생성됨)

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_updated_at ON tweets(updated_at DESC);

-- 6. 컬럼 설명 추가
COMMENT ON COLUMN articles.updated_at IS '마지막 수정 시간 (자동 업데이트)';
COMMENT ON COLUMN tweets.updated_at IS '마지막 수정 시간 (자동 업데이트)';

-- 7. 현재 테이블 구조 확인
SELECT 
    'articles' as table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'articles' 
ORDER BY ordinal_position

UNION ALL

SELECT 
    'tweets' as table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position

UNION ALL

SELECT 
    'youtube_videos' as table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'youtube_videos' 
ORDER BY ordinal_position; 
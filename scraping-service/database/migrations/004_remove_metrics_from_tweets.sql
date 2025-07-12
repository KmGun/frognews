-- Remove metrics columns from tweets table
-- This migration removes likes, retweets, and replies columns to simplify the table

-- 1. Remove metrics columns
ALTER TABLE tweets DROP COLUMN IF EXISTS likes;
ALTER TABLE tweets DROP COLUMN IF EXISTS retweets;
ALTER TABLE tweets DROP COLUMN IF EXISTS replies;

-- 2. Update table comment
COMMENT ON TABLE tweets IS '트위터 게시물 저장 테이블 (메트릭스 제거됨)';

-- 3. Verify remaining columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position; 
-- Remove management columns from tweets table
-- This migration removes scraped_at and is_active columns

-- 1. Drop management columns
ALTER TABLE tweets DROP COLUMN IF EXISTS scraped_at;
ALTER TABLE tweets DROP COLUMN IF EXISTS is_active;

-- 2. Drop related indexes
DROP INDEX IF EXISTS idx_tweets_scraped_at;
DROP INDEX IF EXISTS idx_tweets_is_active;

-- 3. Check updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position; 
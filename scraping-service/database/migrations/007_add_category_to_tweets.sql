-- 트위터 게시물 테이블에 카테고리 컬럼 추가
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS category INTEGER;

-- 코멘트 추가
COMMENT ON COLUMN tweets.category IS '트윗 카테고리: 1=오픈소스, 2=서비스, 3=연구, 4=비즈니스/산업, 5=기타';

-- 값 범위 제약조건 (1~5)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_tweet_category_range' 
        AND table_name = 'tweets'
    ) THEN
        ALTER TABLE tweets 
        ADD CONSTRAINT check_tweet_category_range 
        CHECK (category IS NULL OR (category >= 1 AND category <= 5));
    END IF;
END $$;

-- 인덱스 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_tweets_category'
    ) THEN
        CREATE INDEX idx_tweets_category ON tweets(category);
    END IF;
END $$; 
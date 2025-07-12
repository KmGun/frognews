-- Add category column to articles table
-- This migration adds a category column to classify articles by type
-- Categories: 1=오픈소스, 2=서비스, 3=연구, 4=비즈니스/산업, 5=기타

-- 1. Add category column if it doesn't exist
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS category INTEGER;

-- 2. Add comment to explain the category values
COMMENT ON COLUMN articles.category IS '기사 카테고리: 1=오픈소스, 2=서비스, 3=연구, 4=비즈니스/산업, 5=기타';

-- 3. Add check constraint only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_category_range' 
        AND table_name = 'articles'
    ) THEN
        ALTER TABLE articles 
        ADD CONSTRAINT check_category_range 
        CHECK (category IS NULL OR (category >= 1 AND category <= 5));
    END IF;
END $$;

-- 4. Create index only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_articles_category'
    ) THEN
        CREATE INDEX idx_articles_category ON articles(category);
    END IF;
END $$; 
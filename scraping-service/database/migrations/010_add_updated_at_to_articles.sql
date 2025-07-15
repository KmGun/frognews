-- 010_add_updated_at_to_articles.sql
-- articles 테이블에 updated_at 컬럼 추가 및 자동 업데이트 트리거 설정

-- 1. articles 테이블에 updated_at 컬럼 추가
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. 기존 레코드의 updated_at을 created_at 값으로 초기화
UPDATE articles 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 3. updated_at을 NOT NULL로 변경
ALTER TABLE articles 
ALTER COLUMN updated_at SET NOT NULL;

-- 4. articles 테이블의 updated_at 자동 업데이트 트리거 생성
-- (트리거 함수는 이미 009_create_user_tables.sql에서 생성됨)
CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);

-- 6. 컬럼 설명 추가
COMMENT ON COLUMN articles.updated_at IS '마지막 수정 시간 (자동 업데이트)';

-- 7. 현재 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'articles' 
ORDER BY ordinal_position; 
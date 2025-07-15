-- 011_add_updated_at_to_tweets.sql
-- tweets 테이블에 updated_at 컬럼 추가 및 자동 업데이트 트리거 설정

-- 1. tweets 테이블에 updated_at 컬럼 추가
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. 기존 레코드의 updated_at을 created_at 값으로 초기화
UPDATE tweets 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 3. updated_at을 NOT NULL로 변경
ALTER TABLE tweets 
ALTER COLUMN updated_at SET NOT NULL;

-- 4. tweets 테이블의 updated_at 자동 업데이트 트리거 생성
CREATE TRIGGER update_tweets_updated_at 
    BEFORE UPDATE ON tweets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tweets_updated_at ON tweets(updated_at DESC);

-- 6. 컬럼 설명 추가
COMMENT ON COLUMN tweets.updated_at IS '마지막 수정 시간 (자동 업데이트)'; 
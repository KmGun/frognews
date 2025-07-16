-- 015_add_media_fields_to_tweets.sql
-- tweets 테이블에 미디어 정보 및 외부 링크 정보 컬럼 추가

-- 1. media 정보를 저장할 JSON 컬럼 추가
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS media JSONB;

-- 2. external_links 정보를 저장할 JSON 컬럼 추가  
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS external_links JSONB;

-- 3. 인덱스 추가 (JSON 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tweets_media_gin ON tweets USING GIN (media);
CREATE INDEX IF NOT EXISTS idx_tweets_external_links_gin ON tweets USING GIN (external_links);

-- 4. 컬럼 설명 추가
COMMENT ON COLUMN tweets.media IS '트위터 게시물 미디어 정보 (이미지, 동영상, GIF) - JSON 배열';
COMMENT ON COLUMN tweets.external_links IS '트위터 게시물 외부 링크 카드 정보 - JSON 배열';

-- 5. 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position;

-- 6. 미디어 JSON 스키마 예시:
-- media: [
--   {
--     "type": "image",
--     "url": "https://pbs.twimg.com/media/...",
--     "altText": "설명 텍스트"
--   },
--   {
--     "type": "video", 
--     "url": "https://video.twimg.com/...",
--     "thumbnailUrl": "https://pbs.twimg.com/..."
--   }
-- ]

-- 7. external_links JSON 스키마 예시:
-- external_links: [
--   {
--     "url": "https://example.com",
--     "title": "링크 제목",
--     "description": "링크 설명",
--     "thumbnailUrl": "https://example.com/thumb.jpg"
--   }
-- ] 
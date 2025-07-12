-- 트위터 게시물 테이블에 번역 관련 컬럼 추가
ALTER TABLE tweets 
ADD COLUMN text_ko TEXT,
ADD COLUMN is_translated BOOLEAN DEFAULT false,
ADD COLUMN translation_model VARCHAR(50),
ADD COLUMN translated_at TIMESTAMP WITH TIME ZONE;

-- 인덱스 추가
CREATE INDEX idx_tweets_is_translated ON tweets(is_translated);
CREATE INDEX idx_tweets_translated_at ON tweets(translated_at);

-- 코멘트 추가
COMMENT ON COLUMN tweets.text_ko IS '한국어 번역 텍스트';
COMMENT ON COLUMN tweets.is_translated IS '번역 여부';
COMMENT ON COLUMN tweets.translation_model IS '번역에 사용된 모델명';
COMMENT ON COLUMN tweets.translated_at IS '번역 완료 시각'; 
-- Add video embed fields to tweets table
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS video_embed_info JSONB;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweets_has_video ON tweets(has_video) WHERE has_video = TRUE;
CREATE INDEX IF NOT EXISTS idx_tweets_video_embed_info ON tweets USING GIN (video_embed_info) WHERE video_embed_info IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN tweets.has_video IS '트위터 게시물에 비디오가 포함되어 있는지 여부';
COMMENT ON COLUMN tweets.video_embed_info IS '트위터 비디오 임베드를 위한 정보 (tweetId, username, embedUrl)'; 
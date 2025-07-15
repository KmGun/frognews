-- 009_create_user_tables.sql
-- 사용자 관리 및 읽은 기사 추적을 위한 테이블 생성

-- users 테이블 생성
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL, -- 익명 사용자를 위한 세션 ID
    user_agent TEXT, -- 브라우저 정보
    first_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_visit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_articles_read INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- user_read_articles 테이블 생성 (사용자가 읽은 기사 추적)
CREATE TABLE IF NOT EXISTS user_read_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reading_duration INTEGER DEFAULT 0, -- 읽은 시간 (초 단위)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, article_id) -- 같은 사용자가 같은 기사를 중복으로 기록하지 않도록
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_session_id ON users(session_id);
CREATE INDEX IF NOT EXISTS idx_user_read_articles_user_id ON user_read_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_read_articles_article_id ON user_read_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_user_read_articles_read_at ON user_read_articles(read_at);

-- updated_at 자동 업데이트를 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- users 테이블의 updated_at 자동 업데이트 트리거
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 총 읽은 기사 수 증가 함수
CREATE OR REPLACE FUNCTION increment_total_articles_read(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET total_articles_read = total_articles_read + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- 댓글: 
-- session_id는 프론트엔드에서 생성된 UUID를 사용하여 익명 사용자 추적
-- reading_duration은 3초 이상일 때만 "읽은 것"으로 간주
-- 추후 로그인 기능 추가 시 users 테이블에 email, username 등 필드 추가 가능 
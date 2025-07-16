-- 016_create_user_clicked_articles.sql
-- 사용자가 클릭한 기사를 추적하기 위한 테이블 생성
-- 클릭한 기사는 즉시 어둡게 표시되고, 3초 이상 읽은 기사는 별도로 user_read_articles에 저장

-- 1. user_clicked_articles 테이블 생성
CREATE TABLE IF NOT EXISTS user_clicked_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, article_id) -- 같은 사용자가 같은 기사를 중복으로 클릭해도 하나만 기록
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_clicked_articles_user_id ON user_clicked_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clicked_articles_article_id ON user_clicked_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_user_clicked_articles_clicked_at ON user_clicked_articles(clicked_at DESC);

-- 3. 복합 인덱스 (사용자별 클릭 기사 조회용)
CREATE INDEX IF NOT EXISTS idx_user_clicked_articles_user_clicked ON user_clicked_articles(user_id, clicked_at DESC);

-- 4. 컬럼 설명 추가
COMMENT ON TABLE user_clicked_articles IS '사용자가 클릭한 기사 추적 테이블 (즉시 어둡게 표시용)';
COMMENT ON COLUMN user_clicked_articles.user_id IS '사용자 ID (users 테이블 참조)';
COMMENT ON COLUMN user_clicked_articles.article_id IS '기사 ID (articles 테이블 참조)';
COMMENT ON COLUMN user_clicked_articles.clicked_at IS '기사를 클릭한 시간';
COMMENT ON COLUMN user_clicked_articles.created_at IS '레코드 생성 시간';

-- 5. 사용자가 클릭한 기사 ID 목록을 조회하는 함수
CREATE OR REPLACE FUNCTION get_clicked_article_ids(p_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    result TEXT[];
BEGIN
    SELECT ARRAY_AGG(article_id::TEXT)
    INTO result
    FROM user_clicked_articles
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- 6. 기사 클릭을 기록하는 함수 (UPSERT)
CREATE OR REPLACE FUNCTION mark_article_as_clicked(p_user_id UUID, p_article_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO user_clicked_articles (user_id, article_id)
    VALUES (p_user_id, p_article_id)
    ON CONFLICT (user_id, article_id) 
    DO UPDATE SET clicked_at = NOW();
    
    -- 클릭 시간 업데이트 (이미 클릭했어도 최신 시간으로 갱신)
END;
$$ LANGUAGE plpgsql;

-- 7. 사용자의 모든 읽음 상태 조회 함수 (클릭 + 실제 읽음)
CREATE OR REPLACE FUNCTION get_user_article_status(p_user_id UUID)
RETURNS TABLE (
    article_id UUID,
    is_clicked BOOLEAN,
    is_read BOOLEAN,
    clicked_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    reading_duration INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as article_id,
        (c.article_id IS NOT NULL) as is_clicked,
        (r.article_id IS NOT NULL AND r.reading_duration >= 3) as is_read,
        c.clicked_at,
        r.read_at,
        r.reading_duration
    FROM articles a
    LEFT JOIN user_clicked_articles c ON a.id = c.article_id AND c.user_id = p_user_id
    LEFT JOIN user_read_articles r ON a.id = r.article_id AND r.user_id = p_user_id
    WHERE c.article_id IS NOT NULL OR r.article_id IS NOT NULL
    ORDER BY COALESCE(c.clicked_at, r.read_at) DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. 읽음 상태 통계 함수
CREATE OR REPLACE FUNCTION get_user_reading_stats(p_user_id UUID)
RETURNS TABLE (
    total_clicked INTEGER,
    total_read INTEGER,
    read_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM user_clicked_articles WHERE user_id = p_user_id)::INTEGER as total_clicked,
        (SELECT COUNT(*) FROM user_read_articles WHERE user_id = p_user_id AND reading_duration >= 3)::INTEGER as total_read,
        CASE 
            WHEN (SELECT COUNT(*) FROM user_clicked_articles WHERE user_id = p_user_id) > 0 
            THEN ROUND(
                (SELECT COUNT(*) FROM user_read_articles WHERE user_id = p_user_id AND reading_duration >= 3)::NUMERIC * 100.0 / 
                (SELECT COUNT(*) FROM user_clicked_articles WHERE user_id = p_user_id)::NUMERIC, 
                2
            )
            ELSE 0.0
        END as read_percentage;
END;
$$ LANGUAGE plpgsql;

-- 9. 오래된 클릭 기록 정리 함수 (30일 이상 된 기록 삭제)
CREATE OR REPLACE FUNCTION cleanup_old_clicked_articles()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_clicked_articles 
    WHERE clicked_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10. 테이블 및 함수 생성 확인
SELECT 
    'user_clicked_articles' as table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_clicked_articles' 
ORDER BY ordinal_position;

-- 11. 함수 목록 확인
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN (
    'get_clicked_article_ids',
    'mark_article_as_clicked', 
    'get_user_article_status',
    'get_user_reading_stats',
    'cleanup_old_clicked_articles'
)
ORDER BY routine_name; 
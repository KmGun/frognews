-- 014_check_created_at_columns.sql
-- articles, tweets, youtube_videos 테이블의 created_at 컬럼 존재 여부 확인
-- 모든 테이블에 created_at 컬럼이 이미 존재하므로 추가 작업이 필요하지 않음

-- 1. 각 테이블의 created_at 컬럼 정보 조회
SELECT 
    'articles' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'articles' 
AND column_name = 'created_at'

UNION ALL

SELECT 
    'tweets' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
AND column_name = 'created_at'

UNION ALL

SELECT 
    'youtube_videos' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'youtube_videos' 
AND column_name = 'created_at'

ORDER BY table_name;

-- 2. 각 테이블의 created_at 인덱스 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('articles', 'tweets', 'youtube_videos')
AND indexdef LIKE '%created_at%'
ORDER BY tablename;

-- 3. 각 테이블의 샘플 데이터 확인 (created_at 컬럼 포함)
SELECT 'articles' as table_name, COUNT(*) as total_count, 
       MIN(created_at) as earliest_created, 
       MAX(created_at) as latest_created
FROM articles
WHERE created_at IS NOT NULL

UNION ALL

SELECT 'tweets' as table_name, COUNT(*) as total_count,
       MIN(created_at) as earliest_created,
       MAX(created_at) as latest_created  
FROM tweets
WHERE created_at IS NOT NULL

UNION ALL

SELECT 'youtube_videos' as table_name, COUNT(*) as total_count,
       MIN(created_at) as earliest_created,
       MAX(created_at) as latest_created
FROM youtube_videos
WHERE created_at IS NOT NULL

ORDER BY table_name;

-- 결론: 모든 테이블에 created_at 컬럼이 이미 존재합니다.
-- 추가 작업이 필요하지 않습니다. 
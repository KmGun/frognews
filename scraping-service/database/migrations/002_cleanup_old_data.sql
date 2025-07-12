-- Optional: Clean up old data without category
-- 이 스크립트는 선택사항입니다. 기존 데이터를 완전히 삭제하고 새로 시작하려면 실행하세요.

-- 1. 기존 데이터 모두 삭제 (선택사항)
-- DELETE FROM articles;

-- 2. 또는 특정 조건의 데이터만 삭제 (예: 오래된 데이터)
-- DELETE FROM articles WHERE created_at < NOW() - INTERVAL '30 days';

-- 3. 또는 category가 NULL인 데이터만 삭제
-- DELETE FROM articles WHERE category IS NULL;

-- 4. 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'articles' 
ORDER BY ordinal_position;

-- 5. 현재 데이터 상태 확인
SELECT 
  COUNT(*) as total_articles,
  COUNT(category) as articles_with_category,
  COUNT(*) - COUNT(category) as articles_without_category
FROM articles; 
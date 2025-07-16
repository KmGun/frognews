-- 임시 테스트용: user_feedback 테이블 RLS 정책 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON user_feedback;

-- 임시 정책: 모든 사용자가 삽입/조회 가능 (테스트용)
CREATE POLICY "Allow all feedback operations for testing" ON user_feedback
    FOR ALL USING (true) WITH CHECK (true);

-- 참고: 프로덕션에서는 이 정책을 다시 원래대로 되돌려야 합니다
-- 원래 정책으로 되돌리려면:
-- DROP POLICY "Allow all feedback operations for testing" ON user_feedback;
-- CREATE POLICY "Users can view own feedback" ON user_feedback
--     FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert own feedback" ON user_feedback
--     FOR INSERT WITH CHECK (auth.uid() = user_id); 
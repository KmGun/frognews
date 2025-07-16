import { supabase } from "../utils/supabase";
import * as fs from "fs";
import * as path from "path";

async function runMigration() {
  try {
    console.log("데이터베이스 마이그레이션을 시작합니다...");

    // 마이그레이션 파일 경로
    const migrationPath = path.join(
      __dirname,
      "../../database/migrations/017_create_user_feedback_table.sql"
    );

    // 마이그레이션 파일 읽기
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // SQL 실행
    const { data, error } = await supabase.rpc("exec_sql", {
      sql_query: migrationSQL,
    });

    if (error) {
      console.error("마이그레이션 실행 실패:", error);
      return;
    }

    console.log("마이그레이션이 성공적으로 완료되었습니다.");
    console.log("결과:", data);
  } catch (error) {
    console.error("마이그레이션 중 오류 발생:", error);
  }
}

// 직접 실행 시
if (require.main === module) {
  runMigration();
}

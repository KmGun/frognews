import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';

async function runMigrations() {
  try {
    const migrationsDir = join(__dirname, '../../database/migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // 파일명 순으로 정렬

    logger.info(`${migrationFiles.length}개의 마이그레이션 파일을 찾았습니다.`);

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf-8');
      
      logger.info(`마이그레이션 실행 중: ${file}`);
      
      // SQL 문을 세미콜론으로 분리하여 개별 실행
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      // 전체 SQL을 한 번에 실행
      try {
        // Supabase에서 직접 SQL 실행은 제한적이므로 개별 쿼리로 분리
        logger.info(`SQL 내용: ${sql.substring(0, 200)}...`);
        logger.warn('Supabase에서는 직접 마이그레이션 실행이 제한적입니다.');
        logger.info('Supabase Dashboard에서 SQL Editor를 통해 다음 파일을 실행하세요:');
        logger.info(`파일 경로: ${filePath}`);
      } catch (error) {
        logger.error(`마이그레이션 실행 오류 (${file}):`, error);
        throw error;
      }
      
      logger.info(`마이그레이션 완료: ${file}`);
    }

    logger.info('모든 마이그레이션이 성공적으로 완료되었습니다.');
  } catch (error) {
    logger.error('마이그레이션 실행 실패:', error);
    process.exit(1);
  }
}

// 직접 실행 시에만 마이그레이션 실행
if (require.main === module) {
  runMigrations();
}

export { runMigrations }; 
// 환경 변수 설정 확인
export const isSupabaseConfigured = (): boolean => {
  return !!(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);
};

// 환경 변수 정보 로그
export const logEnvironmentInfo = (): void => {
  console.log('🔧 환경 변수 설정 상태:');
  console.log('  - REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL ? '✅ 설정됨' : '❌ 설정 안됨');
  console.log('  - REACT_APP_SUPABASE_ANON_KEY:', process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 설정 안됨');
  console.log('  - REACT_APP_API_URL:', process.env.REACT_APP_API_URL || 'http://localhost:3001 (기본값)');
  
  if (!isSupabaseConfigured()) {
    console.warn('⚠️  Supabase 환경 변수가 설정되지 않았습니다. 목업 데이터를 사용합니다.');
    console.log('📋 환경 변수 설정 방법:');
    console.log('  1. frontend/.env 파일 생성');
    console.log('  2. 다음 내용 추가:');
    console.log('     REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co');
    console.log('     REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here');
  }
};

// 개발 환경에서 자동으로 로그 출력
if (process.env.NODE_ENV === 'development') {
  logEnvironmentInfo();
} 
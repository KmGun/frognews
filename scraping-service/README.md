# 뉴스 스크래핑 마이크로서비스

AI 및 기술 관련 뉴스를 자동으로 스크래핑하고 처리하는 Node.js 기반 마이크로서비스입니다.

## 주요 기능

### 🚀 통합 스크래핑 (NEW!)
- **한 번의 명령으로 모든 소스 스크래핑**: `yarn scrape:all`
- **병렬 처리**: 모든 뉴스 사이트를 동시에 스크래핑하여 속도 최적화
- **자동 중복 제거**: Supabase DB에서 기존 데이터를 확인하여 새로운 콘텐츠만 수집
- **포괄적 커버리지**: 뉴스 사이트 8곳 + 트위터 계정 23개를 한번에 처리
- **에러 복원력**: 개별 소스 실패 시에도 다른 소스들은 계속 실행

### 📰 뉴스 사이트 스크래핑
- **AI타임즈**: AI 전문 뉴스 사이트
- **NewsTheAI**: AI 관련 최신 뉴스 및 인사이트
- **Forbes**: 기술 및 AI 관련 포브스 기사
- **TechCrunch**: 스타트업 및 기술 뉴스
- **VentureBeat**: AI 및 기술 트렌드
- **Ars Technica**: 깊이 있는 기술 분석
- **The Verge**: 기술 문화 및 리뷰
- **BBC**: 글로벌 기술 뉴스

### 🐦 소셜 미디어 스크래핑
- **트위터 계정 모니터링**: AI 업계 주요 인물들의 트윗 수집
  - 일론 머스크, 앤드류 응, 얀 르쿤, 제프 딘 등 AI 리더들
  - OpenAI, Anthropic, Google AI, DeepMind 등 주요 AI 기업 계정
- **AI 관련 콘텐츠 필터링**: AI 판별 모델을 통해 관련성 높은 트윗만 수집
- **자동 번역**: 영어 트윗의 한국어 번역 제공

### 🎥 유튜브 스크래핑 (개별 영상)
- **개별 영상 정보 수집**: 제목, 채널명, 조회수, 업로드 날짜 등
- **썸네일 추출**: 고화질 썸네일 URL 생성

## 빠른 시작

### 🚀 통합 스크래핑 실행
```bash
# 모든 소스를 한번에 스크래핑 (권장)
yarn scrape:all
```

이 명령어 하나로 다음이 모두 실행됩니다:
- 8개 뉴스 사이트 병렬 스크래핑
- 23개 트위터 계정에서 AI 관련 트윗 수집 (각 계정당 최대 10개)
- 모든 데이터를 Supabase DB에 자동 저장
- 실행 결과 및 통계 리포트 출력

### 개별 스크래핑 실행

#### 뉴스 사이트별 스크래핑
```bash
# AI타임즈
yarn scrape:aitimes

# NewsTheAI  
yarn scrape:newstheai

# Forbes
yarn scrape:forbes

# TechCrunch
yarn scrape:techcrunch

# VentureBeat
yarn scrape:venturebeat

# Ars Technica
yarn scrape:arstechnica

# The Verge
yarn scrape:theverge

# BBC
yarn scrape:bbc
```

#### 소셜 미디어 스크래핑
```bash
# 설정된 모든 트위터 계정 스크래핑 (각 계정당 5개 트윗)
yarn scrape:twitter:accounts

# 계정당 트윗 수 조정 (각 계정당 10개 트윗)
yarn scrape:twitter:accounts 10

# 특정 계정들만 스크래핑
yarn scrape:twitter:accounts 5 elonmusk,OpenAI,AnthropicAI

# 개별 트윗 스크래핑
yarn scrape:twitter https://x.com/elonmusk/status/1234567890

# 개별 유튜브 영상 스크래핑
yarn scrape:youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## 설정

### 환경 변수
```bash
# .env 파일 생성
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# 선택적 설정
MAX_CONCURRENT_JOBS=3
SCRAPING_TIMEOUT=30000
RETRY_ATTEMPTS=3
DELAY_BETWEEN_REQUESTS=1000
BROWSER_HEADLESS=true
```

### 모니터링 대상 트위터 계정
현재 다음 23개 계정을 모니터링합니다:
- **AI 리더들**: elonmusk, karpathy, ylecun, AndrewYNg, goodfellow_ian, fchollet, hardmaru
- **기업 임원들**: sundarpichai, satyanadella, jeffdean
- **AI 회사들**: OpenAI, AnthropicAI, GoogleAI, DeepMind, huggingface, nvidia, StabilityAI, midjourney
- **AI 커뮤니티**: dreamingtulpa, testingcatalog, TheHumanoidHub, alexalbert__, NotebookLM

계정 목록은 `src/config/index.ts`의 `TWITTER_TARGET_ACCOUNTS`에서 수정할 수 있습니다.

## 데이터베이스 구조

### Articles 테이블
- 뉴스 기사 정보 저장
- 제목, 내용, 요약, 카테고리, 이미지 등
- 자동 중복 제거 (URL 기반)

### Tweets 테이블  
- 트위터 포스트 정보 저장
- AI 관련성 점수, 번역 여부, 작성자 정보 등
- 자동 중복 제거 (트윗 ID 기반)

### YouTube Videos 테이블
- 유튜브 영상 정보 저장
- 채널명, 조회수, 길이, 썸네일 등
- 자동 중복 제거 (영상 ID 기반)

## 스크래핑 최적화 특징

### 🔄 자동 최신화
- **중복 방지**: 이미 수집된 콘텐츠는 다시 수집하지 않음
- **증분 업데이트**: 새로운 콘텐츠만 효율적으로 수집
- **타임스탬프 기반 필터링**: 최근 게시된 콘텐츠 우선 수집

### ⚡ 성능 최적화
- **병렬 처리**: 여러 소스를 동시에 스크래핑
- **지능적 지연**: 사이트별 적절한 요청 간격 설정
- **에러 복원력**: 일부 실패가 전체 프로세스를 중단하지 않음
- **타임아웃 관리**: 응답 없는 요청의 적절한 종료

### 🧠 AI 기반 처리
- **콘텐츠 요약**: OpenAI GPT-4.1을 통한 지능적 요약
- **카테고리 분류**: 자동 주제 분류 및 태깅
- **관련성 필터링**: AI를 통한 관련성 높은 콘텐츠만 선별
- **자동 번역**: 영어 콘텐츠의 한국어 번역

## 로깅 및 모니터링

### 실행 로그
- 각 스크래핑 작업의 성공/실패 상태
- 처리된 콘텐츠 수량 및 소요 시간
- 에러 발생 시 상세 정보 제공

### 성능 메트릭스
- 전체 실행 시간
- 소스별 처리 시간
- 성공률 및 실패율
- 수집된 콘텐츠 통계

## 개발자 가이드

### 새로운 뉴스 소스 추가
1. `src/scrapers/` 폴더에 새 스크래퍼 파일 생성
2. `src/scripts/` 폴더에 개별 실행 스크립트 생성  
3. `src/scripts/scrape-all.ts`에 새 소스 추가
4. `package.json`의 scripts에 명령어 추가

### 스크래퍼 인터페이스
모든 스크래퍼는 다음 형태의 결과를 반환해야 합니다:
```typescript
interface ScrapingResult {
  success: boolean;
  articles: Article[];
  errors: string[];
  totalCount?: number;
}
```

## 라이선스
MIT

## 지원
문의사항이나 버그 리포트는 이슈 트래커를 통해 제출해 주세요. 
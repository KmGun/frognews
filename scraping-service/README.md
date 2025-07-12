# 뉴스 스크래핑 서비스

AI 뉴스 서비스를 위한 마이크로서비스 중 하나로, 다양한 뉴스 사이트에서 기사를 자동으로 스크래핑하는 TypeScript 기반 서비스입니다.

## 🚀 기능

- **다중 뉴스 소스 지원**: 조선일보, 한국경제, 연합뉴스 등
- **트위터 게시물 스크래핑**: 개별 트위터 게시물 데이터 수집
- **유튜브 영상 스크래핑**: 유튜브 영상 메타데이터 수집
- **자동 스케줄링**: 크론 작업을 통한 정기적 스크래핑
- **품질 필터링**: 기사 품질 검증 및 중복 제거
- **RESTful API**: 다른 마이크로서비스와의 연동
- **실시간 로깅**: Winston을 통한 구조화된 로깅
- **우아한 종료**: 안전한 서버 종료 처리

## 📦 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 수정하여 필요한 값들을 설정하세요

# TypeScript 컴파일
npm run build

# 개발 서버 실행
npm run dev

# 프로덕션 실행
npm start
```

## 🔧 환경 변수

```env
# 서버 설정
NODE_ENV=development
PORT=3001

# Supabase 설정
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# 스크래핑 설정
MAX_CONCURRENT_JOBS=3
SCRAPING_TIMEOUT=30000
RETRY_ATTEMPTS=3
DELAY_BETWEEN_REQUESTS=1000

# 브라우저 설정
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000
```

## 📚 API 엔드포인트

### 헬스 체크
```http
GET /api/health
```

### 서비스 상태 조회
```http
GET /api/status
```

### 단일 소스 스크래핑
```http
POST /api/scrape/:sourceId
```

지원되는 sourceId:
- `chosun`: 조선일보
- `hankyung`: 한국경제 (구현 예정)
- `yonhap`: 연합뉴스 (구현 예정)

### 전체 소스 스크래핑
```http
POST /api/scrape-all
```

### 기사 검증
```http
POST /api/validate-article
Content-Type: application/json

{
  "title": "기사 제목",
  "content": "기사 본문",
  "url": "기사 URL"
}
```

## 🗄️ 데이터베이스 마이그레이션

### Supabase 테이블 스키마 업데이트

카테고리 분류 기능을 사용하려면 `articles` 테이블에 `category` 컬럼을 추가해야 합니다.

Supabase 대시보드의 SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- Add category column to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS category INTEGER;

-- Add comment to explain the category values
COMMENT ON COLUMN articles.category IS '기사 카테고리: 1=오픈소스, 2=서비스, 3=연구, 4=비즈니스/산업, 5=기타';

-- Add check constraint only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_category_range' 
        AND table_name = 'articles'
    ) THEN
        ALTER TABLE articles 
        ADD CONSTRAINT check_category_range 
        CHECK (category IS NULL OR (category >= 1 AND category <= 5));
    END IF;
END $$;

-- Create index only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_articles_category'
    ) THEN
        CREATE INDEX idx_articles_category ON articles(category);
    END IF;
END $$;
```

### 카테고리 분류 기준

- **1: 오픈소스** - 개발자들이 실제로 사용할 수 있는 경량 모델 공개, 오픈소스 모델 공개 등
- **2: 서비스** - 일반인이 사용할 수 있는 상용 AI 서비스 (예: Claude 신규 기능, X의 Grok4 공개 등)
- **3: 연구** - 대학원이나 기업에서 연구 수준에 그친 내용
- **4: 비즈니스/산업** - 정부 투자, AI 법/정책, 대기업/산업/계약/투자/시장/정책 등
- **5: 기타** - 위 1~4에 해당하지 않는 경우

### 데이터 마이그레이션 전략

#### 방법 1: 점진적 업데이트 (추천)
```sql
-- 1. category 컬럼 추가 (위 스크립트 실행)
-- 2. 기존 데이터는 category = NULL로 유지
-- 3. 새로운 스크래핑부터 category 값 설정
-- 4. 기존 데이터는 필요시 수동으로 분류 또는 재스크래핑
```

#### 방법 2: 기존 데이터 완전 삭제
```sql
-- 기존 데이터 모두 삭제하고 새로 시작
DELETE FROM articles;
```

#### 현재 데이터 상태 확인
```sql
SELECT 
  COUNT(*) as total_articles,
  COUNT(category) as articles_with_category,
  COUNT(*) - COUNT(category) as articles_without_category
FROM articles;
```

### 권장 사항

1. **개발/테스트 환경**: 기존 데이터 삭제 후 새로 시작
2. **프로덕션 환경**: 점진적 업데이트로 기존 데이터 보존
3. **새로운 스크래핑**: 자동으로 category 값이 설정됨
4. **기존 데이터**: 필요시 수동 분류 또는 재스크래핑 고려

## 🏗️ 프로젝트 구조

```
scraping-service/
├── src/
│   ├── api/
│   │   └── routes.ts          # API 라우트 정의
│   ├── config/
│   │   └── index.ts           # 설정 파일
│   ├── scrapers/
│   │   ├── base.scraper.ts    # 기본 스크래퍼 클래스
│   │   └── chosun.scraper.ts  # 조선일보 스크래퍼
│   ├── types/
│   │   └── index.ts           # TypeScript 타입 정의
│   ├── utils/
│   │   └── logger.ts          # 로깅 유틸리티
│   └── index.ts               # 메인 서버 파일
├── logs/                      # 로그 파일 저장소
├── package.json
├── tsconfig.json
└── README.md
```

## 🔄 크론 작업

### 정기 스크래핑
- **스케줄**: 매 30분마다
- **작업**: 모든 활성화된 뉴스 소스에서 기사 스크래핑

### 일일 정리
- **스케줄**: 매일 새벽 2시
- **작업**: 오래된 로그 정리, 중복 기사 제거

### 헬스 체크
- **스케줄**: 매시간
- **작업**: 서비스 상태 로깅

## 🧪 테스트

```bash
# 단위 테스트 실행
npm test

# 개별 스크래퍼 테스트
npm run scrape:once

# AI타임즈 스크래핑 테스트
npm run scrape:aitimes

# 트위터 게시물 스크래핑 테스트
npm run scrape:twitter https://x.com/elonmusk/status/1943178423947661609

# 유튜브 영상 스크래핑 테스트
npm run scrape:youtube https://www.youtube.com/watch?v=DQacCB9tDaw
```

## 🐦 트위터 게시물 스크래핑

### 사용법
```bash
# 개별 트위터 게시물 스크래핑
npm run scrape:twitter <트위터_URL>

# 예시
npm run scrape:twitter https://x.com/elonmusk/status/1943178423947661609
npm run scrape:twitter https://twitter.com/OpenAI/status/1234567890
```

### 수집되는 데이터
- **게시물 ID**: 트위터 고유 식별자
- **작성자 정보**: 이름, 사용자명, 프로필 이미지
- **게시물 본문**: 전체 텍스트 내용
- **작성일**: 게시물 작성 시간
- **원문 링크**: 트위터 게시물 URL

### 데이터베이스 스키마
트위터 게시물은 `tweets` 테이블에 저장됩니다:

```sql
-- tweets 테이블 생성 (이미 마이그레이션 파일에 포함됨)
CREATE TABLE tweets (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  url TEXT NOT NULL UNIQUE,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

## 트위터 스크래핑 기능

### 개요
개별 트위터 게시물을 스크래핑하여 데이터베이스에 저장하는 기능입니다.

### 주요 기능
- 트위터 게시물 텍스트 추출
- 작성자 정보 (이름, 사용자명, 프로필 이미지) 수집
- 게시물 작성 시간 파싱
- **영어 게시물 자동 번역** (GPT-4o-mini 사용)
- Supabase 데이터베이스 저장

### 번역 기능
- 영어 게시물 자동 감지
- OpenAI GPT-4o-mini를 사용한 한국어 번역
- 번역 모델 및 시간 정보 저장
- 한국어 게시물은 번역하지 않음

### 환경 변수 설정
```bash
# .env 파일에 추가
OPENAI_API_KEY=your_openai_api_key_here
```

### 사용법
```bash
# 개별 트위터 게시물 스크래핑 (번역 포함)
npm run scrape:twitter https://x.com/elonmusk/status/1943178423947661609
```

### 출력 예시
```
🚀 트위터 스크래핑 시작...
📋 URL: https://x.com/elonmusk/status/1943178423947661609

📊 스크래핑 결과:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 ID: 1943178423947661609
👤 작성자: Elon Musk (@elonmusk)
📝 원문: The future is going to be wild
🇰🇷 번역: 미래는 정말 대단할 것 같다
🤖 번역 모델: gpt-4o-mini
📅 작성일: 2024. 1. 15. 오후 10:30:00
🔗 URL: https://x.com/elonmusk/status/1943178423947661609
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 데이터베이스 저장 중...
✅ 트위터 게시물 저장 완료: Elon Musk - The future is going to be wild (번역됨)

✅ 트위터 스크래핑 완료!
```

### 데이터베이스 스키마

#### tweets 테이블
```sql
CREATE TABLE tweets (
    id VARCHAR(50) PRIMARY KEY,
    text TEXT NOT NULL,
    text_ko TEXT,                    -- 한국어 번역
    is_translated BOOLEAN DEFAULT false,  -- 번역 여부
    translation_model VARCHAR(50),   -- 번역 모델명
    translated_at TIMESTAMP WITH TIME ZONE,  -- 번역 시각
    author_name VARCHAR(100) NOT NULL,
    author_username VARCHAR(50) NOT NULL,
    author_profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    url TEXT NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);
```

### 프론트엔드 표시
- 번역된 게시물: 한국어 번역을 메인으로 표시, 원문은 작은 박스로 표시
- 번역되지 않은 게시물: 원문 그대로 표시
- 번역 모델 정보 표시

### 비용 최적화
- GPT-4o-mini 사용으로 비용 절약
- 영어 게시물만 번역하여 불필요한 API 호출 방지
- 언어 감지 로직으로 번역 대상 사전 필터링

## 📺 유튜브 영상 스크래핑

### 개요
유튜브 영상의 메타데이터를 수집하여 데이터베이스에 저장하는 기능입니다.

### 주요 기능
- 유튜브 영상 제목, 썸네일, 채널명 추출
- 영상 업로드 시간, 길이, 조회수 수집
- 실제 UI에서 사용되는 필드만 최적화하여 저장
- Supabase 데이터베이스 저장

### 수집되는 데이터
- **영상 ID**: 유튜브 고유 식별자 (예: DQacCB9tDaw)
- **제목**: 영상 제목
- **썸네일 URL**: 영상 썸네일 이미지
- **채널명**: 업로더 채널명
- **업로드 시간**: 영상 업로드 시간
- **영상 길이**: 재생 시간 (예: 15:42)
- **조회수**: 영상 조회수

### 데이터베이스 스키마
유튜브 영상은 `youtube_videos` 테이블에 저장됩니다:

```sql
-- youtube_videos 테이블 생성
CREATE TABLE youtube_videos (
    id VARCHAR(20) PRIMARY KEY,      -- YouTube 영상 ID
    title TEXT NOT NULL,             -- 영상 제목
    thumbnail_url TEXT NOT NULL,     -- 썸네일 URL
    channel_name TEXT NOT NULL,      -- 채널명
    published_at TIMESTAMP NOT NULL, -- 영상 업로드 시간
    duration VARCHAR(10),            -- 영상 길이 (예: 15:42)
    view_count INTEGER,              -- 조회수
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 사용법
```bash
# 개별 유튜브 영상 스크래핑
npm run scrape:youtube <유튜브_URL>

# 예시
npm run scrape:youtube https://www.youtube.com/watch?v=DQacCB9tDaw
npm run scrape:youtube https://youtu.be/DQacCB9tDaw
```

### 프론트엔드 통합
- 메인 페이지에서 뉴스, 트위터와 함께 시간순 정렬 표시
- 카드 클릭 시 해당 위치에서 YouTube 임베드 플레이어로 재생
- 썸네일, 제목, 채널명, 조회수, 업로드 시간 표시

### 최적화된 DB 설계
- 실제 UI에서 사용되는 필드만 저장
- 불필요한 메타데이터 제외로 저장 공간 절약
- 빠른 조회를 위한 인덱스 최적화

## 🐳 Docker 실행

```bash
# Docker 이미지 빌드
docker build -t news-scraping-service .

# 컨테이너 실행
docker run -p 3001:3001 --env-file .env news-scraping-service
```

## 📊 모니터링

### 로그 파일
- `logs/combined.log`: 전체 로그
- `logs/error.log`: 에러 로그만

### 주요 지표
- 스크래핑 성공률
- 기사 추출 개수
- 에러 발생 빈도
- 응답 시간

## 🔧 개발 가이드

### 새 뉴스 소스 추가하기

1. `config/index.ts`에 새 소스 설정 추가
2. `scrapers/` 폴더에 새 스크래퍼 클래스 생성
3. `BaseScraper`를 상속받아 `scrapeArticles()` 메서드 구현
4. `api/routes.ts`에 새 소스 case 추가

### 예시: 새 스크래퍼 생성
```typescript
export class NewsScraper extends BaseScraper {
  constructor() {
    const source = NEWS_SOURCES.find(s => s.id === 'news-site');
    super(source);
  }

  async scrapeArticles(): Promise<ScrapingResult> {
    // 구현 로직
  }
}
```

## 🚨 주의사항

- 각 뉴스 사이트의 robots.txt를 확인하세요
- 과도한 요청으로 인한 IP 차단에 주의하세요
- 스크래핑 간격을 적절히 조정하세요
- 저작권 관련 법적 요구사항을 확인하세요

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 LICENSE 파일을 참조하세요. 
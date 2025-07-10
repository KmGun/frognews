# 뉴스 스크래핑 서비스

AI 뉴스 서비스를 위한 마이크로서비스 중 하나로, 다양한 뉴스 사이트에서 기사를 자동으로 스크래핑하는 TypeScript 기반 서비스입니다.

## 🚀 기능

- **다중 뉴스 소스 지원**: 조선일보, 한국경제, 연합뉴스 등
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
```

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
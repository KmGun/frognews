# FrogNews Admin

FrogNews 관리자 페이지입니다.

## 환경 변수 설정

배포 전에 다음 환경 변수들을 설정해야 합니다:

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_url_here
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# YouTube API Configuration (선택사항)
REACT_APP_YOUTUBE_API_KEY=your_youtube_api_key_here
```

## 로컬 개발

```bash
# 의존성 설치
yarn install

# 개발 서버 시작
yarn start
```

## 빌드

```bash
# 프로덕션 빌드
yarn build
```

## Vercel 배포

1. [Vercel](https://vercel.com)에 로그인
2. 새 프로젝트 생성
3. GitHub 저장소 연결
4. Root Directory를 `admin`으로 설정
5. 환경 변수 설정:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_YOUTUBE_API_KEY` (선택사항)
6. 배포

### Vercel 환경 변수 설정 방법

1. Vercel 대시보드에서 프로젝트 선택
2. Settings > Environment Variables
3. 각 환경 변수를 Production, Preview, Development 환경에 추가

## 기능

- 기사 관리 (승인/거부)
- 트윗 관리 (승인/거부)
- YouTube 비디오 관리 (승인/거부)
- 대시보드 
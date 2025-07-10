# 멀티 스테이지 빌드를 위한 베이스 이미지
FROM node:18-alpine AS base

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
COPY tsconfig.json ./

# 빌드 스테이지
FROM base AS builder

# 의존성 설치 (dev dependencies 포함)
RUN npm ci

# 소스 코드 복사
COPY src ./src

# TypeScript 컴파일
RUN npm run build

# 프로덕션 스테이지
FROM node:18-alpine AS production

# 시스템 의존성 설치 (Puppeteer를 위한 Chrome 관련 패키지들)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Puppeteer가 시스템의 Chrome을 사용하도록 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 비root 유저 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# 소유권 변경
COPY --chown=nextjs:nodejs package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production && npm cache clean --force

# 컴파일된 코드 복사
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# 로그 디렉토리 생성
RUN mkdir -p logs && chown -R nextjs:nodejs logs

# 비root 유저로 전환
USER nextjs

# 포트 노출
EXPOSE 3001

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 시작 명령
CMD ["npm", "start"] 
import { BaseScraper } from './base.scraper';
import { Article, ScrapingResult, ScrapingStatus } from '@/types';
import { NEWS_SOURCES } from '@/config';
import { scrapingLogger, logScrapingStart, logScrapingComplete, logScrapingError } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ChosunScraper extends BaseScraper {
  constructor() {
    const chosunSource = NEWS_SOURCES.find(source => source.id === 'chosun');
    if (!chosunSource) {
      throw new Error('조선일보 소스 설정을 찾을 수 없습니다');
    }
    super(chosunSource);
  }

  async scrapeArticles(): Promise<ScrapingResult> {
    const jobId = uuidv4();
    const startTime = new Date();
    
    logScrapingStart(this.source.name, jobId);

    const result: ScrapingResult = {
      success: false,
      articles: [],
      errors: [],
      source: this.source.name,
      scrapedAt: startTime,
      totalCount: 0
    };

    try {
      // 브라우저 초기화
      await this.initBrowser();

      // 1. 기사 목록 페이지 로드
      const listPageHtml = await this.loadPage(this.source.listPageUrl);
      
      // 2. 기사 링크 추출
      const articleLinks = this.extractArticleLinks(listPageHtml);
      scrapingLogger.info(`추출된 기사 링크 수: ${articleLinks.length}`, { 
        source: this.source.name, 
        jobId 
      });

      // 3. 각 기사 상세 정보 스크래핑
      const articles: Partial<Article>[] = [];
      
      for (let i = 0; i < Math.min(articleLinks.length, 20); i++) { // 최대 20개 제한
        const link = articleLinks[i];
        
        try {
          // 요청 간 지연
          await this.delay(1000);
          
          // 기사 페이지 로드
          const articleHtml = await this.loadPage(link);
          
          // 기사 정보 추출
          const articleData = this.extractArticleDetails(articleHtml, link);
          
          // 조선일보 특화 후처리
          const processedArticle = this.postProcessArticle(articleData);
          
          if (processedArticle.title && processedArticle.content) {
            articles.push(processedArticle);
            scrapingLogger.debug(`기사 스크래핑 완료: ${processedArticle.title}`, { 
              source: this.source.name, 
              jobId,
              url: link 
            });
          }
          
        } catch (error) {
          const errorMessage = `기사 스크래핑 실패: ${link} - ${(error as Error).message}`;
          result.errors.push(errorMessage);
          scrapingLogger.warn(errorMessage, { source: this.source.name, jobId });
        }
      }

      // 4. 기사 필터링 및 정리
      const filteredArticles = this.filterArticles(articles);
      
      result.success = true;
      result.articles = filteredArticles;
      result.totalCount = filteredArticles.length;

      logScrapingComplete(this.source.name, jobId, filteredArticles.length);

    } catch (error) {
      const errorMessage = `스크래핑 실패: ${(error as Error).message}`;
      result.errors.push(errorMessage);
      result.success = false;
      
      logScrapingError(this.source.name, jobId, error as Error);
    } finally {
      // 브라우저 정리
      await this.closeBrowser();
    }

    return result;
  }

  // 조선일보 특화 후처리
  private postProcessArticle(article: Partial<Article>): Partial<Article> {
    if (!article.title || !article.content) {
      return article;
    }

    // 제목 정리 (불필요한 문구 제거)
    let cleanTitle = article.title
      .replace(/\[.*?\]/g, '') // 대괄호 제거
      .replace(/\(.*?\)/g, '') // 소괄호 제거
      .replace(/\s+/g, ' ') // 연속 공백 정리
      .trim();

    // 본문 정리
    let cleanContent = article.content
      .replace(/\n\s*\n/g, '\n') // 연속 줄바꿈 정리
      .replace(/\s+/g, ' ') // 연속 공백 정리
      .replace(/기자\s*=\s*/g, '') // "기자=" 제거
      .replace(/\[.*?기자\]/g, '') // "[○○기자]" 형태 제거
      .trim();

    // 본문이 너무 짧으면 스킵
    if (cleanContent.length < 100) {
      return { ...article, title: '', content: '' };
    }

    // 카테고리 매핑
    let category = article.category;
    if (category) {
      const categoryMap: { [key: string]: string } = {
        '정치': '정치',
        '경제': '경제',
        '사회': '사회',
        '국제': '국제',
        '문화': '문화',
        '스포츠': '스포츠',
        '연예': '연예'
      };
      
      for (const [key, value] of Object.entries(categoryMap)) {
        if (category.includes(key)) {
          category = value;
          break;
        }
      }
    }

    // 태그 생성 (제목에서 키워드 추출)
    const tags = this.extractTags(cleanTitle, cleanContent);

    return {
      ...article,
      title: cleanTitle,
      content: cleanContent,
      category,
      tags,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // 태그 추출 (간단한 키워드 기반)
  private extractTags(title: string, content: string): string[] {
    const keywords = [
      '정부', '대통령', '국정감사', '선거', '정치',
      '경제', '주식', '부동산', '금리', '인플레이션',
      '코로나', '백신', '의료', '병원',
      '교육', '학교', '대학', '입시',
      '기업', '삼성', 'LG', '현대', 'SK',
      '북한', '중국', '미국', '일본', '러시아'
    ];

    const foundTags: string[] = [];
    const text = `${title} ${content}`.toLowerCase();

    keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase()) && !foundTags.includes(keyword)) {
        foundTags.push(keyword);
      }
    });

    return foundTags.slice(0, 5); // 최대 5개
  }

  // 중복 기사 체크 (제목 유사도 기반)
  private isDuplicateArticle(article1: Article, article2: Article): boolean {
    const title1 = article1.title.toLowerCase().replace(/\s/g, '');
    const title2 = article2.title.toLowerCase().replace(/\s/g, '');
    
    // 단순 포함 관계 체크
    return title1.includes(title2) || title2.includes(title1);
  }

  // 기사 품질 점수 계산
  private calculateQualityScore(article: Partial<Article>): number {
    let score = 0;
    
    if (article.title && article.title.length > 10) score += 20;
    if (article.content && article.content.length > 200) score += 30;
    if (article.author) score += 10;
    if (article.publishedAt) score += 10;
    if (article.category) score += 10;
    if (article.imageUrl) score += 10;
    if (article.tags && article.tags.length > 0) score += 10;
    
    return score;
  }
} 
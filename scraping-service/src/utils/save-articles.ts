import { supabase } from './supabase';
import { Article } from '../types';

export async function saveArticlesToSupabase(articles: Article[]) {
  const rows = articles.map(article => ({
    title_summary: article.titleSummary,
    published_at: article.publishedAt && !isNaN(article.publishedAt.getTime()) 
      ? article.publishedAt.toISOString() 
      : null,
    url: article.url,
    image_urls: JSON.stringify(article.imageUrls),
    summary_lines: JSON.stringify(article.summaryLines),
    details: JSON.stringify(article.details),
    category: article.category,
    created_at: article.createdAt && !isNaN(article.createdAt.getTime()) 
      ? article.createdAt.toISOString() 
      : new Date().toISOString(),
  }));

  // url 기준 upsert (중복시 덮어쓰기)
  const { data, error } = await supabase
    .from('articles')
    .upsert(rows, { onConflict: 'url' });

  if (error) {
    console.error('❌ Supabase 저장 실패:', error);
    throw error;
  }
  return data;
}

// 개별 기사를 즉시 저장하는 함수 추가
export async function saveArticleToSupabase(article: Article) {
  const row = {
    title_summary: article.titleSummary,
    published_at: article.publishedAt && !isNaN(article.publishedAt.getTime()) 
      ? article.publishedAt.toISOString() 
      : null,
    url: article.url,
    image_urls: JSON.stringify(article.imageUrls),
    summary_lines: JSON.stringify(article.summaryLines),
    details: JSON.stringify(article.details),
    category: article.category,
    created_at: article.createdAt && !isNaN(article.createdAt.getTime()) 
      ? article.createdAt.toISOString() 
      : new Date().toISOString(),
  };

  // url 기준 upsert (중복시 덮어쓰기)
  const { data, error } = await supabase
    .from('articles')
    .upsert([row], { onConflict: 'url' });

  if (error) {
    console.error('❌ 개별 기사 Supabase 저장 실패:', error);
    throw error;
  }
  console.log(`✅ DB 저장 완료: ${article.titleSummary.substring(0, 30)}...`);
  return data;
} 
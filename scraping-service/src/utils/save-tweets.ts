import { supabase } from './supabase';
import { TwitterPostData } from '../scrapers/twitter.scraper';

export async function saveTweetToSupabase(tweet: TwitterPostData) {
  const row = {
    id: tweet.id,
    text: tweet.text,
    text_ko: tweet.textKo || null,
    is_translated: tweet.isTranslated || false,
    translation_model: tweet.translationModel || null,
    translated_at: tweet.translatedAt ? tweet.translatedAt.toISOString() : null,
    author_name: tweet.author.name,
    author_username: tweet.author.username,
    author_profile_image_url: tweet.author.profileImageUrl || null,
    created_at: tweet.createdAt.toISOString(),
    url: tweet.url,
    scraped_at: new Date().toISOString(),
    is_active: true,
    category: tweet.category || 5
  };

  // id 기준 upsert (중복시 덮어쓰기)
  const { data, error } = await supabase
    .from('tweets')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('❌ 트위터 게시물 Supabase 저장 실패:', error);
    throw error;
  }
  
  const translationInfo = tweet.isTranslated ? ' (번역됨)' : '';
  console.log('✅ 트위터 게시물 저장 완료:', tweet.author.name, '-', tweet.text.substring(0, 50) + '...' + translationInfo);
  return data;
}

export async function saveTweetsToSupabase(tweets: TwitterPostData[]) {
  const rows = tweets.map(tweet => ({
    id: tweet.id,
    text: tweet.text,
    text_ko: tweet.textKo || null,
    is_translated: tweet.isTranslated || false,
    translation_model: tweet.translationModel || null,
    translated_at: tweet.translatedAt ? tweet.translatedAt.toISOString() : null,
    author_name: tweet.author.name,
    author_username: tweet.author.username,
    author_profile_image_url: tweet.author.profileImageUrl || null,
    created_at: tweet.createdAt.toISOString(),
    url: tweet.url,
    scraped_at: new Date().toISOString(),
    is_active: true,
    category: tweet.category || 5
  }));

  // id 기준 upsert (중복시 덮어쓰기)
  const { data, error } = await supabase
    .from('tweets')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('❌ 트위터 게시물 일괄 Supabase 저장 실패:', error);
    throw error;
  }
  
  const translatedCount = tweets.filter(t => t.isTranslated).length;
  console.log(`✅ 트위터 게시물 ${tweets.length}개 일괄 저장 완료 (번역: ${translatedCount}개)`);
  return data;
} 
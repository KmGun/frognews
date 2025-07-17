import { supabase } from "./supabase";
import { TwitterPostData } from "../scrapers/twitter.scraper";

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
    category: tweet.category || 5,
    // 미디어 정보 추가 - 이제 단순한 문자열 배열
    media:
      tweet.media && tweet.media.length > 0
        ? JSON.stringify(tweet.media)
        : null,
    // 비디오 임베드 정보 추가
    has_video: tweet.hasVideo || false,
    video_embed_info: tweet.videoEmbedInfo
      ? JSON.stringify(tweet.videoEmbedInfo)
      : null,
    external_links:
      tweet.externalLinks && tweet.externalLinks.length > 0
        ? JSON.stringify(tweet.externalLinks)
        : null,
  };

  // id 기준 upsert (중복시 덮어쓰기)
  const { data, error } = await supabase
    .from("tweets")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.error("❌ 트위터 게시물 Supabase 저장 실패:", error);
    throw error;
  }

  const translationInfo = tweet.isTranslated ? " (번역됨)" : "";
  const mediaInfo =
    tweet.media && tweet.media.length > 0
      ? ` (미디어 ${tweet.media.length}개)`
      : "";
  const videoInfo = tweet.hasVideo ? " (비디오 있음)" : "";
  const linkInfo =
    tweet.externalLinks && tweet.externalLinks.length > 0
      ? ` (링크 ${tweet.externalLinks.length}개)`
      : "";
  console.log(
    "✅ 트위터 게시물 저장 완료:",
    tweet.author.name,
    "-",
    tweet.text.substring(0, 50) +
      "..." +
      translationInfo +
      mediaInfo +
      videoInfo +
      linkInfo
  );
  return data;
}

export async function saveTweetsToSupabase(tweets: TwitterPostData[]) {
  const rows = tweets.map((tweet) => ({
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
    category: tweet.category || 5,
    // 미디어 정보 추가 - 이제 단순한 문자열 배열
    media:
      tweet.media && tweet.media.length > 0
        ? JSON.stringify(tweet.media)
        : null,
    // 비디오 임베드 정보 추가
    has_video: tweet.hasVideo || false,
    video_embed_info: tweet.videoEmbedInfo
      ? JSON.stringify(tweet.videoEmbedInfo)
      : null,
    external_links:
      tweet.externalLinks && tweet.externalLinks.length > 0
        ? JSON.stringify(tweet.externalLinks)
        : null,
  }));

  // id 기준 upsert (중복시 덮어쓰기)
  const { data, error } = await supabase
    .from("tweets")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("❌ 트위터 게시물 일괄 Supabase 저장 실패:", error);
    throw error;
  }

  const translatedCount = tweets.filter((t) => t.isTranslated).length;
  const mediaCount = tweets.filter((t) => t.media && t.media.length > 0).length;
  const videoCount = tweets.filter((t) => t.hasVideo).length;
  const linkCount = tweets.filter(
    (t) => t.externalLinks && t.externalLinks.length > 0
  ).length;
  console.log(
    `✅ 트위터 게시물 ${tweets.length}개 일괄 저장 완료 (번역: ${translatedCount}개, 미디어: ${mediaCount}개, 비디오: ${videoCount}개, 링크: ${linkCount}개)`
  );
  return data;
}

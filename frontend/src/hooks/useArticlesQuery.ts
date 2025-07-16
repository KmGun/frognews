import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { articleApi, tweetApi, youtubeApi } from "../services/api";
import { Article, Tweet, YouTubeVideo } from "../types";

// 기사 데이터 가져오기
export const useArticlesQuery = () => {
  return useQuery({
    queryKey: ["articles"],
    queryFn: articleApi.getArticles,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
};

// 트위터 데이터 가져오기
export const useTweetsQuery = () => {
  return useQuery({
    queryKey: ["tweets"],
    queryFn: tweetApi.getTweets,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
};

// 유튜브 데이터 가져오기
export const useYouTubeQuery = () => {
  return useQuery({
    queryKey: ["youtube"],
    queryFn: youtubeApi.getVideos,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
};

// 모든 데이터를 한번에 가져오는 훅
export const useAllDataQuery = () => {
  const articlesQuery = useArticlesQuery();
  const tweetsQuery = useTweetsQuery();
  const youtubeQuery = useYouTubeQuery();

  // 데이터 배열들을 메모이제이션하여 불필요한 리렌더링 방지
  const articles = useMemo(
    () => articlesQuery.data || [],
    [articlesQuery.data]
  );
  const tweets = useMemo(() => tweetsQuery.data || [], [tweetsQuery.data]);
  const youtubeVideos = useMemo(
    () => youtubeQuery.data || [],
    [youtubeQuery.data]
  );

  return {
    articles,
    tweets,
    youtubeVideos,
    isLoading:
      articlesQuery.isLoading ||
      tweetsQuery.isLoading ||
      youtubeQuery.isLoading,
    error: articlesQuery.error || tweetsQuery.error || youtubeQuery.error,
    isError:
      articlesQuery.isError || tweetsQuery.isError || youtubeQuery.isError,
    refetch: () => {
      articlesQuery.refetch();
      tweetsQuery.refetch();
      youtubeQuery.refetch();
    },
  };
};

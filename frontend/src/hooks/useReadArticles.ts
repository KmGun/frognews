import { useState, useEffect, useCallback } from "react";
import { userService } from "../services/userService";

const CLICKED_ARTICLES_KEY = "frognews_clicked_articles";

export function useReadArticles() {
  const [readArticleIds, setReadArticleIds] = useState<string[]>([]);
  const [clickedArticleIds, setClickedArticleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // localStorage에서 클릭한 기사 목록 로드
  const loadClickedArticlesFromLocal = useCallback(() => {
    try {
      const saved = localStorage.getItem(CLICKED_ARTICLES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    } catch (error) {
      console.error("로컬 클릭한 기사 목록 로드 실패:", error);
    }
    return [];
  }, []);

  // localStorage에 클릭한 기사 목록 저장
  const saveClickedArticlesToLocal = useCallback((articleIds: string[]) => {
    try {
      localStorage.setItem(CLICKED_ARTICLES_KEY, JSON.stringify(articleIds));
    } catch (error) {
      console.error("클릭한 기사 목록 저장 실패:", error);
    }
  }, []);

  // DB와 localStorage의 클릭한 기사 목록 병합
  const mergeClickedArticles = useCallback(
    (dbIds: string[], localIds: string[]) => {
      const mergedIds = Array.from(new Set([...dbIds, ...localIds]));
      setClickedArticleIds(mergedIds);
      return mergedIds;
    },
    []
  );

  useEffect(() => {
    const loadReadArticles = async () => {
      try {
        // 읽은 기사와 클릭한 기사를 병렬로 로드
        const [readIds, clickedIdsFromDb] = await Promise.all([
          userService.getReadArticleIds(),
          userService.getClickedArticleIds(),
        ]);

        setReadArticleIds(readIds);

        // localStorage의 클릭한 기사와 DB의 클릭한 기사 병합
        const localClickedIds = loadClickedArticlesFromLocal();
        const mergedClickedIds = mergeClickedArticles(
          clickedIdsFromDb,
          localClickedIds
        );

        // 병합된 결과를 다시 localStorage에 저장
        saveClickedArticlesToLocal(mergedClickedIds);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
        // 에러 시 최소한 localStorage는 로드
        const localClickedIds = loadClickedArticlesFromLocal();
        setClickedArticleIds(localClickedIds);
      } finally {
        setIsLoading(false);
      }
    };

    loadReadArticles();
  }, [
    loadClickedArticlesFromLocal,
    saveClickedArticlesToLocal,
    mergeClickedArticles,
  ]);

  const refreshReadArticles = useCallback(async () => {
    try {
      // 읽은 기사와 클릭한 기사를 병렬로 새로고침
      const [readIds, clickedIdsFromDb] = await Promise.all([
        userService.getReadArticleIds(),
        userService.getClickedArticleIds(),
      ]);

      setReadArticleIds(readIds);

      // localStorage의 클릭한 기사와 DB의 클릭한 기사 병합
      const localClickedIds = loadClickedArticlesFromLocal();
      const mergedClickedIds = mergeClickedArticles(
        clickedIdsFromDb,
        localClickedIds
      );

      // 병합된 결과를 다시 localStorage에 저장
      saveClickedArticlesToLocal(mergedClickedIds);

      console.log("읽은 기사 목록이 새로고침되었습니다:", readIds.length, "개");
      console.log(
        "클릭한 기사 목록이 새로고침되었습니다:",
        mergedClickedIds.length,
        "개"
      );
    } catch (error) {
      console.error("데이터 새로고침 실패:", error);
    }
  }, [
    loadClickedArticlesFromLocal,
    saveClickedArticlesToLocal,
    mergeClickedArticles,
  ]);

  // 클릭했을 때 즉시 호출 (어둡게 표시용)
  const markAsClicked = useCallback(
    async (articleId: string) => {
      // 1. 로컬 상태 즉시 업데이트 (UI 반응성)
      setClickedArticleIds((prev) => {
        if (!prev.includes(articleId)) {
          const newIds = [...prev, articleId];
          saveClickedArticlesToLocal(newIds);
          return newIds;
        }
        return prev;
      });

      // 2. DB에 비동기로 저장 (백그라운드)
      try {
        await userService.markArticleAsClicked(articleId);
      } catch (error) {
        console.error("DB에 클릭 기록 저장 실패:", error);
        // DB 저장 실패해도 로컬 상태는 유지
      }
    },
    [saveClickedArticlesToLocal]
  );

  // 3초 이상 읽었을 때 호출 (실제 읽음 상태용)
  const markAsRead = useCallback((articleId: string) => {
    setReadArticleIds((prev) => {
      if (!prev.includes(articleId)) {
        return [...prev, articleId];
      }
      return prev;
    });
  }, []);

  // 어둡게 표시할지 결정 (클릭했거나 실제로 읽었으면 어둡게)
  const isArticleRead = useCallback(
    (articleId: string) => {
      return (
        clickedArticleIds.includes(articleId) ||
        readArticleIds.includes(articleId)
      );
    },
    [clickedArticleIds, readArticleIds]
  );

  // 실제로 읽었는지 확인 (3초 이상)
  const isArticleActuallyRead = useCallback(
    (articleId: string) => {
      return readArticleIds.includes(articleId);
    },
    [readArticleIds]
  );

  return {
    readArticleIds,
    clickedArticleIds,
    isLoading,
    refreshReadArticles,
    markAsClicked,
    markAsRead,
    isArticleRead,
    isArticleActuallyRead,
  };
}

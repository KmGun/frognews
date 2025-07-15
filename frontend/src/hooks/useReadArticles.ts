import { useState, useEffect } from 'react';
import { userService } from '../services/userService';

export function useReadArticles() {
  const [readArticleIds, setReadArticleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReadArticles = async () => {
      try {
        const ids = await userService.getReadArticleIds();
        setReadArticleIds(ids);
      } catch (error) {
        console.error('읽은 기사 목록 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReadArticles();
  }, []);

  const refreshReadArticles = async () => {
    setIsLoading(true);
    try {
      const ids = await userService.getReadArticleIds();
      setReadArticleIds(ids);
    } catch (error) {
      console.error('읽은 기사 목록 새로고침 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isArticleRead = (articleId: string) => {
    return readArticleIds.includes(articleId);
  };

  return {
    readArticleIds,
    isLoading,
    refreshReadArticles,
    isArticleRead
  };
}
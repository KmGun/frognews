import { useEffect, useRef, useState, useCallback } from 'react';
import { userService } from '../services/userService';

interface UseReadingTrackerOptions {
  articleId?: string;
  threshold?: number; // 초 단위, 기본값 3초
  onRead?: (articleId: string, duration: number) => void;
}

export const useReadingTracker = ({
  articleId,
  threshold = 3,
  onRead
}: UseReadingTrackerOptions) => {
  const [isReading, setIsReading] = useState(false);
  const [readingDuration, setReadingDuration] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasRecordedRef = useRef(false);

  // 읽기 시작
  const startReading = useCallback(() => {
    if (!articleId || isReading) return;

    setIsReading(true);
    startTimeRef.current = Date.now();
    hasRecordedRef.current = false;

    // 1초마다 읽기 시간 업데이트
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setReadingDuration(duration);

        // threshold 초 이상 읽었고 아직 기록하지 않았다면 기록
        if (duration >= threshold && !hasRecordedRef.current && articleId) {
          hasRecordedRef.current = true;
          userService.markArticleAsRead(articleId, duration);
          onRead?.(articleId, duration);
        }
      }
    }, 1000);
  }, [articleId, isReading, threshold, onRead]);

  // 읽기 중지
  const stopReading = useCallback(() => {
    if (!isReading) return;

    setIsReading(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 최종 읽기 시간 계산
    if (startTimeRef.current && articleId) {
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setReadingDuration(finalDuration);

      // threshold 이상이고 아직 기록하지 않았다면 기록
      if (finalDuration >= threshold && !hasRecordedRef.current) {
        hasRecordedRef.current = true;
        userService.markArticleAsRead(articleId, finalDuration);
        onRead?.(articleId, finalDuration);
      }
    }

    startTimeRef.current = null;
  }, [isReading, articleId, threshold, onRead]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      stopReading();
    };
  }, [stopReading]);

  // 페이지 가시성 변경 감지 (탭 변경, 최소화 등)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopReading();
      } else if (articleId) {
        startReading();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [articleId, startReading, stopReading]);

  // 스크롤 및 마우스 활동 감지
  useEffect(() => {
    if (!articleId) return;

    let activityTimeout: NodeJS.Timeout;

    const handleActivity = () => {
      // 활동이 감지되면 읽기 시작
      if (!isReading) {
        startReading();
      }

      // 활동이 없으면 5초 후 읽기 중지
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      activityTimeout = setTimeout(() => {
        stopReading();
      }, 5000);
    };

    // 이벤트 리스너 등록
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // 초기 활동 감지
    handleActivity();

    return () => {
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
    };
  }, [articleId, isReading, startReading, stopReading]);

  return {
    isReading,
    readingDuration,
    startReading,
    stopReading,
  };
}; 
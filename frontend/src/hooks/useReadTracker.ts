import { useEffect, useRef } from "react";
import { userService } from "../services/userService";

interface UseReadTrackerProps {
  articleId: string;
  enabled?: boolean;
  onMarkAsRead?: (articleId: string) => void;
}

export function useReadTracker({
  articleId,
  enabled = true,
  onMarkAsRead,
}: UseReadTrackerProps) {
  const startTimeRef = useRef<number | null>(null);
  const isTrackingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !articleId) return;

    const startTracking = () => {
      if (isTrackingRef.current) return;

      startTimeRef.current = Date.now();
      isTrackingRef.current = true;
      console.log(`시작 읽기 추적: ${articleId}`);
    };

    const stopTracking = async () => {
      if (!isTrackingRef.current || !startTimeRef.current) return;

      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      console.log(`읽기 추적 종료: ${articleId}, 지속 시간: ${duration}초`);

      if (duration >= 3) {
        console.log(`기사 ${articleId}를 읽은 것으로 표시 중...`);
        try {
          await userService.markArticleAsRead(articleId, duration);
          // 기사를 읽은 것으로 표시한 후 콜백 호출
          if (onMarkAsRead) {
            onMarkAsRead(articleId);
          }
        } catch (error) {
          console.error("기사 읽음 상태 저장 실패:", error);
        }
      }

      isTrackingRef.current = false;
      startTimeRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTracking();
      } else {
        startTracking();
      }
    };

    const handleBeforeUnload = () => {
      stopTracking();
    };

    startTracking();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      stopTracking();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [articleId, enabled, onMarkAsRead]);

  return {
    isTracking: isTrackingRef.current,
  };
}

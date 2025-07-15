import { useEffect, useRef, useCallback } from 'react';

const SCROLL_STORAGE_KEY = 'scroll_positions';

export const useScrollPosition = (key: string) => {
  const isRestoringRef = useRef(false);

  // 실제 스크롤 위치를 가져오는 함수
  const getScrollPosition = (): number => {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  };

  // 스크롤 포지션을 세션스토리지에서 가져오기
  const getSavedPosition = (storageKey: string): number | null => {
    try {
      const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (stored) {
        const positions = JSON.parse(stored);
        const value = positions[storageKey];
        
        // 데이터 유효성 검증
        if (typeof value === 'number' && !isNaN(value)) {
          return value;
        } else if (typeof value === 'object' && value !== null) {
          // 이전 버전의 객체 형태 데이터 처리
          console.warn('⚠️ 잘못된 스크롤 데이터 형식 감지, 초기화합니다.');
          sessionStorage.removeItem(SCROLL_STORAGE_KEY);
          return null;
        }
      }
    } catch (error) {
      console.error('스크롤 포지션 불러오기 실패:', error);
      // 오류 발생 시 sessionStorage 초기화
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    }
    return null;
  };

  // 스크롤 포지션을 세션스토리지에 저장
  const savePosition = useCallback((storageKey: string, position: number) => {
    try {
      // 유효성 검증
      if (typeof position !== 'number' || isNaN(position) || position < 50) {
        return; // 의미있는 위치만 저장
      }
      
      const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      let positions: { [key: string]: number } = {};
      
      // 기존 데이터 파싱 및 검증
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // 기존 데이터가 객체가 아니면 초기화
          if (typeof parsed === 'object' && parsed !== null) {
            positions = parsed;
          }
        } catch (parseError) {
          console.warn('⚠️ 기존 스크롤 데이터 파싱 실패, 새로 시작합니다.');
          positions = {};
        }
      }
      
      // 새 위치 저장 (숫자로만 저장)
      positions[storageKey] = position;
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
      
      console.log(`✅ 스크롤 위치 저장: ${storageKey} = ${position}px`);
    } catch (error) {
      console.error('스크롤 포지션 저장 실패:', error);
    }
  }, []);

  // 스크롤 위치 복원 함수 (매우 간단한 버전)
  const restoreScrollPosition = useCallback(() => {
    const savedPosition = getSavedPosition(key);
    if (!savedPosition || savedPosition < 50) {
      console.log(`❌ 복원할 스크롤 위치가 없음: ${key}`);
      return;
    }

    console.log(`🔄 스크롤 복원 시작: ${key} = ${savedPosition}px`);
    isRestoringRef.current = true;

    // 강제로 스크롤 복원
    window.scrollTo(0, savedPosition);
    
    // 복원 확인
    setTimeout(() => {
      const currentPosition = getScrollPosition();
      console.log(`📍 복원 후 위치: ${currentPosition}px (목표: ${savedPosition}px)`);
      
      if (Math.abs(currentPosition - savedPosition) > 100) {
        // 한 번 더 시도
        console.log('🔄 한 번 더 복원 시도');
        window.scrollTo(0, savedPosition);
      }
      
      isRestoringRef.current = false;
    }, 100);
  }, [key]);

  // 수동으로 스크롤 포지션 저장하는 함수
  const saveCurrentPosition = useCallback(() => {
    const currentPosition = getScrollPosition();
    savePosition(key, currentPosition);
  }, [key, savePosition]);

  useEffect(() => {
    // 간단한 스크롤 이벤트 리스너
    const handleScroll = () => {
      if (isRestoringRef.current) return;
      
      const currentPosition = getScrollPosition();
      savePosition(key, currentPosition);
    };

    // 디바운스된 스크롤 핸들러
    let scrollTimeout: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 200);
    };

    // 이벤트 리스너 등록
    window.addEventListener('scroll', debouncedHandleScroll, { passive: true });

    // 페이지 이탈 시 저장
    const handleBeforeUnload = () => {
      savePosition(key, getScrollPosition());
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', debouncedHandleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 언마운트 시 저장
      savePosition(key, getScrollPosition());
    };
  }, [key, savePosition]);

  return { 
    saveCurrentPosition,
    restoreScrollPosition
  };
};
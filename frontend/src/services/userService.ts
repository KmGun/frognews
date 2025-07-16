import { supabase } from './supabase';
import { User, UserReadArticle } from '../types';
import { v4 as uuidv4 } from 'uuid';

class UserService {
  private sessionId: string | null = null;
  private userId: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.initializationPromise = this.initializeSession();
  }

  // 초기화 완료를 기다리는 메서드
  private async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  // 세션 초기화
  private async initializeSession(): Promise<void> {
    // 로컬 스토리지에서 세션 ID 확인
    let sessionId = localStorage.getItem('frognews_session_id');
    
    if (!sessionId) {
      // 새 세션 ID 생성
      sessionId = uuidv4();
      localStorage.setItem('frognews_session_id', sessionId);
    }

    this.sessionId = sessionId;

    if (sessionId) {
      try {
        // 기존 사용자 확인 또는 새 사용자 생성
        const user = await this.getOrCreateUser(sessionId);
        this.userId = user.id;
        
        // 마지막 방문 시간 업데이트
        await this.updateLastVisit(user.id);
      } catch (error) {
        console.error('사용자 세션 초기화 실패:', error);
      }
    }
  }

  // 기존 사용자 조회 또는 새 사용자 생성
  private async getOrCreateUser(sessionId: string): Promise<User> {
    // 기존 사용자 조회
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (existingUser && !selectError) {
      return {
        id: existingUser.id,
        sessionId: existingUser.session_id,
        userAgent: existingUser.user_agent,
        firstVisitAt: new Date(existingUser.first_visit_at),
        lastVisitAt: new Date(existingUser.last_visit_at),
        totalArticlesRead: existingUser.total_articles_read,
        createdAt: new Date(existingUser.created_at),
        updatedAt: new Date(existingUser.updated_at),
      };
    }

    // 새 사용자 생성
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        session_id: sessionId,
        user_agent: navigator.userAgent,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`사용자 생성 실패: ${insertError.message}`);
    }

    return {
      id: newUser.id,
      sessionId: newUser.session_id,
      userAgent: newUser.user_agent,
      firstVisitAt: new Date(newUser.first_visit_at),
      lastVisitAt: new Date(newUser.last_visit_at),
      totalArticlesRead: newUser.total_articles_read,
      createdAt: new Date(newUser.created_at),
      updatedAt: new Date(newUser.updated_at),
    };
  }

  // 마지막 방문 시간 업데이트
  private async updateLastVisit(userId: string) {
    const { error } = await supabase
      .from('users')
      .update({ last_visit_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('마지막 방문 시간 업데이트 실패:', error);
    }
  }

  // 읽은 기사 기록
  async markArticleAsRead(articleId: string, readingDuration: number): Promise<void> {
    // 초기화 완료 대기
    await this.waitForInitialization();
    
    if (!this.userId) {
      console.warn('사용자 ID가 없어 기사 읽기 기록을 저장할 수 없습니다.');
      return;
    }

    // 3초 미만은 읽은 것으로 간주하지 않음
    if (readingDuration < 3) {
      return;
    }

    console.log(`기사 ${articleId}를 DB에 저장 중... (userId: ${this.userId})`);

    try {
      // 중복 체크를 위해 upsert 사용
      const { error } = await supabase
        .from('user_read_articles')
        .upsert({
          user_id: this.userId,
          article_id: articleId, // UUID이므로 parseInt 제거
          reading_duration: readingDuration,
          read_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,article_id'
        });

      if (error) {
        console.error('읽은 기사 기록 실패:', error);
        return;
      }

      console.log(`기사 ${articleId} 읽기 기록 완료`);

      // 사용자의 총 읽은 기사 수 업데이트
      await this.incrementTotalArticlesRead();

    } catch (error) {
      console.error('읽은 기사 기록 중 오류:', error);
    }
  }

  // 총 읽은 기사 수 증가
  private async incrementTotalArticlesRead() {
    if (!this.userId) return;

    const { error } = await supabase.rpc('increment_total_articles_read', {
      user_id: this.userId
    });

    if (error) {
      console.error('총 읽은 기사 수 증가 실패:', error);
    }
  }

  // 사용자가 읽은 기사 ID 목록 조회
  async getReadArticleIds(): Promise<string[]> {
    // 초기화 완료 대기
    await this.waitForInitialization();
    
    if (!this.userId) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('user_read_articles')
        .select('article_id')
        .eq('user_id', this.userId)
        .gte('reading_duration', 3); // 3초 이상 읽은 기사만

      if (error) {
        console.error('읽은 기사 목록 조회 실패:', error);
        return [];
      }

      return data.map(item => item.article_id); // 이미 string 타입이므로 toString() 불필요
    } catch (error) {
      console.error('읽은 기사 목록 조회 중 오류:', error);
      return [];
    }
  }

  // 현재 사용자 ID 반환
  getUserId(): string | null {
    return this.userId;
  }

  // 현재 세션 ID 반환
  getSessionId(): string | null {
    return this.sessionId;
  }
}

// 싱글톤 인스턴스 생성
export const userService = new UserService(); 
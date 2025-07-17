import axios from "axios";
import {
  Article,
  Tweet,
  YouTubeVideo,
  ApiResponse,
  ScrapingResult,
} from "../types";
import { supabase, ArticleRow } from "./supabase";

// API 기본 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    console.log(`API 요청: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    console.log(`API 응답: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("API 오류:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Supabase 데이터를 프론트엔드 Article 타입으로 변환
const convertRowToArticle = (row: ArticleRow): Article => {
  try {
    return {
      id: row.id?.toString(),
      titleSummary: row.title_summary,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      url: row.url,
      imageUrls: JSON.parse(row.image_urls || "[]"),
      summaryLines: JSON.parse(row.summary_lines || "[]"),
      details: JSON.parse(row.details || "[]"),
      category: row.category || 5, // 기본값 5 (기타)
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    console.error("데이터 변환 오류:", error, row);
    // 변환 실패 시 기본값 반환
    return {
      id: row.id?.toString(),
      titleSummary: row.title_summary,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      url: row.url,
      imageUrls: [],
      summaryLines: [],
      details: [],
      category: row.category || 5,
      createdAt: new Date(row.created_at),
    };
  }
};

// Supabase 트위터 데이터를 프론트엔드 Tweet 타입으로 변환
const convertRowToTweet = (row: any): Tweet => {
  try {
    return {
      id: row.id?.toString(),
      text: row.text,
      textKo: row.text_ko || undefined,
      isTranslated: row.is_translated || false,
      translationModel: row.translation_model || undefined,
      translatedAt: row.translated_at ? new Date(row.translated_at) : undefined,
      author: {
        name: row.author_name,
        username: row.author_username,
        profileImageUrl: row.author_profile_image_url || "",
      },
      createdAt: new Date(row.created_at),
      url: row.url,
      category: row.category ?? 5, // 기본값 5 (기타)
      // 미디어 정보 파싱
      media: row.media ? JSON.parse(row.media) : undefined,
      // 비디오 임베드 정보 파싱
      hasVideo: row.has_video || false,
      videoEmbedInfo: row.video_embed_info
        ? JSON.parse(row.video_embed_info)
        : undefined,
    };
  } catch (error) {
    console.error("트위터 데이터 변환 오류:", error, row);
    // 변환 실패 시 기본값 반환
    return {
      id: row.id?.toString(),
      text: row.text,
      textKo: row.text_ko || undefined,
      isTranslated: row.is_translated || false,
      translationModel: row.translation_model || undefined,
      translatedAt: row.translated_at ? new Date(row.translated_at) : undefined,
      author: {
        name: row.author_name,
        username: row.author_username,
        profileImageUrl: row.author_profile_image_url || "",
      },
      createdAt: new Date(row.created_at),
      url: row.url,
      category: row.category ?? 5,
      media: undefined,
      hasVideo: false,
      videoEmbedInfo: undefined,
    };
  }
};

// Supabase 유튜브 데이터를 프론트엔드 YouTubeVideo 타입으로 변환
const convertRowToYouTubeVideo = (row: any): YouTubeVideo => {
  return {
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    channelName: row.channel_name,
    publishedAt: new Date(row.published_at),
    createdAt: new Date(row.created_at),
    duration: row.duration,
    viewCount: row.view_count,
    url: `https://www.youtube.com/watch?v=${row.id}`,
  };
};

// 기사 관련 API
export const articleApi = {
  // 모든 기사 조회 (실제 Supabase 데이터 사용)
  getArticles: async (): Promise<Article[]> => {
    try {
      // Supabase 환경 변수가 설정되지 않았으면 목업 데이터 사용
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        console.warn(
          "Supabase 환경 변수가 설정되지 않아 목업 데이터를 사용합니다."
        );
        const mockArticles = getMockArticles();
        // 최신순으로 정렬 (publishedAt 또는 createdAt 기준)
        return mockArticles.sort((a, b) => {
          const dateA = a.publishedAt || a.createdAt || new Date(0);
          const dateB = b.publishedAt || b.createdAt || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("is_approved", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase 조회 오류:", error);
        // 오류 발생 시 목업 데이터 반환
        const mockArticles = getMockArticles();
        return mockArticles.sort((a, b) => {
          const dateA = a.publishedAt || a.createdAt || new Date(0);
          const dateB = b.publishedAt || b.createdAt || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      if (!data || data.length === 0) {
        console.warn(
          "Supabase에서 데이터를 찾을 수 없어 목업 데이터를 사용합니다."
        );
        const mockArticles = getMockArticles();
        return mockArticles.sort((a, b) => {
          const dateA = a.publishedAt || a.createdAt || new Date(0);
          const dateB = b.publishedAt || b.createdAt || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      return data.map(convertRowToArticle);
    } catch (error) {
      console.error("기사 조회 실패:", error);
      // 오류 발생 시 목업 데이터 반환
      const mockArticles = getMockArticles();
      return mockArticles.sort((a, b) => {
        const dateA = a.publishedAt || a.createdAt || new Date(0);
        const dateB = b.publishedAt || b.createdAt || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    }
  },

  // 카테고리별 기사 조회
  getArticlesByCategory: async (category: number): Promise<Article[]> => {
    try {
      // Supabase 환경 변수가 설정되지 않았으면 목업 데이터 사용
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        const articles = await articleApi.getArticles();
        return articles.filter((article) => article.category === category);
      }

      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("category", category)
        .eq("is_approved", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase 카테고리별 조회 오류:", error);
        // 오류 발생 시 전체 조회 후 필터링
        const articles = await articleApi.getArticles();
        return articles.filter((article) => article.category === category);
      }

      return data ? data.map(convertRowToArticle) : [];
    } catch (error) {
      console.error("카테고리별 기사 조회 실패:", error);
      // 오류 발생 시 전체 조회 후 필터링
      const articles = await articleApi.getArticles();
      return articles.filter((article) => article.category === category);
    }
  },

  // 기사 검색
  searchArticles: async (query: string): Promise<Article[]> => {
    try {
      // Supabase 환경 변수가 설정되지 않았으면 목업 데이터 사용
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        const articles = await articleApi.getArticles();
        return articles.filter(
          (article) =>
            article.titleSummary.toLowerCase().includes(query.toLowerCase()) ||
            article.summaryLines.some((line) =>
              line.toLowerCase().includes(query.toLowerCase())
            )
        );
      }

      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .or(`title_summary.ilike.%${query}%,summary_lines.ilike.%${query}%`)
        .eq("is_approved", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase 검색 오류:", error);
        // 오류 발생 시 전체 조회 후 클라이언트에서 필터링
        const articles = await articleApi.getArticles();
        return articles.filter(
          (article) =>
            article.titleSummary.toLowerCase().includes(query.toLowerCase()) ||
            article.summaryLines.some((line) =>
              line.toLowerCase().includes(query.toLowerCase())
            )
        );
      }

      return data ? data.map(convertRowToArticle) : [];
    } catch (error) {
      console.error("기사 검색 실패:", error);
      // 오류 발생 시 전체 조회 후 필터링
      const articles = await articleApi.getArticles();
      return articles.filter(
        (article) =>
          article.titleSummary.toLowerCase().includes(query.toLowerCase()) ||
          article.summaryLines.some((line) =>
            line.toLowerCase().includes(query.toLowerCase())
          )
      );
    }
  },

  // 개별 기사 조회
  getArticle: async (id: string): Promise<Article | null> => {
    try {
      // Supabase 환경 변수가 설정되지 않았으면 목업 데이터 사용
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        const articles = await articleApi.getArticles();
        return articles.find((article) => article.id === id) || null;
      }

      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", parseInt(id))
        .eq("is_approved", true)
        .single();

      if (error) {
        console.error("Supabase 개별 기사 조회 오류:", error);
        // 오류 발생 시 전체 조회 후 필터링
        const articles = await articleApi.getArticles();
        return articles.find((article) => article.id === id) || null;
      }

      return data ? convertRowToArticle(data) : null;
    } catch (error) {
      console.error("기사 조회 실패:", error);
      // 오류 발생 시 전체 조회 후 필터링
      const articles = await articleApi.getArticles();
      return articles.find((article) => article.id === id) || null;
    }
  },
};

// 트위터 관련 API
export const tweetApi = {
  // 모든 트위터 게시물 조회
  getTweets: async (): Promise<Tweet[]> => {
    try {
      // Supabase 환경 변수가 설정되지 않았으면 목업 데이터 반환
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        console.warn(
          "Supabase 환경 변수가 설정되지 않아 목업 트위터 데이터를 사용합니다."
        );
        return getMockTweets();
      }

      const { data, error } = await supabase
        .from("tweets")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase 트위터 조회 오류:", error);
        return [];
      }

      return data ? data.map(convertRowToTweet) : [];
    } catch (error) {
      console.error("트위터 게시물 조회 실패:", error);
      return [];
    }
  },

  // 개별 트위터 게시물 조회
  getTweet: async (id: string): Promise<Tweet | null> => {
    try {
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        console.warn(
          "Supabase 환경 변수가 설정되지 않아 트위터 데이터를 조회할 수 없습니다."
        );
        return null;
      }

      const { data, error } = await supabase
        .from("tweets")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .eq("is_approved", true)
        .single();

      if (error) {
        console.error("Supabase 트위터 개별 조회 오류:", error);
        return null;
      }

      return data ? convertRowToTweet(data) : null;
    } catch (error) {
      console.error("트위터 게시물 개별 조회 실패:", error);
      return null;
    }
  },
};

// 유튜브 관련 API
export const youtubeApi = {
  // 모든 유튜브 영상 조회
  getVideos: async (): Promise<YouTubeVideo[]> => {
    try {
      // Supabase 환경 변수가 설정되지 않았으면 빈 배열 반환
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        console.warn(
          "Supabase 환경 변수가 설정되지 않아 유튜브 데이터를 조회할 수 없습니다."
        );
        return [];
      }

      const { data, error } = await supabase
        .from("youtube_videos")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("published_at", { ascending: false });

      if (error) {
        console.error("Supabase 유튜브 조회 오류:", error);
        return [];
      }

      return data ? data.map(convertRowToYouTubeVideo) : [];
    } catch (error) {
      console.error("유튜브 영상 조회 실패:", error);
      return [];
    }
  },

  // 특정 채널의 유튜브 영상 조회
  getVideosByChannel: async (channelName: string): Promise<YouTubeVideo[]> => {
    try {
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        console.warn(
          "Supabase 환경 변수가 설정되지 않아 유튜브 데이터를 조회할 수 없습니다."
        );
        return [];
      }

      const { data, error } = await supabase
        .from("youtube_videos")
        .select("*")
        .eq("channel_name", channelName)
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("published_at", { ascending: false });

      if (error) {
        console.error("Supabase 유튜브 채널별 조회 오류:", error);
        return [];
      }

      return data ? data.map(convertRowToYouTubeVideo) : [];
    } catch (error) {
      console.error("유튜브 채널별 영상 조회 실패:", error);
      return [];
    }
  },

  // 개별 유튜브 영상 조회
  getVideo: async (id: string): Promise<YouTubeVideo | null> => {
    try {
      if (
        !process.env.REACT_APP_SUPABASE_URL ||
        !process.env.REACT_APP_SUPABASE_ANON_KEY
      ) {
        console.warn(
          "Supabase 환경 변수가 설정되지 않아 유튜브 데이터를 조회할 수 없습니다."
        );
        return null;
      }

      const { data, error } = await supabase
        .from("youtube_videos")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .eq("is_approved", true)
        .single();

      if (error) {
        console.error("Supabase 유튜브 개별 조회 오류:", error);
        return null;
      }

      return data ? convertRowToYouTubeVideo(data) : null;
    } catch (error) {
      console.error("유튜브 영상 개별 조회 실패:", error);
      return null;
    }
  },
};

// 스크래핑 관련 API
export const scrapingApi = {
  // 스크래핑 실행
  scrapeSource: async (sourceId: string): Promise<ScrapingResult> => {
    try {
      const response = await api.post<ApiResponse<ScrapingResult>>(
        `/scrape/${sourceId}`
      );
      return response.data.data!;
    } catch (error) {
      console.error("스크래핑 실행 실패:", error);
      throw error;
    }
  },

  // 모든 소스 스크래핑
  scrapeAll: async (): Promise<ScrapingResult[]> => {
    try {
      const response = await api.post<ApiResponse<ScrapingResult[]>>(
        "/scrape-all"
      );
      return response.data.data!;
    } catch (error) {
      console.error("전체 스크래핑 실패:", error);
      throw error;
    }
  },
};

// 목업 트위터 데이터
const getMockTweets = (): Tweet[] => {
  return [
    {
      id: "1945413532142755860",
      text: "Just released: New AI breakthrough in computer vision! Check out these amazing results from our latest research. #AI #ComputerVision",
      textKo:
        "방금 출시: 컴퓨터 비전의 새로운 AI 혁신! 우리의 최신 연구에서 나온 놀라운 결과들을 확인해보세요. #AI #컴퓨터비전",
      isTranslated: true,
      translationModel: "gpt-4.1",
      translatedAt: new Date("2024-01-15T10:30:00Z"),
      author: {
        name: "AI Research Lab",
        username: "airesearchlab",
        profileImageUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      },
      createdAt: new Date("2024-01-15T10:00:00Z"),
      url: "https://x.com/airesearchlab/status/1945413532142755860",
      category: 3,
      media: [
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop",
        "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=400&fit=crop",
      ],
      hasVideo: false,
    },
    {
      id: "1945525044529992053",
      text: "Exciting news! OpenAI just announced GPT-5 with multimodal capabilities. This is a game changer for AI applications!",
      textKo:
        "흥미진진한 소식! OpenAI가 방금 멀티모달 기능을 갖춘 GPT-5를 발표했습니다. 이는 AI 애플리케이션의 판도를 바꿀 것입니다!",
      isTranslated: true,
      translationModel: "gpt-4.1",
      translatedAt: new Date("2024-01-15T14:30:00Z"),
      author: {
        name: "Tech Innovator",
        username: "techinnovator",
        profileImageUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      },
      createdAt: new Date("2024-01-15T14:00:00Z"),
      url: "https://x.com/techinnovator/status/1945525044529992053",
      category: 2,
      media: [
        "https://images.unsplash.com/photo-1676299081847-824916de030a?w=600&h=400&fit=crop",
      ],
      hasVideo: false,
    },
    {
      id: "1945150767997841679",
      text: "Check out this amazing robot demonstration! 🤖 The future is here. Video shows incredible precision and dexterity.",
      textKo:
        "이 놀라운 로봇 시연을 확인해보세요! 🤖 미래가 여기 있습니다. 비디오는 믿을 수 없는 정밀도와 손재주를 보여줍니다.",
      isTranslated: true,
      translationModel: "gpt-4.1",
      translatedAt: new Date("2024-01-15T08:30:00Z"),
      author: {
        name: "Robotics Today",
        username: "roboticstoday",
        profileImageUrl:
          "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100&h=100&fit=crop",
      },
      createdAt: new Date("2024-01-15T08:00:00Z"),
      url: "https://x.com/roboticstoday/status/1945150767997841679",
      category: 2,
      hasVideo: true,
      videoEmbedInfo: {
        tweetId: "1945150767997841679",
        username: "roboticstoday",
        embedUrl: "https://x.com/roboticstoday/status/1945150767997841679",
      },
    },
    {
      id: "1945600000000000000",
      text: "Machine learning models are getting better at understanding context. Here are some examples from our latest experiments:",
      textKo:
        "머신러닝 모델이 맥락을 이해하는 데 점점 더 나아지고 있습니다. 다음은 우리의 최신 실험에서 나온 몇 가지 예시입니다:",
      isTranslated: true,
      translationModel: "gpt-4.1",
      translatedAt: new Date("2024-01-15T16:30:00Z"),
      author: {
        name: "ML Researcher",
        username: "mlresearcher",
        profileImageUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      },
      createdAt: new Date("2024-01-15T16:00:00Z"),
      url: "https://x.com/mlresearcher/status/1945600000000000000",
      category: 3,
      media: [
        "https://images.unsplash.com/photo-1655635949832-8ea5c6f7f0c5?w=600&h=400&fit=crop",
        "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=400&fit=crop",
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&h=400&fit=crop",
      ],
      hasVideo: false,
    },
  ];
};

// 목업 데이터
const getMockArticles = (): Article[] => {
  return [
    {
      id: "1",
      titleSummary:
        "Grok, 허들러 찬양 - X CEO 일론 머스크의 새로운 AI 어시스턴트 출시",
      publishedAt: new Date("2024-01-15"),
      url: "https://aitimes.com/news/article1",
      imageUrls: [
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=500&h=300&fit=crop",
        "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=500&h=300&fit=crop",
      ],
      summaryLines: [
        "1. 그록이 허들러 찬양 등 극단적 발언으로 국제적 논란을 일으키며 X 플랫폼이 막말을 받고 있다.",
        "2. 타카루픈드 등 각국 정부가 강하게 반발했고, X CEO 일론 머스크는 사과를 발표했다.",
        "3. 머스크는 '그록 4' 출시로 비판을 덮으려는 시도를 하고 있다.",
      ],
      details: [
        "그록은 허들러 찬양과 관련된 극단적 발언으로 국제적 논란을 일으켰습니다. 특히 독일정부와 유럽연합에서 강력한 비판을 받았으며, 이는 X 플랫폼의 신뢰성에 큰 타격을 주었습니다. 이러한 발언은 AI 윤리와 책임에 대한 중요한 논의를 불러일으키고 있습니다.",
        "타카루픈드를 비롯한 각국 정부들이 강하게 반발하면서 국제적인 외교 문제로 확산되었습니다. 특히 독일과 프랑스 정부는 공식적인 항의를 표명했으며, 유럽연합은 AI 규제 강화를 검토하고 있습니다.",
        "일론 머스크는 이러한 논란을 덮기 위해 '그록 4' 출시를 발표했습니다. 새로운 버전에서는 더 강화된 안전 장치와 윤리적 가이드라인을 적용할 예정이라고 밝혔습니다.",
      ],
      category: 2,
      createdAt: new Date("2024-01-15"),
    },
    {
      id: "2",
      titleSummary: "Meta, Llama 3 대규모 언어 모델 오픈소스 공개",
      publishedAt: new Date("2024-01-14"),
      url: "https://aitimes.com/news/article2",
      imageUrls: [
        "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500&h=300&fit=crop",
      ],
      summaryLines: [
        "1. Meta가 Llama 3 모델을 오픈소스로 공개하며 AI 커뮤니티에 기여하고 있다.",
        "2. 이전 버전 대비 성능이 크게 향상되었으며 다양한 언어를 지원한다.",
        "3. 개발자들은 이제 무료로 상용 서비스에 활용할 수 있게 되었다.",
      ],
      details: [
        "Meta는 Llama 3 모델을 오픈소스로 공개함으로써 AI 개발 커뮤니티에 큰 기여를 하고 있습니다. 이는 AI 기술의 민주화와 혁신을 가속화할 것으로 기대됩니다.",
        "새로운 Llama 3는 이전 버전 대비 추론 능력과 코딩 성능이 크게 향상되었습니다. 또한 한국어를 포함한 다양한 언어를 지원하여 글로벌 활용도가 높아졌습니다.",
        "개발자들은 이제 Llama 3를 무료로 상용 서비스에 활용할 수 있게 되었습니다. 이는 스타트업과 소규모 기업들에게 큰 도움이 될 것으로 예상됩니다.",
      ],
      category: 1,
      createdAt: new Date("2024-01-14"),
    },
    {
      id: "3",
      titleSummary: "OpenAI, GPT-4 Turbo 업데이트로 토큰 제한 확대",
      publishedAt: new Date("2024-01-13"),
      url: "https://aitimes.com/news/article3",
      imageUrls: [
        "https://images.unsplash.com/photo-1676299081847-824916de030a?w=500&h=300&fit=crop",
        "https://images.unsplash.com/photo-1655635949832-8ea5c6f7f0c5?w=500&h=300&fit=crop",
      ],
      summaryLines: [
        "1. OpenAI가 GPT-4 Turbo의 컨텍스트 윈도우를 128K 토큰으로 확대했다.",
        "2. 더 긴 문서와 대화를 처리할 수 있어 실용성이 크게 향상되었다.",
        "3. 개발자들은 더 복잡한 애플리케이션을 구축할 수 있게 되었다.",
      ],
      details: [
        "OpenAI는 GPT-4 Turbo의 컨텍스트 윈도우를 128K 토큰으로 확대했습니다. 이는 약 300페이지 분량의 텍스트를 한 번에 처리할 수 있는 수준입니다.",
        "확장된 컨텍스트 윈도우로 인해 더 긴 문서 분석, 장시간 대화 유지, 복잡한 프로젝트 관리 등이 가능해졌습니다.",
        "개발자들은 이제 더 복잡하고 정교한 AI 애플리케이션을 구축할 수 있게 되었습니다. 특히 문서 분석, 코드 리뷰, 창작 도구 등의 분야에서 활용도가 높아질 것으로 예상됩니다.",
      ],
      category: 2,
      createdAt: new Date("2024-01-13"),
    },
    {
      id: "4",
      titleSummary: "서울대 AI 연구소, 한국어 특화 언어모델 '세종' 발표",
      publishedAt: new Date("2024-01-12"),
      url: "https://aitimes.com/news/article4",
      imageUrls: [
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=300&fit=crop",
      ],
      summaryLines: [
        "1. 서울대 AI 연구소가 한국어에 특화된 언어모델 세종을 발표했다.",
        "2. 기존 모델 대비 한국어 이해도와 문맥 파악 능력이 크게 향상되었다.",
        "3. 국내 AI 연구의 자립성과 경쟁력 강화에 기여할 것으로 기대된다.",
      ],
      details: [
        "서울대 AI 연구소는 한국어의 특수성을 고려한 언어모델 '세종'을 발표했습니다. 이는 국내 AI 연구의 중요한 성과로 평가받고 있습니다.",
        "새로운 모델은 기존 글로벌 모델들 대비 한국어 문법, 관용구, 문화적 맥락에 대한 이해도가 크게 향상되었습니다.",
        "이번 연구 성과는 국내 AI 연구의 자립성을 높이고 한국어 AI 서비스의 품질 향상에 크게 기여할 것으로 기대됩니다.",
      ],
      category: 3,
      createdAt: new Date("2024-01-12"),
    },
    {
      id: "5",
      titleSummary: "정부, AI 반도체 산업 육성을 위한 1조원 규모 펀드 조성",
      publishedAt: new Date("2024-01-11"),
      url: "https://aitimes.com/news/article5",
      imageUrls: [
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=500&h=300&fit=crop",
      ],
      summaryLines: [
        "1. 정부가 AI 반도체 산업 육성을 위해 1조원 규모의 펀드를 조성한다고 발표했다.",
        "2. 국내 AI 반도체 기업들의 기술 개발과 글로벌 경쟁력 확보를 지원한다.",
        "3. 2030년까지 세계 3위 AI 반도체 강국 도약을 목표로 한다.",
      ],
      details: [
        "정부는 AI 반도체 산업의 전략적 중요성을 인식하고 1조원 규모의 대규모 펀드 조성을 발표했습니다. 이는 국가 차원의 AI 반도체 육성 정책의 핵심입니다.",
        "이번 펀드는 삼성전자, SK하이닉스 등 대기업뿐만 아니라 중소·중견 AI 반도체 기업들의 기술 개발과 글로벌 시장 진출을 지원할 예정입니다.",
        "정부는 2030년까지 세계 3위 AI 반도체 강국으로 도약한다는 목표를 설정했습니다. 이를 위해 인재 양성, 인프라 구축, 글로벌 협력 등을 종합적으로 추진할 계획입니다.",
      ],
      category: 4,
      createdAt: new Date("2024-01-11"),
    },
  ];
};

export default api;

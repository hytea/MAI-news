export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  originalContent: string;
  rewrittenContent?: string;
  source: string;
  sourceUrl: string;
  category: string;
  publishedAt: string;
  imageUrl?: string;
  author?: string;
  readingTime?: number;
}

export interface RewrittenArticle {
  id: string;
  articleId: string;
  content: string;
  style: StyleProfile;
  createdAt: string;
}

export type StyleProfile =
  | 'conversational'
  | 'academic'
  | 'bullet-point'
  | 'eli5'
  | 'executive'
  | 'original';

export interface UserPreferences {
  id: string;
  userId: string;
  preferredStyle: StyleProfile;
  followedTopics: string[];
  mutedTopics: string[];
  mutedSources: string[];
  preferredSources: string[];
  readingTimePreference?: number;
  notificationsEnabled: boolean;
  emailDigest: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface Citation {
  id: string;
  articleId: string;
  text: string;
  sourceUrl: string;
  sourceName: string;
  reliability?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

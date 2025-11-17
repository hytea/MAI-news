import axios, { AxiosInstance } from 'axios';
import type {
  User,
  Article,
  RewrittenArticle,
  UserPreferences,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  PaginatedResponse,
  StyleProfile,
  Citation,
  ApiResponse,
  ArticleCategory,
  ReadingHistory,
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 errors and unwrap API responses
    this.client.interceptors.response.use(
      (response) => {
        // Unwrap the API response if it follows { success, data } pattern
        if (response.data?.success && response.data?.data !== undefined) {
          response.data = response.data.data;
        }
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/login', credentials);
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/register', userData);
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    const { data } = await this.client.get<ApiResponse<{ user: User }>>('/auth/me');
    return data.user;
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/refresh', { refreshToken });
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  // Articles
  async getArticles(params?: {
    limit?: number;
    offset?: number;
    category?: ArticleCategory;
    sourceId?: string;
    search?: string;
    sortBy?: 'published_at' | 'importance_score' | 'created_at';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Article>> {
    const { data } = await this.client.get<
      ApiResponse<{ articles: Article[]; pagination: any }>
    >('/articles', { params });

    return {
      data: data.articles,
      pagination: data.pagination,
    };
  }

  async getArticle(id: string): Promise<Article> {
    const { data } = await this.client.get<Article>(`/articles/${id}`);
    return data;
  }

  async rewriteArticle(
    articleId: string,
    styleProfileId: string,
    options?: {
      skipCache?: boolean;
      includeKeyPoints?: boolean;
      includeSummary?: boolean;
    }
  ): Promise<RewrittenArticle> {
    const { data } = await this.client.post<RewrittenArticle>(
      `/articles/${articleId}/rewrite`,
      {
        styleProfileId,
        ...options,
      }
    );
    return data;
  }

  async getRewrittenArticle(
    articleId: string,
    styleProfileId: string
  ): Promise<RewrittenArticle | null> {
    try {
      const { data } = await this.client.get<RewrittenArticle>(
        `/articles/${articleId}/rewritten/${styleProfileId}`
      );
      return data;
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.data?.success === false) {
        return null;
      }
      throw error;
    }
  }

  async getUserRewrittenArticles(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ rewrittenArticles: RewrittenArticle[]; pagination: any }> {
    const { data } = await this.client.get<ApiResponse<{
      rewrittenArticles: RewrittenArticle[];
      pagination: any;
    }>>('/articles/rewritten/my-articles', { params });
    return data;
  }

  async deleteRewrittenArticle(id: string): Promise<void> {
    await this.client.delete(`/articles/rewritten/${id}`);
  }

  // Style Profiles
  async getStyleProfiles(): Promise<StyleProfile[]> {
    const { data } = await this.client.get<StyleProfile[]>('/style-profiles');
    return data;
  }

  async getPublicStyleProfiles(limit?: number): Promise<StyleProfile[]> {
    const { data } = await this.client.get<StyleProfile[]>('/style-profiles/public', {
      params: { limit },
    });
    return data;
  }

  async getStyleProfile(id: string): Promise<StyleProfile> {
    const { data } = await this.client.get<StyleProfile>(`/style-profiles/${id}`);
    return data;
  }

  async createStyleProfile(
    profile: Omit<StyleProfile, 'id' | 'userId' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ): Promise<StyleProfile> {
    const { data } = await this.client.post<StyleProfile>('/style-profiles', profile);
    return data;
  }

  async updateStyleProfile(
    id: string,
    updates: Partial<StyleProfile>
  ): Promise<StyleProfile> {
    const { data } = await this.client.put<StyleProfile>(`/style-profiles/${id}`, updates);
    return data;
  }

  async deleteStyleProfile(id: string): Promise<void> {
    await this.client.delete(`/style-profiles/${id}`);
  }

  // User Preferences
  async getPreferences(): Promise<UserPreferences> {
    const { data } = await this.client.get<UserPreferences>('/user/preferences');
    return data;
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const { data } = await this.client.put<UserPreferences>('/user/preferences', preferences);
    return data;
  }

  // Reading History
  async getReadingHistory(params?: {
    limit?: number;
    offset?: number;
    completed?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<ReadingHistory & { article: Article }>> {
    const { data } = await this.client.get<
      ApiResponse<{ history: (ReadingHistory & { article: Article })[]; pagination: any }>
    >('/user/reading-history', { params });

    return {
      data: data.history,
      pagination: data.pagination,
    };
  }

  async recordReading(articleData: {
    articleId: string;
    rewrittenArticleId?: string;
    readingTimeSeconds?: number;
    completed?: boolean;
    progressPercentage?: number;
  }): Promise<ReadingHistory> {
    const { data } = await this.client.post<ReadingHistory>(
      '/user/reading-history',
      articleData
    );
    return data;
  }

  async getReadingStats(): Promise<{
    totalArticlesRead: number;
    totalReadingTimeSeconds: number;
    averageReadingTimeSeconds: number;
    articlesReadToday: number;
    articlesReadThisWeek: number;
    articlesReadThisMonth: number;
  }> {
    const { data } = await this.client.get('/user/reading-stats');
    return data;
  }

  // Saved Articles
  async getSavedArticles(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<{ article: Article; savedAt: string }>> {
    const { data } = await this.client.get<
      ApiResponse<{
        savedArticles: { article: Article; savedAt: string }[];
        pagination: any;
      }>
    >('/user/saved-articles', { params });

    return {
      data: data.savedArticles,
      pagination: data.pagination,
    };
  }

  async saveArticle(articleId: string, notes?: string): Promise<void> {
    await this.client.post('/user/saved-articles', { articleId, notes });
  }

  async unsaveArticle(articleId: string): Promise<void> {
    await this.client.delete(`/user/saved-articles/${articleId}`);
  }

  // Cache Management
  async getCacheStats(): Promise<any> {
    const { data } = await this.client.get('/articles/cache/stats');
    return data;
  }

  async clearMyCache(): Promise<void> {
    await this.client.delete('/articles/cache/my-cache');
  }

  // Helper methods
  private setTokens(token: string, refreshToken: string): void {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
  }

  private clearTokens(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}

export const apiClient = new ApiClient();

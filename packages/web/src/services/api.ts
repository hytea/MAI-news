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

    // Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
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
    this.setTokens(data.token, data.refreshToken);
    return data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/register', userData);
    this.setTokens(data.token, data.refreshToken);
    return data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
    this.clearTokens();
  }

  async getCurrentUser(): Promise<User> {
    const { data } = await this.client.get<User>('/auth/me');
    return data;
  }

  // Articles
  async getArticles(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  }): Promise<PaginatedResponse<Article>> {
    const { data } = await this.client.get<PaginatedResponse<Article>>('/articles', { params });
    return data;
  }

  async getArticle(id: string): Promise<Article> {
    const { data } = await this.client.get<Article>(`/articles/${id}`);
    return data;
  }

  async getRewrittenArticle(articleId: string, style: StyleProfile): Promise<RewrittenArticle> {
    const { data } = await this.client.post<RewrittenArticle>(`/articles/${articleId}/rewrite`, {
      style,
    });
    return data;
  }

  async getCitations(articleId: string): Promise<Citation[]> {
    const { data } = await this.client.get<Citation[]>(`/articles/${articleId}/citations`);
    return data;
  }

  // User Preferences
  async getPreferences(): Promise<UserPreferences> {
    const { data } = await this.client.get<UserPreferences>('/users/preferences');
    return data;
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const { data } = await this.client.patch<UserPreferences>('/users/preferences', preferences);
    return data;
  }

  // Reading History
  async markArticleAsRead(articleId: string): Promise<void> {
    await this.client.post(`/users/reading-history`, { articleId });
  }

  async getReadingHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Article>> {
    const { data } = await this.client.get<PaginatedResponse<Article>>('/users/reading-history', {
      params,
    });
    return data;
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
